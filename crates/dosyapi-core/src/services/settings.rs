//! Ayarlara türlü erişim. Tüm ayar anahtarları burada toplanır.

use crate::error::{AppError, AppResult};
use crate::model::{Company, Palette};
use crate::ports::{SecretBox, SettingsRepo, SmtpConfig};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

pub const KEY_SETUP_DONE: &str = "setup.done";
pub const KEY_COMPANY: &str = "company";
pub const KEY_PALETTE: &str = "palette";
pub const KEY_DOMAINS: &str = "email.domains";
pub const KEY_DOMAIN_LOCK: &str = "email.domainLock";
pub const KEY_MASTER_HASH: &str = "master.hash";
pub const KEY_MASTER_TOTP: &str = "master.totp";
pub const KEY_MASTER_LOCK: &str = "master.lock";
pub const KEY_SMTP: &str = "smtp";
pub const KEY_SMTP_PASSWORD: &str = "smtp.password";
pub const KEY_CHANNEL: &str = "update.channel";
pub const KEY_AUTO_CHECK: &str = "update.autoCheck";
pub const KEY_LAST_CHECK: &str = "update.lastCheck";
pub const KEY_INSTALLED: &str = "update.installed";
pub const KEY_DNS: &str = "dns";
pub const KEY_DNS_TOKEN: &str = "dns.token";
pub const KEY_NOTICE: &str = "legal.notice";

/// Yanlış master şifre sayacı; yeniden başlatmada sıfırlanmasın diye veritabanında.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct LockState {
    pub failures: i64,
    pub locked_until: i64,
}

#[derive(Clone)]
pub struct Settings {
    repo: Arc<dyn SettingsRepo>,
    secrets: Arc<dyn SecretBox>,
}

impl Settings {
    pub fn new(repo: Arc<dyn SettingsRepo>, secrets: Arc<dyn SecretBox>) -> Self {
        Self { repo, secrets }
    }

    pub async fn get_json<T: DeserializeOwned>(&self, key: &str) -> AppResult<Option<T>> {
        match self.repo.get(key).await? {
            Some(raw) => serde_json::from_str(&raw)
                .map(Some)
                .map_err(AppError::internal),
            None => Ok(None),
        }
    }

    pub async fn set_json<T: Serialize + Sync>(&self, key: &str, value: &T) -> AppResult<()> {
        let raw = serde_json::to_string(value).map_err(AppError::internal)?;
        self.repo.set(key, &raw).await
    }

    pub async fn get_secret(&self, key: &str) -> AppResult<Option<String>> {
        match self.repo.get(key).await? {
            Some(sealed) => self.secrets.open(key, &sealed).map(Some),
            None => Ok(None),
        }
    }

    pub async fn set_secret(&self, key: &str, value: &str) -> AppResult<()> {
        let sealed = self.secrets.seal(key, value)?;
        self.repo.set(key, &sealed).await
    }

    pub async fn remove(&self, key: &str) -> AppResult<()> {
        self.repo.remove(key).await
    }

    pub async fn company(&self) -> AppResult<Company> {
        Ok(self.get_json(KEY_COMPANY).await?.unwrap_or_default())
    }

    pub async fn palette(&self) -> AppResult<Palette> {
        Ok(self.get_json(KEY_PALETTE).await?.unwrap_or_default())
    }

    pub async fn domains(&self) -> AppResult<Vec<String>> {
        Ok(self.get_json(KEY_DOMAINS).await?.unwrap_or_default())
    }

    pub async fn domain_lock(&self) -> AppResult<bool> {
        Ok(self.get_json(KEY_DOMAIN_LOCK).await?.unwrap_or(false))
    }

    /// KVKK aydınlatma metni; boşsa kayıt ekranında onay istenmez.
    pub async fn privacy_notice(&self) -> AppResult<String> {
        Ok(self.get_json(KEY_NOTICE).await?.unwrap_or_default())
    }

    pub async fn setup_done(&self) -> AppResult<bool> {
        Ok(self.get_json(KEY_SETUP_DONE).await?.unwrap_or(false))
    }

    pub async fn smtp(&self) -> AppResult<Option<SmtpConfig>> {
        let Some(mut config) = self.get_json::<SmtpConfig>(KEY_SMTP).await? else {
            return Ok(None);
        };
        config.password = self
            .get_secret(KEY_SMTP_PASSWORD)
            .await?
            .unwrap_or_default();
        Ok(Some(config))
    }

    pub async fn email_allowed(&self, email: &str) -> AppResult<bool> {
        let domains = self.domains().await?;
        if !self.domain_lock().await? || domains.is_empty() {
            return Ok(true);
        }
        Ok(domains.contains(&crate::validate::email_domain(email)))
    }
}
