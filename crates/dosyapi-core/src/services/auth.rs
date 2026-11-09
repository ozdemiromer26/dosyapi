//! Kimlik doğrulama: giriş, kayıt, şifre sıfırlama, oturum yaşam döngüsü.

use crate::error::{AppError, AppResult};
use crate::model::*;
use crate::password;
use crate::ports::*;
use crate::services::audit::Auditor;
use crate::services::mail::MailService;
use crate::services::settings::Settings;
use crate::validate;
use std::sync::Arc;

pub const SESSION_TTL: i64 = 12 * 3600;
pub const SESSION_IDLE: i64 = 4 * 3600;
pub const REMEMBER_TTL: i64 = 30 * 24 * 3600;
pub const REMEMBER_IDLE: i64 = 7 * 24 * 3600;
pub const RESET_TTL: i64 = 30 * 60;
pub const INVITE_TTL: i64 = 72 * 3600;
const LOCK_AFTER: i64 = 5;
const LOCK_BASE_SECS: i64 = 60;
const LOCK_MAX_SECS: i64 = 3600;

pub const PURPOSE_RESET: &str = "reset";

#[derive(Debug)]
pub struct LoginOutcome {
    pub token: String,
    pub persistent: bool,
    pub max_age: i64,
}

#[derive(Debug)]
pub struct Authenticated {
    pub actor: Actor,
    pub token_hash: Vec<u8>,
}

#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RegisterInput {
    pub name: String,
    pub email: String,
    #[serde(default)]
    pub phone: String,
    pub password: String,
    #[serde(default)]
    pub accepted_notice: bool,
}

/// Kilit süresi başarısızlıkla üstel artar; 1 saatle sınırlıdır.
pub fn lockout_seconds(failures: i64) -> i64 {
    if failures < LOCK_AFTER {
        return 0;
    }
    let exponent = (failures - LOCK_AFTER).min(10) as u32;
    (LOCK_BASE_SECS.saturating_mul(1 << exponent)).min(LOCK_MAX_SECS)
}

#[derive(Clone)]
pub struct AuthService {
    pub users: Arc<dyn UserRepo>,
    pub roles: Arc<dyn RoleRepo>,
    pub sessions: Arc<dyn SessionRepo>,
    pub tokens: Arc<dyn TokenRepo>,
    pub pendings: Arc<dyn PendingRepo>,
    pub hasher: Arc<dyn PasswordHasher>,
    pub token_service: Arc<dyn TokenService>,
    pub totp: Arc<dyn Totp>,
    pub limiter: Arc<dyn RateLimiter>,
    pub clock: Arc<dyn Clock>,
    pub audit: Auditor,
    pub mail: MailService,
    pub settings: Settings,
    pub public_url: Arc<dyn Fn() -> String + Send + Sync>,
}

impl AuthService {
    fn limit(&self, key: String, limit: u32, window: u64) -> AppResult<()> {
        self.limiter
            .hit(&key, limit, window)
            .map_err(|RetryAfter(secs)| AppError::RateLimited {
                retry_after_secs: secs,
            })
    }

    async fn new_session(
        &self,
        user_id: &str,
        remember: bool,
        meta: &RequestMeta,
    ) -> AppResult<LoginOutcome> {
        let now = self.clock.now();
        let token = self.token_service.generate();
        let (ttl, idle) = if remember {
            (REMEMBER_TTL, REMEMBER_IDLE)
        } else {
            (SESSION_TTL, SESSION_IDLE)
        };
        self.sessions
            .insert(&Session {
                token_hash: self.token_service.hash(&token),
                kind: SessionKind::User,
                user_id: Some(user_id.to_string()),
                created_at: now,
                last_seen_at: now,
                expires_at: now + ttl,
                idle_seconds: idle,
                persistent: remember,
                ip: meta.ip.clone(),
                user_agent: meta.user_agent.chars().take(200).collect(),
            })
            .await?;
        Ok(LoginOutcome {
            token,
            persistent: remember,
            max_age: ttl,
        })
    }

    pub async fn login(
        &self,
        email: &str,
        password: &str,
        totp_code: Option<&str>,
        remember: bool,
        meta: &RequestMeta,
    ) -> AppResult<LoginOutcome> {
        self.limit(format!("login-ip:{}", meta.ip), 30, 300)?;
        if password.chars().count() > password::MAX_LEN {
            return Err(AppError::InvalidCredentials);
        }
        let email = email.trim().to_lowercase();
        let now = self.clock.now();
        let Some(user) = self.users.by_email(&email).await? else {
            self.hasher.burn(password);
            self.audit.anonymous(meta, "login.unknown", "").await?;
            return Err(AppError::InvalidCredentials);
        };
        if let Some(until) = user.locked_until.filter(|u| *u > now) {
            self.hasher.burn(password);
            return Err(AppError::RateLimited {
                retry_after_secs: (until - now) as u64,
            });
        }
        if !self.hasher.verify(&user.password_hash, password) {
            let failed = user.failed_logins + 1;
            let lock = lockout_seconds(failed);
            let until = (lock > 0).then_some(now + lock);
            self.users.set_login_state(&user.id, failed, until).await?;
            self.audit
                .user_at(&user.id, meta, "login.failed", "")
                .await?;
            return Err(AppError::InvalidCredentials);
        }
        if user.status == UserStatus::Pending {
            return Err(AppError::conflict(
                "Hesabınız henüz yönetici onayı beklemektedir.",
            ));
        }
        if user.totp_enabled {
            let secret = user
                .totp_secret
                .as_deref()
                .ok_or_else(|| AppError::internal("totp secret yok"))?;
            let code = totp_code.unwrap_or_default();
            if code.is_empty() {
                return Err(AppError::TotpRequired);
            }
            self.limit(format!("totp:{}", user.id), 5, 300)?;
            if !self.totp.verify(secret, code, now) {
                self.audit
                    .user_at(&user.id, meta, "login.totp_failed", "")
                    .await?;
                return Err(AppError::InvalidCredentials);
            }
        }
        self.users.set_login_state(&user.id, 0, None).await?;
        self.audit
            .user_at(&user.id, meta, "login.success", "")
            .await?;
        self.new_session(&user.id, remember, meta).await
    }

    /// Kullanıcı numaralandırmasını önlemek için kayıtlı e-postada da aynı yanıt döner.
    pub async fn register(&self, input: RegisterInput, meta: &RequestMeta) -> AppResult<()> {
        self.limit(format!("register-ip:{}", meta.ip), 5, 3600)?;
        let name = validate::required(&input.name, "Ad soyad", 120)?;
        let email = validate::email(&input.email)?;
        let phone = validate::phone(&input.phone)?;
        password::check(&input.password, &[&email, &name])?;
        if !self.settings.email_allowed(&email).await? {
            let allowed = self
                .settings
                .domains()
                .await?
                .iter()
                .map(|d| format!("@{d}"))
                .collect::<Vec<_>>()
                .join(", ");
            return Err(AppError::validation(format!(
                "Bu e-posta alan adına izin verilmiyor. İzin verilenler: {allowed}"
            )));
        }
        let notice_required = !self.settings.privacy_notice().await?.is_empty();
        if notice_required && !input.accepted_notice {
            return Err(AppError::validation(
                "Aydınlatma metnini onaylamanız gerekiyor.",
            ));
        }
        let hash = self.hasher.hash(&input.password)?;
        if self.users.by_email(&email).await?.is_some() {
            self.audit.anonymous(meta, "register.duplicate", "").await?;
            return Ok(());
        }
        let now = self.clock.now();
        let user = User {
            id: new_id(),
            name: name.clone(),
            email: email.clone(),
            phone,
            password_hash: hash,
            role_id: None,
            status: UserStatus::Pending,
            must_change_password: false,
            totp_secret: None,
            totp_enabled: false,
            failed_logins: 0,
            locked_until: None,
            notice_accepted_at: notice_required.then_some(now),
            created_at: now,
        };
        self.users.insert(&user).await?;
        self.pendings
            .insert(&Pending {
                id: new_id(),
                kind: PendingKind::UserApprove,
                entity: Entity::User,
                payload: PendingPayload::UserApprove {
                    id: user.id.clone(),
                },
                title: format!("Kayıt talebi: {name}"),
                detail: format!("{email} · rol ataması bekliyor"),
                by: name,
                by_id: user.id.clone(),
                when: now,
                min_level: 2,
                target_level: None,
                doc_key: None,
                file_name: None,
            })
            .await?;
        self.audit.user_at(&user.id, meta, "register", "").await
    }

    /// Hız sınırı yanıttan önce denetlenir; asıl iş arka planda yürür.
    pub fn forgot_limit(&self, meta: &RequestMeta) -> AppResult<()> {
        self.limit(format!("forgot-ip:{}", meta.ip), 5, 3600)
    }

    /// HTTP katmanı bunu arka planda çalıştırır: yanıt süresi hesabın varlığını ele vermez.
    pub async fn forgot(&self, email: &str, meta: &RequestMeta) -> AppResult<()> {
        let Ok(email) = validate::email(email) else {
            return Ok(());
        };
        self.limit(format!("forgot-mail:{email}"), 3, 3600)?;
        let Some(user) = self.users.by_email(&email).await? else {
            return Ok(());
        };
        if user.status != UserStatus::Active {
            return Ok(());
        }
        let link = self.issue_reset_link(&user.id, RESET_TTL).await?;
        let company = self.settings.company().await?.name;
        let body = format!(
            "Merhaba {},\n\n{} hesabınız için şifre sıfırlama talebi aldık.\n\
             Aşağıdaki bağlantı 30 dakika geçerlidir ve yalnızca bir kez kullanılabilir:\n\n{}\n\n\
             Bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.",
            user.name, company, link
        );
        if let Err(error) = self.mail.send(&user.email, "Şifre sıfırlama", body).await {
            tracing::warn!(%error, "şifre sıfırlama e-postası gönderilemedi");
        }
        self.audit
            .user_at(&user.id, meta, "password.reset_requested", "")
            .await
    }

    /// Tek kullanımlık bağlantı üretir. Belirtecin kendisi saklanmaz, yalnızca özeti.
    pub async fn issue_reset_link(&self, user_id: &str, ttl: i64) -> AppResult<String> {
        let token = self.token_service.generate();
        let hash = self.token_service.hash(&token);
        self.tokens
            .replace(&hash, PURPOSE_RESET, user_id, self.clock.now() + ttl)
            .await?;
        Ok(format!(
            "{}/#/sifre-sifirla?token={}",
            (self.public_url)().trim_end_matches('/'),
            token
        ))
    }

    pub async fn reset_password(
        &self,
        token: &str,
        new_password: &str,
        meta: &RequestMeta,
    ) -> AppResult<()> {
        self.limit(format!("reset-ip:{}", meta.ip), 10, 900)?;
        let invalid = || AppError::validation("Sıfırlama bağlantısı geçersiz veya süresi dolmuş.");
        if token.len() > 128 {
            return Err(invalid());
        }
        let hash = self.token_service.hash(token);
        // Parola politikası belirteç tüketilmeden önce denetlenir: zayıf parola bağlantıyı yakmaz.
        password::check(new_password, &[])?;
        let user_id = self
            .tokens
            .consume(&hash, PURPOSE_RESET, self.clock.now())
            .await?
            .ok_or_else(invalid)?;
        let user = self.users.get(&user_id).await?.ok_or_else(invalid)?;
        password::check(new_password, &[&user.email, &user.name])?;
        let new_hash = self.hasher.hash(new_password)?;
        self.users.set_password(&user.id, &new_hash, false).await?;
        self.users.set_login_state(&user.id, 0, None).await?;
        self.sessions.delete_for_user(&user.id, None).await?;
        self.audit
            .user_at(&user.id, meta, "password.reset", "")
            .await
    }

    pub async fn change_password(
        &self,
        auth: &Authenticated,
        old_password: &str,
        new_password: &str,
        meta: &RequestMeta,
    ) -> AppResult<()> {
        self.limit(format!("pw-change:{}", auth.actor.user_id), 10, 900)?;
        let user = self
            .users
            .get(&auth.actor.user_id)
            .await?
            .ok_or(AppError::Unauthorized)?;
        if !self.hasher.verify(&user.password_hash, old_password) {
            return Err(AppError::validation("Mevcut şifre hatalı."));
        }
        password::check(new_password, &[&user.email, &user.name])?;
        let hash = self.hasher.hash(new_password)?;
        self.users.set_password(&user.id, &hash, false).await?;
        self.sessions
            .delete_for_user(&user.id, Some(&auth.token_hash))
            .await?;
        self.audit
            .user_at(&user.id, meta, "password.changed", "")
            .await
    }

    pub async fn authenticate(&self, token: &str) -> AppResult<Authenticated> {
        let token_hash = self.token_service.hash(token);
        let session = self
            .sessions
            .find(&token_hash)
            .await?
            .ok_or(AppError::Unauthorized)?;
        let now = self.clock.now();
        if session.kind != SessionKind::User {
            return Err(AppError::Unauthorized);
        }
        if session.expires_at <= now || session.last_seen_at + session.idle_seconds <= now {
            self.sessions.delete(&token_hash).await?;
            return Err(AppError::Unauthorized);
        }
        let user_id = session.user_id.as_deref().ok_or(AppError::Unauthorized)?;
        let user = self
            .users
            .get(user_id)
            .await?
            .ok_or(AppError::Unauthorized)?;
        if user.status != UserStatus::Active {
            return Err(AppError::Unauthorized);
        }
        let role_id = user.role_id.as_deref().ok_or(AppError::Unauthorized)?;
        let role = self
            .roles
            .get(role_id)
            .await?
            .ok_or(AppError::Unauthorized)?;
        if now - session.last_seen_at >= 60 {
            self.sessions.touch(&token_hash, now).await?;
        }
        Ok(Authenticated {
            actor: Actor {
                user_id: user.id,
                name: user.name,
                email: user.email,
                role,
                must_change_password: user.must_change_password,
                totp_enabled: user.totp_enabled,
            },
            token_hash,
        })
    }

    pub async fn logout(&self, token: &str) -> AppResult<()> {
        self.sessions.delete(&self.token_service.hash(token)).await
    }

    pub async fn logout_everywhere(
        &self,
        auth: &Authenticated,
        meta: &RequestMeta,
    ) -> AppResult<()> {
        self.sessions
            .delete_for_user(&auth.actor.user_id, Some(&auth.token_hash))
            .await?;
        self.audit
            .user_at(&auth.actor.user_id, meta, "sessions.revoked", "")
            .await
    }

    pub fn csrf_token(&self, token_hash: &[u8]) -> String {
        self.token_service.csrf_token(token_hash)
    }

    pub fn csrf_valid(&self, token_hash: &[u8], candidate: &str) -> bool {
        self.token_service.csrf_valid(token_hash, candidate)
    }

    pub async fn totp_begin(&self, actor: &Actor) -> AppResult<(String, String)> {
        let secret = self.totp.new_secret();
        let issuer = self.settings.company().await?.name;
        let uri = self.totp.provisioning_uri(&secret, &actor.email, &issuer)?;
        self.users
            .set_totp(&actor.user_id, Some(&secret), false)
            .await?;
        Ok((secret, uri))
    }

    pub async fn totp_confirm(
        &self,
        actor: &Actor,
        code: &str,
        meta: &RequestMeta,
    ) -> AppResult<()> {
        self.limit(format!("totp:{}", actor.user_id), 5, 300)?;
        let user = self
            .users
            .get(&actor.user_id)
            .await?
            .ok_or(AppError::Unauthorized)?;
        let secret = user
            .totp_secret
            .ok_or_else(|| AppError::validation("Önce kurulum başlatın."))?;
        if !self.totp.verify(&secret, code, self.clock.now()) {
            return Err(AppError::validation("Kod hatalı."));
        }
        self.users.set_totp(&user.id, Some(&secret), true).await?;
        self.audit.user_at(&user.id, meta, "totp.enabled", "").await
    }

    pub async fn totp_disable(
        &self,
        actor: &Actor,
        password: &str,
        meta: &RequestMeta,
    ) -> AppResult<()> {
        self.limit(format!("totp:{}", actor.user_id), 5, 300)?;
        let user = self
            .users
            .get(&actor.user_id)
            .await?
            .ok_or(AppError::Unauthorized)?;
        if !self.hasher.verify(&user.password_hash, password) {
            return Err(AppError::validation("Mevcut şifre hatalı."));
        }
        self.users.set_totp(&user.id, None, false).await?;
        self.audit
            .user_at(&user.id, meta, "totp.disabled", "")
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::lockout_seconds;

    #[test]
    fn lockout_grows_and_is_bounded() {
        assert_eq!(lockout_seconds(4), 0);
        assert_eq!(lockout_seconds(5), 60);
        assert_eq!(lockout_seconds(6), 120);
        assert_eq!(lockout_seconds(50), 3600);
    }
}
