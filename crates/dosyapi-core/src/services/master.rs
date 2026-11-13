//! Sistem paneli (master) kimlik doğrulaması. Kullanıcı hesaplarından tamamen ayrıdır.

use crate::error::{AppError, AppResult};
use crate::model::*;
use crate::password;
use crate::ports::*;
use crate::services::audit::Auditor;
use crate::services::settings::{
    KEY_MASTER_DISABLED, KEY_MASTER_HASH, KEY_MASTER_LOCK, KEY_MASTER_TOTP, KEY_MASTER_TOTP_STEP,
    LockState, MasterDisabled, Settings,
};
use serde::Serialize;
use std::sync::Arc;

pub const MASTER_TTL: i64 = 2 * 3600;
pub const MASTER_IDLE: i64 = 30 * 60;

/// Bu kadar ardışık hatalı denemeden sonra panel geçici olarak kilitlenir.
pub const LOCK_AFTER: i64 = 5;

/// Master girişinde kilit süresi başarısızlıkla üstel artar; 1 saatle sınırlıdır.
fn lockout_seconds(failures: i64) -> i64 {
    const LOCK_BASE_SECS: i64 = 60;
    const LOCK_MAX_SECS: i64 = 3600;
    if failures < LOCK_AFTER {
        return 0;
    }
    let exponent = (failures - LOCK_AFTER).min(10) as u32;
    (LOCK_BASE_SECS.saturating_mul(1 << exponent)).min(LOCK_MAX_SECS)
}

/// Giriş ekranının durumu: açık, hatalı denemeler yüzünden geçici kilitli ya da konsoldan
/// devre dışı bırakılmış. Kilit ekranı bu bilgilerle çizilir.
#[derive(Clone, Debug, Serialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum MasterGate {
    #[serde(rename_all = "camelCase")]
    Open { remaining: i64 },
    #[serde(rename_all = "camelCase")]
    Locked {
        until: i64,
        failures: i64,
        last_at: i64,
        last_ip: String,
    },
    #[serde(rename_all = "camelCase")]
    Disabled {
        since: i64,
        last_at: i64,
        last_ip: String,
    },
}

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

    async fn disabled(&self) -> AppResult<Option<MasterDisabled>> {
        self.settings.get_json(KEY_MASTER_DISABLED).await
    }

    /// Kilit ekranı için durum. Kimlik doğrulaması istemez; yalnızca zaman, sayı ve adres verir.
    pub async fn gate(&self) -> AppResult<MasterGate> {
        let lock = self.lock_state().await?;
        if let Some(disabled) = self.disabled().await? {
            return Ok(MasterGate::Disabled {
                since: disabled.at,
                last_at: lock.last_at,
                last_ip: lock.last_ip,
            });
        }
        if lock.locked_until > self.clock.now() {
            return Ok(MasterGate::Locked {
                until: lock.locked_until,
                failures: lock.failures,
                last_at: lock.last_at,
                last_ip: lock.last_ip,
            });
        }
        Ok(MasterGate::Open {
            remaining: (LOCK_AFTER - lock.failures).max(1),
        })
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
        let mut lock = self.lock_state().await?;
        lock.last_at = now;
        lock.last_ip = meta.ip.chars().take(64).collect();
        // Kapalı ya da kilitliyken şifre denenmez; yalnızca son deneme kaydedilir.
        if self.disabled().await?.is_some() {
            self.settings.set_json(KEY_MASTER_LOCK, &lock).await?;
            return Err(AppError::Locked(
                "Sistem paneli devre dışı bırakıldı.".into(),
            ));
        }
        if lock.locked_until > now {
            self.settings.set_json(KEY_MASTER_LOCK, &lock).await?;
            return Err(AppError::Locked("Sistem paneli kilitli.".into()));
        }
        if password.chars().count() > password::MAX_LEN || !self.check_password(password).await? {
            lock.failures += 1;
            let until = now + lockout_seconds(lock.failures);
            lock.locked_until = if until > now { until } else { 0 };
            self.settings.set_json(KEY_MASTER_LOCK, &lock).await?;
            self.audit
                .master(meta, "master.login_failed", "", "")
                .await?;
            if lock.locked_until > now {
                self.audit.master(meta, "master.locked", "", "").await?;
                return Err(AppError::Locked("Sistem paneli kilitlendi.".into()));
            }
            return Err(AppError::validation(format!(
                "Master şifre hatalı. {} deneme hakkınız kaldı.",
                LOCK_AFTER - lock.failures
            )));
        }
        if let Some(secret) = self.settings.get_secret(KEY_MASTER_TOTP).await? {
            let code = code.unwrap_or_default();
            if code.is_empty() {
                return Err(AppError::TotpRequired);
            }
            let last: i64 = self
                .settings
                .get_json(KEY_MASTER_TOTP_STEP)
                .await?
                .unwrap_or(0);
            // Aynı kod (ya da daha eskisi) ikinci kez kabul edilmez.
            match self
                .totp
                .verify(&secret, code, now)
                .filter(|step| *step > last)
            {
                Some(step) => self.settings.set_json(KEY_MASTER_TOTP_STEP, &step).await?,
                None => {
                    self.audit
                        .master(meta, "master.totp_failed", "", "")
                        .await?;
                    return Err(AppError::validation("Doğrulama kodu hatalı."));
                }
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
        if session.expires_at <= now
            || session.last_seen_at + session.idle_seconds <= now
            || self.disabled().await?.is_some()
        {
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

    /// Sunucu konsolundan: paneli kapatır, açık master oturumlarını sonlandırır.
    pub async fn disable(&self, meta: &RequestMeta) -> AppResult<()> {
        if self.disabled().await?.is_none() {
            self.settings
                .set_json(
                    KEY_MASTER_DISABLED,
                    &MasterDisabled {
                        at: self.clock.now(),
                    },
                )
                .await?;
        }
        self.sessions.delete_kind(SessionKind::Master).await?;
        self.audit.master(meta, "master.disabled", "", "").await
    }

    /// Sunucu konsolundan: kapatmayı, geçici kilidi ve deneme sayacını kaldırır.
    /// Master şifre ve iki adımlı doğrulama değişmez.
    pub async fn enable(&self, meta: &RequestMeta) -> AppResult<()> {
        self.settings.remove(KEY_MASTER_DISABLED).await?;
        self.settings
            .set_json(KEY_MASTER_LOCK, &LockState::default())
            .await?;
        self.audit.master(meta, "master.enabled", "", "").await
    }

    /// Sunucu konsolundan: yeni master şifre; iki adımlı doğrulama, kilit ve oturumlar sıfırlanır.
    /// Paneli kapatma (`master-disable`) bundan etkilenmez.
    pub async fn console_reset(&self, new_password: &str, meta: &RequestMeta) -> AppResult<()> {
        password::check(new_password, &[])?;
        let hash = self.hasher.hash(new_password)?;
        self.settings.set_json(KEY_MASTER_HASH, &hash).await?;
        self.settings.remove(KEY_MASTER_TOTP).await?;
        self.settings
            .set_json(KEY_MASTER_LOCK, &LockState::default())
            .await?;
        self.sessions.delete_kind(SessionKind::Master).await?;
        self.audit.master(meta, "master.reset", "", "").await
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
        // Açıkken yeni anahtar yazmak, oturumu ele geçirene doğrulamayı değiştirme imkânı verirdi.
        if self.totp_status().await? {
            return Err(AppError::conflict(
                "İki adımlı doğrulama zaten açık; yeniden kurmak için önce kapatın.",
            ));
        }
        let step = self
            .totp
            .verify(secret, code, self.clock.now())
            .ok_or_else(|| AppError::validation("Kod hatalı."))?;
        self.settings.set_secret(KEY_MASTER_TOTP, secret).await?;
        self.settings.set_json(KEY_MASTER_TOTP_STEP, &step).await?;
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
