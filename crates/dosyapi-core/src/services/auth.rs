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

/// Art arda hatalı girişte kilit basamakları: 3 hatada 5 dk, 6'da 15 dk, 9'da 60 dk,
/// 12'de süresiz (yalnızca sistem paneli açar). `None`: bu denemede yeni kilit yok;
/// `Some(None)`: süresiz kilit; `Some(Some(s))`: `s` saniyelik kilit.
pub fn lockout_for(failures: i64) -> Option<Option<i64>> {
    match failures {
        3 => Some(Some(5 * 60)),
        6 => Some(Some(15 * 60)),
        9 => Some(Some(60 * 60)),
        n if n >= 12 => Some(None),
        _ => None,
    }
}

/// Kilitli hesaba gösterilecek ileti.
pub fn lock_message(reason: LockReason, until: Option<Timestamp>, now: Timestamp) -> String {
    let left = until.map(|u| (u - now).max(1));
    let span = |secs: i64| {
        let mins = (secs + 59) / 60;
        if mins >= 120 {
            format!("{} saat", (mins + 59) / 60)
        } else {
            format!("{mins} dakika")
        }
    };
    match (reason, left) {
        (LockReason::Master, Some(s)) => format!(
            "Hesabınız sistem yöneticisi tarafından kilitlendi. Kalan süre: {}.",
            span(s)
        ),
        (LockReason::Master, None) => {
            "Hesabınız sistem yöneticisi tarafından kilitlendi. Yöneticinize başvurun.".into()
        }
        (_, Some(s)) => format!(
            "Art arda hatalı şifre girildiği için hesabınız kilitlendi. Kalan süre: {}.",
            span(s)
        ),
        (_, None) => "Art arda hatalı şifre girildiği için hesabınız süresiz kilitlendi. Kilidi sistem yöneticisi açabilir.".into(),
    }
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
        if user.lock_active(now) {
            self.hasher.burn(password);
            return Err(AppError::Locked(lock_message(
                user.lock_reason,
                user.locked_until,
                now,
            )));
        }
        if !self.hasher.verify(&user.password_hash, password) {
            let failed = user.failed_logins + 1;
            self.audit
                .user_at(&user.id, meta, "login.failed", "")
                .await?;
            let Some(lock) = lockout_for(failed) else {
                self.users
                    .set_login_state(&user.id, failed, LockReason::None, None)
                    .await?;
                return Err(AppError::InvalidCredentials);
            };
            let until = lock.map(|secs| now + secs);
            self.users
                .set_login_state(&user.id, failed, LockReason::Auto, until)
                .await?;
            let detail = until.map_or("süresiz".to_string(), |u| format!("{} sn", u - now));
            self.audit
                .user_at(&user.id, meta, "login.locked", &detail)
                .await?;
            return Err(AppError::Locked(lock_message(LockReason::Auto, until, now)));
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
            if !self
                .second_factor(&user.id, secret, code, now, meta)
                .await?
            {
                self.audit
                    .user_at(&user.id, meta, "login.totp_failed", "")
                    .await?;
                return Err(AppError::InvalidCredentials);
            }
        }
        self.users
            .set_login_state(&user.id, 0, LockReason::None, None)
            .await?;
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
            lock_reason: LockReason::None,
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
        // Sıfırlama süreli otomatik kilidi kaldırır; süresiz kilit ve yönetici yasağı ise
        // yalnızca sistem panelinden kalkar (şifreyi bilen saldırgan da sıfırlayamaz).
        let now = self.clock.now();
        let keep = user.lock_active(now)
            && (user.lock_reason == LockReason::Master || user.locked_until.is_none());
        if !keep {
            self.users
                .set_login_state(&user.id, 0, LockReason::None, None)
                .await?;
        }
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
        self.resolve(self.token_service.hash(token), true).await
    }

    /// Uzun süren bağlantılar (canlı güncelleme akışı) için oturumun hâlâ geçerli olup
    /// olmadığını denetler. Oturumu tazelemez: açık bir sekme boşta kalma süresini uzatmaz.
    pub async fn session_alive(&self, token_hash: &[u8]) -> bool {
        self.resolve(token_hash.to_vec(), false).await.is_ok()
    }

    async fn resolve(&self, token_hash: Vec<u8>, touch: bool) -> AppResult<Authenticated> {
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
        if user.status != UserStatus::Active
            || (user.lock_reason == LockReason::Master && user.lock_active(now))
        {
            return Err(AppError::Unauthorized);
        }
        let role_id = user.role_id.as_deref().ok_or(AppError::Unauthorized)?;
        let role = self
            .roles
            .get(role_id)
            .await?
            .ok_or(AppError::Unauthorized)?;
        if touch && now - session.last_seen_at >= 60 {
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

    /// İkinci adım: 6 haneli kod tek kullanımlıktır (zaman adımı yalnızca ileri gider);
    /// kurtarma kodu biçimindeki giriş tek seferde silinerek tüketilir.
    async fn second_factor(
        &self,
        user_id: &str,
        secret: &str,
        code: &str,
        now: Timestamp,
        meta: &RequestMeta,
    ) -> AppResult<bool> {
        if let Some(normalized) = recovery_shape(code) {
            let used = self
                .users
                .consume_recovery(user_id, &recovery_hash(user_id, &normalized))
                .await?;
            if used {
                self.audit
                    .user_at(user_id, meta, "login.recovery_used", "")
                    .await?;
            }
            return Ok(used);
        }
        match self.totp.verify(secret, code, now) {
            Some(step) => self.users.advance_totp_step(user_id, step).await,
            None => Ok(false),
        }
    }

    async fn issue_recovery(&self, user_id: &str) -> AppResult<Vec<String>> {
        let codes = self.totp.recovery_codes(RECOVERY_COUNT);
        let hashes: Vec<String> = codes
            .iter()
            .filter_map(|c| recovery_shape(c).map(|n| recovery_hash(user_id, &n)))
            .collect();
        self.users.replace_recovery(user_id, &hashes).await?;
        Ok(codes)
    }

    pub async fn recovery_left(&self, user_id: &str) -> AppResult<i64> {
        self.users.count_recovery(user_id).await
    }

    /// Yeni kurtarma kodları üretir; eskilerin hepsi geçersiz olur. Mevcut şifre gerekir.
    pub async fn totp_recovery_regenerate(
        &self,
        actor: &Actor,
        password: &str,
        meta: &RequestMeta,
    ) -> AppResult<Vec<String>> {
        self.limit(format!("totp:{}", actor.user_id), 5, 300)?;
        let user = self
            .users
            .get(&actor.user_id)
            .await?
            .ok_or(AppError::Unauthorized)?;
        if !self.hasher.verify(&user.password_hash, password) {
            return Err(AppError::validation("Mevcut şifre hatalı."));
        }
        if !user.totp_enabled {
            return Err(AppError::conflict("İki adımlı doğrulama kapalı."));
        }
        let codes = self.issue_recovery(&user.id).await?;
        self.audit
            .user_at(&user.id, meta, "totp.recovery_regenerated", "")
            .await?;
        Ok(codes)
    }

    pub async fn totp_begin(&self, actor: &Actor) -> AppResult<(String, String)> {
        // Açıkken yeniden kurulum, şifre sormadan doğrulamayı kapatmak demek olurdu.
        let enabled = self
            .users
            .get(&actor.user_id)
            .await?
            .is_some_and(|u| u.totp_enabled);
        if enabled {
            return Err(AppError::conflict(
                "İki adımlı doğrulama zaten açık; yeniden kurmak için önce kapatın.",
            ));
        }
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
    ) -> AppResult<Vec<String>> {
        self.limit(format!("totp:{}", actor.user_id), 5, 300)?;
        let user = self
            .users
            .get(&actor.user_id)
            .await?
            .ok_or(AppError::Unauthorized)?;
        if user.totp_enabled {
            return Err(AppError::conflict("İki adımlı doğrulama zaten açık."));
        }
        let secret = user
            .totp_secret
            .ok_or_else(|| AppError::validation("Önce kurulum başlatın."))?;
        let step = self
            .totp
            .verify(&secret, code, self.clock.now())
            .ok_or_else(|| AppError::validation("Kod hatalı."))?;
        self.users.set_totp(&user.id, Some(&secret), true).await?;
        // Kurulumda kullanılan kod girişte bir daha geçmez.
        self.users.advance_totp_step(&user.id, step).await?;
        let codes = self.issue_recovery(&user.id).await?;
        self.audit
            .user_at(&user.id, meta, "totp.enabled", "")
            .await?;
        Ok(codes)
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

/// Açılışta verilen kurtarma kodu sayısı.
pub const RECOVERY_COUNT: usize = 10;

/// Kurtarma kodu biçimi: tire ve boşluklar hariç 12 harf/rakam, en az bir harf
/// (yalnızca rakamdan oluşan giriş 6 haneli TOTP kodu sayılır). Küçük harfe çevrilmiş hâli döner.
fn recovery_shape(code: &str) -> Option<String> {
    if code.len() > 40 {
        return None;
    }
    let n: String = code
        .chars()
        .filter(|c| *c != '-' && !c.is_whitespace())
        .map(|c| c.to_ascii_lowercase())
        .collect();
    let ok = n.len() == 12
        && n.chars().all(|c| c.is_ascii_alphanumeric())
        && n.chars().any(|c| c.is_ascii_alphabetic());
    ok.then_some(n)
}

/// Kullanıcıya bağlı özet: aynı kod başka bir hesapta işe yaramaz. Kodlar ~59 bit rastgele
/// olduğu için yavaş özet gerekmez; deneme sayısı da oran sınırıyla kısıtlı.
fn recovery_hash(user_id: &str, normalized: &str) -> String {
    use sha2::{Digest, Sha256};
    let digest = Sha256::digest(format!("dosyapi-recovery:{user_id}:{normalized}").as_bytes());
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::{lock_message, lockout_for, recovery_hash, recovery_shape};
    use crate::model::LockReason;

    #[test]
    fn recovery_codes_are_normalized_and_bound_to_user() {
        assert_eq!(
            recovery_shape("AB3D-EF4H-JK5M").as_deref(),
            Some("ab3def4hjk5m")
        );
        assert_eq!(
            recovery_shape(" ab3d ef4h jk5m ").as_deref(),
            Some("ab3def4hjk5m")
        );
        // Yalnızca rakam: TOTP kodu sayılır, kurtarma kodu değil.
        assert!(recovery_shape("123456789012").is_none());
        assert!(recovery_shape("123456").is_none());
        assert!(recovery_shape("ab3d-ef4h").is_none());
        assert!(recovery_shape("ab3d-ef4h-jk5m'--").is_none());
        assert_ne!(
            recovery_hash("u1", "ab3def4hjk5m"),
            recovery_hash("u2", "ab3def4hjk5m")
        );
    }

    #[test]
    fn lockout_steps() {
        assert_eq!(lockout_for(1), None);
        assert_eq!(lockout_for(2), None);
        assert_eq!(lockout_for(3), Some(Some(300)));
        assert_eq!(lockout_for(4), None);
        assert_eq!(lockout_for(6), Some(Some(900)));
        assert_eq!(lockout_for(9), Some(Some(3600)));
        assert_eq!(lockout_for(12), Some(None));
        assert_eq!(lockout_for(40), Some(None));
    }

    #[test]
    fn lock_messages_round_up() {
        assert!(lock_message(LockReason::Auto, Some(1_000 + 299), 1_000).contains("5 dakika"));
        assert!(lock_message(LockReason::Auto, None, 0).contains("süresiz"));
        assert!(lock_message(LockReason::Master, Some(3 * 3600), 0).contains("3 saat"));
        assert!(lock_message(LockReason::Master, None, 0).contains("yöneticisi"));
    }
}
