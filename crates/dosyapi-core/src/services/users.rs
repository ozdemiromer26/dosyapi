use crate::error::{AppError, AppResult};
use crate::model::*;
use crate::policy;
use crate::ports::*;
use crate::services::audit::Auditor;
use crate::services::auth::{AuthService, INVITE_TTL};
use crate::services::mail::MailService;
use crate::services::settings::Settings;
use crate::validate;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProfileInput {
    pub name: String,
    pub email: String,
    #[serde(default)]
    pub phone: String,
    /// E-posta değişiyorsa zorunlu: oturumu ele geçiren hesabı devralamasın.
    #[serde(default)]
    pub current_password: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NewUserInput {
    pub name: String,
    pub email: String,
    pub role_id: Id,
}

/// Oluşturulan tek kullanımlık bağlantı. E-posta gönderilemediyse yöneticiye bir kez gösterilir.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IssuedLink {
    pub link: String,
    pub emailed: bool,
}

#[derive(Clone)]
pub struct UserService {
    pub users: Arc<dyn UserRepo>,
    pub roles: Arc<dyn RoleRepo>,
    pub pendings: Arc<dyn PendingRepo>,
    pub sessions: Arc<dyn SessionRepo>,
    pub hasher: Arc<dyn PasswordHasher>,
    pub tokens: Arc<dyn TokenService>,
    pub settings: Settings,
    pub mail: MailService,
    pub auth: AuthService,
    pub clock: Arc<dyn Clock>,
    pub audit: Auditor,
}

impl UserService {
    async fn role_of(&self, user: &User) -> AppResult<Option<Role>> {
        match &user.role_id {
            Some(id) => self.roles.get(id).await,
            None => Ok(None),
        }
    }

    async fn check_email(&self, email: &str, except: Option<&str>) -> AppResult<()> {
        if !self.settings.email_allowed(email).await? {
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
        if let Some(existing) = self.users.by_email(email).await?
            && except != Some(existing.id.as_str())
        {
            return Err(AppError::conflict("Bu e-posta zaten kayıtlı."));
        }
        Ok(())
    }

    pub async fn update_profile(
        &self,
        actor: &Actor,
        input: ProfileInput,
        meta: &RequestMeta,
    ) -> AppResult<()> {
        let name = validate::required(&input.name, "Ad soyad", 120)?;
        let email = validate::email(&input.email)?;
        let phone = validate::phone(&input.phone)?;
        self.check_email(&email, Some(&actor.user_id)).await?;
        if email != actor.email {
            let user = self
                .users
                .get(&actor.user_id)
                .await?
                .ok_or(AppError::Unauthorized)?;
            if !self
                .hasher
                .verify(&user.password_hash, &input.current_password)
            {
                return Err(AppError::validation(
                    "E-posta değişikliği için mevcut şifrenizi girin.",
                ));
            }
        }
        self.users
            .update_profile(&actor.user_id, &name, &email, &phone)
            .await?;
        self.audit
            .user_at(&actor.user_id, meta, "profile.update", "")
            .await
    }

    pub async fn request_self_delete(&self, actor: &Actor) -> AppResult<()> {
        if actor.is_top() {
            return Err(AppError::conflict(
                "Üst yönetici hesapları yalnızca sistem (master) panelinden silinebilir.",
            ));
        }
        let already = self.pendings.list().await?.iter().any(
            |p| matches!(&p.payload, PendingPayload::UserDelete { id } if id == &actor.user_id),
        );
        if already {
            return Err(AppError::conflict("Hesap silme talebiniz zaten iletildi."));
        }
        self.pendings
            .insert(&Pending {
                id: new_id(),
                kind: PendingKind::UserDelete,
                entity: Entity::User,
                payload: PendingPayload::UserDelete {
                    id: actor.user_id.clone(),
                },
                title: format!("Hesap silme talebi: {}", actor.name),
                detail: format!("{} · {}", actor.email, actor.role.name),
                by: actor.name.clone(),
                by_id: actor.user_id.clone(),
                when: self.clock.now(),
                min_level: policy::approver_level(actor),
                target_level: Some(actor.level()),
                doc_key: None,
                file_name: None,
            })
            .await?;
        self.audit
            .user(actor, "user.delete_requested", &actor.user_id, "")
            .await
    }

    /// Şirket ayarlarından rol değiştirme: kademe sınırları sunucuda uygulanır.
    pub async fn set_role(&self, actor: &Actor, id: &str, role_id: &str) -> AppResult<()> {
        if id == actor.user_id {
            return Err(AppError::Forbidden);
        }
        let target = self.users.get(id).await?.ok_or(AppError::NotFound)?;
        if !policy::can_manage_user(actor, self.role_of(&target).await?.as_ref()) {
            return Err(AppError::Forbidden);
        }
        let roles = self.roles.list().await?;
        if !policy::manageable_roles(actor, &roles)
            .iter()
            .any(|r| r.id == role_id)
        {
            return Err(AppError::Forbidden);
        }
        self.users
            .set_role(id, Some(role_id), UserStatus::Active)
            .await?;
        self.audit.user(actor, "user.role", id, role_id).await
    }

    pub async fn delete(&self, actor: &Actor, id: &str) -> AppResult<()> {
        if id == actor.user_id {
            return Err(AppError::Forbidden);
        }
        let target = self.users.get(id).await?.ok_or(AppError::NotFound)?;
        if !policy::can_manage_user(actor, self.role_of(&target).await?.as_ref()) {
            return Err(AppError::Forbidden);
        }
        self.sessions.delete_for_user(id, None).await?;
        self.users.delete(id).await?;
        self.audit.user(actor, "user.delete", id, "").await
    }

    async fn deliver_link(
        &self,
        email: &str,
        name: &str,
        link: String,
        subject: &str,
    ) -> AppResult<IssuedLink> {
        let body = format!(
            "Merhaba {name},\n\nHesabınız için şifre belirleme bağlantınız aşağıdadır. \
             Bağlantı tek kullanımlıktır ve süresi sınırlıdır:\n\n{link}\n"
        );
        let emailed = self.mail.send(email, subject, body).await.is_ok();
        Ok(IssuedLink {
            link: if emailed { String::new() } else { link },
            emailed,
        })
    }

    /// Sabit varsayılan şifre yerine tek kullanımlık davet bağlantısı üretilir.
    pub async fn master_add(
        &self,
        input: NewUserInput,
        meta: &RequestMeta,
    ) -> AppResult<IssuedLink> {
        let name = validate::required(&input.name, "Ad soyad", 120)?;
        let email = validate::email(&input.email)?;
        self.check_email(&email, None).await?;
        let role = self
            .roles
            .get(&input.role_id)
            .await?
            .ok_or(AppError::NotFound)?;
        let unusable = self.tokens.generate();
        let user = User {
            id: new_id(),
            name: name.clone(),
            email: email.clone(),
            phone: String::new(),
            password_hash: self.hasher.hash(&unusable)?,
            role_id: Some(role.id),
            status: UserStatus::Active,
            must_change_password: false,
            totp_secret: None,
            totp_enabled: false,
            failed_logins: 0,
            locked_until: None,
            notice_accepted_at: None,
            created_at: self.clock.now(),
        };
        self.users.insert(&user).await?;
        let link = self.auth.issue_reset_link(&user.id, INVITE_TTL).await?;
        self.audit.master(meta, "user.add", &user.id, "").await?;
        self.deliver_link(&email, &name, link, "Hesabınız oluşturuldu")
            .await
    }

    pub async fn master_set_role(
        &self,
        id: &str,
        role_id: &str,
        meta: &RequestMeta,
    ) -> AppResult<()> {
        self.users.get(id).await?.ok_or(AppError::NotFound)?;
        self.roles.get(role_id).await?.ok_or(AppError::NotFound)?;
        self.users
            .set_role(id, Some(role_id), UserStatus::Active)
            .await?;
        self.clear_pending_for(id).await?;
        self.audit.master(meta, "user.role", id, role_id).await
    }

    async fn clear_pending_for(&self, user_id: &str) -> AppResult<()> {
        for pending in self.pendings.list().await? {
            if matches!(&pending.payload, PendingPayload::UserApprove { id } if id == user_id) {
                self.pendings.delete(&pending.id).await?;
            }
        }
        Ok(())
    }

    pub async fn master_delete(&self, id: &str, meta: &RequestMeta) -> AppResult<()> {
        self.users.get(id).await?.ok_or(AppError::NotFound)?;
        self.sessions.delete_for_user(id, None).await?;
        self.clear_pending_for(id).await?;
        self.users.delete(id).await?;
        self.audit.master(meta, "user.delete", id, "").await
    }

    pub async fn master_reset_link(&self, id: &str, meta: &RequestMeta) -> AppResult<IssuedLink> {
        let user = self.users.get(id).await?.ok_or(AppError::NotFound)?;
        let link = self
            .auth
            .issue_reset_link(&user.id, crate::services::auth::RESET_TTL)
            .await?;
        self.sessions.delete_for_user(id, None).await?;
        self.audit.master(meta, "user.reset_link", id, "").await?;
        self.deliver_link(&user.email, &user.name, link, "Şifre sıfırlama")
            .await
    }

    pub async fn master_clear_totp(&self, id: &str, meta: &RequestMeta) -> AppResult<()> {
        self.users.get(id).await?.ok_or(AppError::NotFound)?;
        self.users.set_totp(id, None, false).await?;
        self.audit.master(meta, "user.totp_cleared", id, "").await
    }
}
