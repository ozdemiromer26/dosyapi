use async_trait::async_trait;
use dosyapi_core::error::{AppError, AppResult};
use dosyapi_core::ports::{DnsProvider, DnsRecord, DnsResolver, RecordType};
use serde_json::{Value, json};
use std::time::Duration;

const DOH_URL: &str = "https://cloudflare-dns.com/dns-query";

/// Yayılımı sunucunun yerel önbelleğinden bağımsız görmek için şifreli DNS (DoH) kullanır.
/// Yalnızca şirketin kendi alan adı sorgulanır.
pub struct PublicDnsResolver {
    http: reqwest::Client,
}

impl PublicDnsResolver {
    pub fn new() -> AppResult<Self> {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(8))
            .redirect(reqwest::redirect::Policy::none())
            .https_only(true)
            .build()
            .map_err(AppError::internal)?;
        Ok(Self { http })
    }
}

/// `\\# 22 00 05 ...` biçimindeki ham kaydı (CAA) okunur metne çevirir.
fn decode_rdata(data: &str) -> String {
    let Some(rest) = data.strip_prefix("\\#") else {
        return data.trim_matches('"').trim_end_matches('.').to_string();
    };
    let bytes: Vec<u8> = rest
        .split_whitespace()
        .skip(1)
        .filter_map(|h| u8::from_str_radix(h, 16).ok())
        .collect();
    String::from_utf8_lossy(&bytes).into_owned()
}

#[async_trait]
impl DnsResolver for PublicDnsResolver {
    async fn lookup(&self, name: &str, record: &RecordType) -> AppResult<Vec<String>> {
        let kind: u64 = match record {
            RecordType::A => 1,
            RecordType::Aaaa => 28,
            RecordType::Cname => 5,
            RecordType::Txt => 16,
            RecordType::Mx => 15,
            RecordType::Caa => 257,
        };
        let response = self
            .http
            .get(DOH_URL)
            .query(&[("name", name), ("type", record.as_str())])
            .header("accept", "application/dns-json")
            .send()
            .await
            .map_err(|_| AppError::Unavailable("DNS sorgusu yapılamadı.".into()))?;
        let body: Value = response
            .json()
            .await
            .map_err(|_| AppError::Unavailable("DNS yanıtı okunamadı.".into()))?;
        let answers = body["Answer"].as_array().cloned().unwrap_or_default();
        Ok(answers
            .iter()
            .filter(|a| a["type"].as_u64() == Some(kind))
            .filter_map(|a| a["data"].as_str())
            .map(decode_rdata)
            .collect())
    }
}

const CLOUDFLARE_API: &str = "https://api.cloudflare.com/client/v4";

pub struct CloudflareProvider {
    http: reqwest::Client,
}

impl CloudflareProvider {
    pub fn new() -> AppResult<Self> {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(AppError::internal)?;
        Ok(Self { http })
    }

    async fn call(&self, token: &str, request: reqwest::RequestBuilder) -> AppResult<Value> {
        let response = request
            .bearer_auth(token)
            .send()
            .await
            .map_err(|_| AppError::Unavailable("Cloudflare'a bağlanılamadı.".into()))?;
        let status = response.status();
        let body: Value = response
            .json()
            .await
            .map_err(|_| AppError::Unavailable("Cloudflare yanıtı okunamadı.".into()))?;
        if !status.is_success() || body["success"] != Value::Bool(true) {
            tracing::warn!(%status, "Cloudflare isteği reddedildi");
            return Err(AppError::Unavailable(
                "Cloudflare isteği reddetti. API belirtecinin DNS yazma yetkisini kontrol edin."
                    .into(),
            ));
        }
        Ok(body)
    }

    async fn zone_id(&self, token: &str, zone: &str) -> AppResult<String> {
        let url = format!("{CLOUDFLARE_API}/zones");
        let body = self
            .call(token, self.http.get(url).query(&[("name", zone)]))
            .await?;
        body["result"][0]["id"]
            .as_str()
            .map(str::to_string)
            .ok_or_else(|| AppError::validation("Bu alan adı Cloudflare hesabında bulunamadı."))
    }
}

#[async_trait]
impl DnsProvider for CloudflareProvider {
    fn id(&self) -> &'static str {
        "cloudflare"
    }

    async fn upsert(&self, token: &str, zone: &str, record: &DnsRecord) -> AppResult<()> {
        let zone_id = self.zone_id(token, zone).await?;
        let records = format!("{CLOUDFLARE_API}/zones/{zone_id}/dns_records");
        let kind = record.record_type.as_str();
        let existing = self
            .call(
                token,
                self.http
                    .get(&records)
                    .query(&[("type", kind), ("name", record.name.as_str())]),
            )
            .await?;
        let mut payload = json!({ "type": kind, "name": record.name, "content": record.value, "ttl": 300, "proxied": false });
        if record.record_type == RecordType::Caa {
            payload = json!({
                "type": kind, "name": record.name, "ttl": 300,
                "data": { "flags": 0, "tag": "issue", "value": "letsencrypt.org" }
            });
        }
        match existing["result"][0]["id"].as_str() {
            Some(id) => {
                self.call(
                    token,
                    self.http.put(format!("{records}/{id}")).json(&payload),
                )
                .await?
            }
            None => {
                self.call(token, self.http.post(&records).json(&payload))
                    .await?
            }
        };
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::decode_rdata;

    #[test]
    fn decodes_raw_and_plain_records() {
        assert_eq!(decode_rdata("\"v=spf1 ~all\""), "v=spf1 ~all");
        assert_eq!(decode_rdata("dosya.sirket.com."), "dosya.sirket.com");
        assert!(decode_rdata("\\# 8 00 05 69 73 73 75 65 41").contains("issue"));
    }
}
