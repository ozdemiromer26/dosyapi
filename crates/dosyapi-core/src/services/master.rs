//! Sistem paneli (master) kimlik doğrulaması. Kullanıcı hesaplarından tamamen ayrıdır.

use crate::error::{AppError, AppResult};
use crate::model::*;
use crate::password;
use crate::ports::*;
use crate::services::audit::Auditor;
use crate::services::auth::lockout_seconds;
use crate::services::settings::{
    KEY_MASTER_HASH, KEY_MASTER_LOCK, KEY_MASTER_TOTP, LockState, Settings,
};
use std::sync::Arc;

pub const MASTER_TTL: i64 = 2 * 3600;
pub const MASTER_IDLE: i64 = 30 * 60;

#[derive(Debug)]
pub struct MasterAuthenticated {
    pub token_hash: Vec<u8>,
}

#[derive(Clone)]
pub struct MasterService {
    pub settings: Settings,
    pub sessions: Arc<dyn SessionRepo>,
    pub hasher: Arc<dyn PasswordHasher>,
    pub tokens: Arc<dyn TokenService>,
    pub totp: Arc<dyn Totp>,
    pub limiter: Arc<dyn RateLimiter>,
    pub clock: Arc<dyn Clock>,
    pub audit: Auditor,
}

impl MasterService {
    async fn lock_state(&self) -> AppResult<LockState> {
        Ok(self
            .settings
            .get_json(KEY_MASTER_LOCK)
            .await?
            .unwrap_or_default())
    }

    async fn check_password(&self, password: &str) -> AppResult<bool> {
        let Some(hash) = self.settings.get_json::<String>(KEY_MASTER_HASH).await? else {
            self.hasher.burn(password);
            return Ok(false);
        };
        Ok(self.hasher.verify(&hash, password))
    }

    pub async fn login(
        &self,
        password: &str,
        code: Option<&str>,
        meta: &RequestMeta,
    ) -> AppResult<(String, i64)> {
        self.limiter
            .hit(&format!("master-ip:{}", meta.ip), 10, 600)
            .map_err(|RetryAfter(s)| AppError::RateLimited {
                retry_after_secs: s,
            })?;
        let now = self.clock.now();
        let lock = self.lock_state().await?;
        if lock.locked_until > now {
            return Err(AppError::RateLimited {
                retry_after_secs: (lock.locked_until - now) as u64,
            });
        }
        if password.chars().count() > password::MAX_LEN || !self.check_password(password).await? {
            let failures = lock.failures + 1;
            let until = now + lockout_seconds(failures);
            self.settings
                .set_json(
                    KEY_MASTER_LOCK,
                    &LockState {
                        failures,
                        locked_until: if until > now { until } else { 0 },
                    },
                )
                .await?;
            self.audit
                .master(meta, "master.login_failed", "", "")
                .await?;
            return Err(AppError::validation("Master şifre hatalı."));
        }
        if let Some(secret) = self.settings.get_secret(KEY_MASTER_TOTP).await? {
            let code = code.unwrap_or_default();
            if code.is_empty() {
                return Err(AppError::TotpRequired);
            }
            if !self.totp.verify(&secret, code, now) {
                self.audit
                    .master(meta, "master.totp_failed", "", "")
                    .await?;
                return Err(AppError::validation("Doğrulama kodu hatalı."));
            }
        }
        self.settings
            .set_json(KEY_MASTER_LOCK, &LockState::default())
            .await?;
        let token = self.tokens.generate();
        self.sessions
            .insert(&Session {
                token_hash: self.tokens.hash(&token),
                kind: SessionKind::Master,
                user_id: None,
                created_at: now,
                last_seen_at: now,
                expires_at: now + MASTER_TTL,
                idle_seconds: MASTER_IDLE,
                persistent: false,
                ip: meta.ip.clone(),
                user_agent: meta.user_agent.chars().take(200).collect(),
            })
            .await?;
        self.audit.master(meta, "master.login", "", "").await?;
        Ok((token, MASTER_TTL))
    }

    pub async fn authenticate(&self, token: &str) -> AppResult<MasterAuthenticated> {
        let token_hash = self.tokens.hash(token);
        let session = self
            .sessions
            .find(&token_hash)
            .await?
            .ok_or(AppError::Unauthorized)?;
        let now = self.clock.now();
        if session.kind != SessionKind::Master {
            return Err(AppError::Unauthorized);
        }
        if session.expires_at <= now || session.last_seen_at + session.idle_seconds <= now {
            self.sessions.delete(&token_hash).await?;
            return Err(AppError::Unauthorized);
        }
        self.sessions.touch(&token_hash, now).await?;
        Ok(MasterAuthenticated { token_hash })
    }

    pub async fn logout(&self, token: &str) -> AppResult<()> {
        self.sessions.delete(&self.tokens.hash(token)).await
    }

    pub fn csrf_token(&self, token_hash: &[u8]) -> String {
        self.tokens.csrf_token(token_hash)
    }

    pub fn csrf_valid(&self, token_hash: &[u8], candidate: &str) -> bool {
        self.tokens.csrf_valid(token_hash, candidate)
    }

    /// Yıkıcı işlemler öncesi master şifrenin yeniden doğrulanması.
    pub async fn confirm(&self, password: &str, meta: &RequestMeta) -> AppResult<()> {
        self.limiter
            .hit(&format!("master-confirm:{}", meta.ip), 5, 600)
            .map_err(|RetryAfter(s)| AppError::RateLimited {
                retry_after_secs: s,
            })?;
        if !self.check_password(password).await? {
            self.audit
                .master(meta, "master.confirm_failed", "", "")
                .await?;
            return Err(AppError::validation("Master şifre hatalı."));
        }
        Ok(())
    }

    pub async fn change_password(&self, old: &str, new: &str, meta: &RequestMeta) -> AppResult<()> {
        if !self.check_password(old).await? {
            return Err(AppError::validation("Mevcut master şifre hatalı."));
        }
        password::check(new, &[])?;
        let hash = self.hasher.hash(new)?;
        self.settings.set_json(KEY_MASTER_HASH, &hash).await?;
        self.sessions.delete_kind(SessionKind::Master).await?;
        self.audit
            .master(meta, "master.password_changed", "", "")
            .await
    }

    pub async fn totp_status(&self) -> AppResult<bool> {
        Ok(self.settings.get_secret(KEY_MASTER_TOTP).await?.is_some())
    }

    pub fn totp_begin(&self) -> AppResult<(String, String)> {
        let secret = self.totp.new_secret();
        let uri = self.totp.provisioning_uri(&secret, "master", "dosyapi")?;
        Ok((secret, uri))
    }

    pub async fn totp_confirm(
        &self,
        secret: &str,
        code: &str,
        meta: &RequestMeta,
    ) -> AppResult<()> {
        if !self.totp.verify(secret, code, self.clock.now()) {
            return Err(AppError::validation("Kod hatalı."));
        }
        self.settings.set_secret(KEY_MASTER_TOTP, secret).await?;
        self.audit.master(meta, "master.totp_enabled", "", "").await
    }

    pub async fn totp_disable(&self, password: &str, meta: &RequestMeta) -> AppResult<()> {
        self.confirm(password, meta).await?;
        self.settings.remove(KEY_MASTER_TOTP).await?;
        self.audit
            .master(meta, "master.totp_disabled", "", "")
            .await
    }
}
