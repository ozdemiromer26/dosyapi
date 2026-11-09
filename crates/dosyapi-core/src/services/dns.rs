//! Alan adı ve DNS yönetimi: beklenen kayıtları hesaplar, gerçek DNS ile karşılaştırır,
//! sağlayıcı API'si tanımlıysa kayıtları otomatik yazar.

use crate::error::{AppError, AppResult};
use crate::model::RequestMeta;
use crate::ports::*;
use crate::services::audit::Auditor;
use crate::services::settings::*;
use crate::validate;
use serde::{Deserialize, Serialize};
use std::net::{Ipv4Addr, Ipv6Addr};
use std::sync::Arc;

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DnsConfig {
    /// Uygulamanın yayınlanacağı alan adı, ör. `dosya.sirket.com`.
    pub domain: String,
    #[serde(default)]
    pub ipv4: String,
    #[serde(default)]
    pub ipv6: String,
    /// Boş ya da `manual`: kayıtlar elle girilir. `cloudflare`: API ile yazılır.
    #[serde(default)]
    pub provider: String,
    #[serde(default)]
    pub zone: String,
    /// Otomatik TLS sertifikası (Let's Encrypt) açık mı?
    #[serde(default)]
    pub acme: bool,
    #[serde(default)]
    pub acme_email: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordCheck {
    pub record_type: RecordType,
    pub name: String,
    pub expected: String,
    pub found: Vec<String>,
    pub state: String,
    pub purpose: String,
    pub required: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DnsConfigInput {
    #[serde(flatten)]
    pub config: DnsConfig,
    /// Boşsa mevcut API belirteci korunur.
    #[serde(default)]
    pub api_token: String,
}

#[derive(Clone)]
pub struct DnsService {
    pub settings: Settings,
    pub resolver: Arc<dyn DnsResolver>,
    pub providers: Vec<Arc<dyn DnsProvider>>,
    pub audit: Auditor,
}

fn parent_zone(domain: &str) -> String {
    let parts: Vec<&str> = domain.split('.').collect();
    if parts.len() <= 2 {
        domain.to_string()
    } else {
        parts[parts.len() - 2..].join(".")
    }
}

impl DnsService {
    pub async fn config(&self) -> AppResult<DnsConfig> {
        Ok(self.settings.get_json(KEY_DNS).await?.unwrap_or_default())
    }

    pub fn provider_ids(&self) -> Vec<&'static str> {
        self.providers.iter().map(|p| p.id()).collect()
    }

    fn normalize(&self, mut config: DnsConfig) -> AppResult<DnsConfig> {
        config.domain = validate::domain(&config.domain)?;
        if !config.ipv4.is_empty() {
            let ip: Ipv4Addr = config
                .ipv4
                .trim()
                .parse()
                .map_err(|_| AppError::validation("Geçerli bir IPv4 adresi girin."))?;
            config.ipv4 = ip.to_string();
        }
        if !config.ipv6.is_empty() {
            let ip: Ipv6Addr = config
                .ipv6
                .trim()
                .parse()
                .map_err(|_| AppError::validation("Geçerli bir IPv6 adresi girin."))?;
            config.ipv6 = ip.to_string();
        }
        if config.ipv4.is_empty() && config.ipv6.is_empty() {
            return Err(AppError::validation(
                "Sunucunun en az bir IP adresini girin.",
            ));
        }
        if !config.provider.is_empty()
            && config.provider != "manual"
            && !self.provider_ids().contains(&config.provider.as_str())
        {
            return Err(AppError::validation("Desteklenmeyen DNS sağlayıcısı."));
        }
        config.zone = if config.zone.trim().is_empty() {
            parent_zone(&config.domain)
        } else {
            validate::domain(&config.zone)?
        };
        if config.acme {
            config.acme_email = validate::email(&config.acme_email)?;
        }
        Ok(config)
    }

    pub async fn save(&self, input: DnsConfigInput, meta: &RequestMeta) -> AppResult<DnsConfig> {
        let config = self.normalize(input.config)?;
        self.settings.set_json(KEY_DNS, &config).await?;
        if !input.api_token.is_empty() {
            if input.api_token.len() > 512 || input.api_token.chars().any(char::is_control) {
                return Err(AppError::validation("Geçersiz API belirteci."));
            }
            self.settings
                .set_secret(KEY_DNS_TOKEN, &input.api_token)
                .await?;
        }
        self.audit
            .master(meta, "dns.save", &config.domain, "")
            .await?;
        Ok(config)
    }

    pub async fn has_token(&self) -> AppResult<bool> {
        Ok(self.settings.get_secret(KEY_DNS_TOKEN).await?.is_some())
    }

    /// Uygulamanın çalışması için gereken kayıtlar. Posta kayıtları SMTP ayarından türetilir.
    pub async fn expected(
        &self,
        config: &DnsConfig,
    ) -> AppResult<Vec<(DnsRecord, &'static str, bool)>> {
        let mut records = Vec::new();
        if !config.ipv4.is_empty() {
            records.push((
                DnsRecord {
                    record_type: RecordType::A,
                    name: config.domain.clone(),
                    value: config.ipv4.clone(),
                },
                "Alan adını sunucunun IPv4 adresine yönlendirir",
                true,
            ));
        }
        if !config.ipv6.is_empty() {
            records.push((
                DnsRecord {
                    record_type: RecordType::Aaaa,
                    name: config.domain.clone(),
                    value: config.ipv6.clone(),
                },
                "Alan adını sunucunun IPv6 adresine yönlendirir",
                true,
            ));
        }
        if config.acme {
            records.push((
                DnsRecord {
                    record_type: RecordType::Caa,
                    name: config.zone.clone(),
                    value: "0 issue \"letsencrypt.org\"".into(),
                },
                "Sertifikayı yalnızca Let's Encrypt verebilir",
                false,
            ));
        }
        if let Some(smtp) = self.settings.smtp().await? {
            let mail_domain = validate::email_domain(&smtp.from);
            if !mail_domain.is_empty() {
                records.push((
                    DnsRecord {
                        record_type: RecordType::Txt,
                        name: mail_domain.clone(),
                        value: format!("v=spf1 a:{} ~all", smtp.host),
                    },
                    "E-postaların sahte gönderilmesini zorlaştırır (SPF)",
                    false,
                ));
                records.push((
                    DnsRecord {
                        record_type: RecordType::Txt,
                        name: format!("_dmarc.{mail_domain}"),
                        value: "v=DMARC1; p=quarantine".into(),
                    },
                    "Sahte e-postaların işlenme kuralı (DMARC)",
                    false,
                ));
            }
        }
        Ok(records)
    }

    fn matches(record: &DnsRecord, found: &[String]) -> bool {
        match record.record_type {
            RecordType::Txt if record.value.starts_with("v=spf1") => {
                found.iter().any(|f| f.starts_with("v=spf1"))
            }
            RecordType::Txt if record.value.starts_with("v=DMARC1") => {
                found.iter().any(|f| f.starts_with("v=DMARC1"))
            }
            RecordType::Caa => found.iter().any(|f| f.contains("letsencrypt.org")),
            _ => found.iter().any(|f| f.eq_ignore_ascii_case(&record.value)),
        }
    }

    pub async fn check(&self) -> AppResult<Vec<RecordCheck>> {
        let config = self.config().await?;
        if config.domain.is_empty() {
            return Ok(vec![]);
        }
        let mut result = Vec::new();
        for (record, purpose, required) in self.expected(&config).await? {
            let found = self
                .resolver
                .lookup(&record.name, &record.record_type)
                .await
                .unwrap_or_default();
            let state = if Self::matches(&record, &found) {
                "ok"
            } else if found.is_empty() {
                "missing"
            } else {
                "mismatch"
            };
            result.push(RecordCheck {
                record_type: record.record_type,
                name: record.name,
                expected: record.value,
                found,
                state: state.into(),
                purpose: purpose.into(),
                required,
            });
        }
        Ok(result)
    }

    pub async fn push_to_provider(&self, meta: &RequestMeta) -> AppResult<usize> {
        let config = self.config().await?;
        let provider = self
            .providers
            .iter()
            .find(|p| p.id() == config.provider)
            .ok_or_else(|| AppError::validation("Önce bir DNS sağlayıcısı seçin."))?;
        let token = self
            .settings
            .get_secret(KEY_DNS_TOKEN)
            .await?
            .ok_or_else(|| AppError::validation("DNS sağlayıcısı API belirteci girilmemiş."))?;
        let records = self.expected(&config).await?;
        for (record, _, _) in &records {
            provider.upsert(&token, &config.zone, record).await?;
        }
        self.audit
            .master(meta, "dns.push", &config.domain, "")
            .await?;
        Ok(records.len())
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn zone_of_subdomain() {
        assert_eq!(parent_zone("dosya.sirket.com"), "sirket.com");
        assert_eq!(parent_zone("sirket.com"), "sirket.com");
    }
}
