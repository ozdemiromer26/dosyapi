//! İlk kurulum. WordPress'in kurulum sihirbazı gibi, ama kurulum belirteciyle korunur:
//! belirteç yalnızca sunucu konsolunda görünür, böylece erken gelen biri kurulumu ele geçiremez.

use crate::error::{AppError, AppResult};
use crate::model::*;
use crate::password;
use crate::ports::*;
use crate::services::audit::Auditor;
use crate::services::settings::*;
use crate::services::templates::TemplateService;
use crate::validate;
use serde::Deserialize;
use std::sync::Arc;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SetupInput {
    pub setup_token: String,
    pub company_name: String,
    pub master_password: String,
    pub admin_name: String,
    pub admin_email: String,
    pub admin_password: String,
}

/// Kurulumda eklenen başlangıç verisi.
#[derive(Clone, Default)]
pub struct SeedData {
    pub templates: Vec<Template>,
}

#[derive(Clone)]
pub struct SetupService {
    pub settings: Settings,
    pub roles: Arc<dyn RoleRepo>,
    pub users: Arc<dyn UserRepo>,
    pub doc_types: Arc<dyn DocTypeRepo>,
    pub professions: Arc<dyn ProfessionRepo>,
    pub templates: Arc<dyn TemplateRepo>,
    pub template_service: TemplateService,
    pub hasher: Arc<dyn PasswordHasher>,
    pub tokens: Arc<dyn TokenService>,
    pub limiter: Arc<dyn RateLimiter>,
    pub clock: Arc<dyn Clock>,
    pub audit: Auditor,
    pub seed: SeedData,
    pub setup_token_hash: Vec<u8>,
}

fn default_roles() -> Vec<Role> {
    let site = new_id();
    let intern = new_id();
    vec![
        Role {
            id: new_id(),
            name: "Üst Yönetici".into(),
            level: 1,
            perms: Permissions::top(),
        },
        Role {
            id: new_id(),
            name: "Proje Yöneticisi".into(),
            level: 2,
            perms: Permissions {
                projects: AccessMode::Edit,
                records: AccessMode::Edit,
                company: true,
                users: true,
                approve: true,
                tasks: true,
                files: true,
                templates: true,
                manage: vec![site.clone(), intern.clone()],
            },
        },
        Role {
            id: site,
            name: "Saha Şefi".into(),
            level: 3,
            perms: Permissions {
                projects: AccessMode::Approve,
                records: AccessMode::Read,
                company: false,
                users: true,
                approve: false,
                tasks: true,
                files: true,
                templates: false,
                manage: vec![intern.clone()],
            },
        },
        Role {
            id: intern,
            name: "Stajyer".into(),
            level: 4,
            perms: Permissions::minimal(),
        },
    ]
}

impl SetupService {
    pub async fn required(&self) -> AppResult<bool> {
        Ok(!self.settings.setup_done().await?)
    }

    pub async fn complete(&self, input: SetupInput, meta: &RequestMeta) -> AppResult<()> {
        self.limiter
            .hit(&format!("setup-ip:{}", meta.ip), 10, 900)
            .map_err(|RetryAfter(s)| AppError::RateLimited {
                retry_after_secs: s,
            })?;
        if !self.required().await? {
            return Err(AppError::NotFound);
        }
        if !self.tokens.csrf_valid_raw(
            &self.tokens.hash(&input.setup_token),
            &self.setup_token_hash,
        ) {
            self.audit.anonymous(meta, "setup.bad_token", "").await?;
            return Err(AppError::Forbidden);
        }
        let company_name = validate::required(&input.company_name, "Şirket adı", 160)?;
        let admin_name = validate::required(&input.admin_name, "Ad soyad", 120)?;
        let admin_email = validate::email(&input.admin_email)?;
        password::check(&input.master_password, &[&company_name])?;
        password::check(&input.admin_password, &[&admin_email, &admin_name])?;
        if input.master_password == input.admin_password {
            return Err(AppError::validation(
                "Master şifre ile yönetici şifresi farklı olmalı.",
            ));
        }

        let roles = default_roles();
        for role in &roles {
            self.roles.insert(role).await?;
        }
        let top = roles
            .iter()
            .find(|r| r.level == 1)
            .ok_or_else(|| AppError::internal("üst rol yok"))?;
        self.users
            .insert(&User {
                id: new_id(),
                name: admin_name,
                email: admin_email,
                phone: String::new(),
                password_hash: self.hasher.hash(&input.admin_password)?,
                role_id: Some(top.id.clone()),
                status: UserStatus::Active,
                must_change_password: false,
                totp_secret: None,
                totp_enabled: false,
                failed_logins: 0,
                lock_reason: LockReason::None,
                locked_until: None,
                notice_accepted_at: None,
                created_at: self.clock.now(),
            })
            .await?;

        for (name, required, accept, multi) in [
            ("Tapu", true, DocAccept::Pdfimg, false),
            ("Mimari proje", true, DocAccept::Cad, true),
            ("İmar çapı", true, DocAccept::Pdf, false),
            ("Zemin etüdü", false, DocAccept::Pdf, false),
            ("Statik proje", false, DocAccept::All, true),
        ] {
            self.doc_types
                .insert(&DocType {
                    id: new_id(),
                    name: name.into(),
                    required,
                    accept,
                    multi,
                })
                .await?;
        }
        for name in [
            "Mimar",
            "İnşaat Mühendisi",
            "Makine Mühendisi",
            "Elektrik Mühendisi",
            "Harita Mühendisi",
        ] {
            self.professions
                .upsert(&Profession {
                    name: name.into(),
                    required: true,
                })
                .await?;
        }
        for template in &self.seed.templates {
            let mut clean = self
                .template_service
                .normalize(template.clone(), self.clock.now())?;
            clean.id = new_id();
            self.templates.upsert(&clean).await?;
        }

        let master_hash = self.hasher.hash(&input.master_password)?;
        self.settings
            .set_json(KEY_MASTER_HASH, &master_hash)
            .await?;
        self.settings
            .set_json(
                KEY_COMPANY,
                &Company {
                    name: company_name,
                    desc: String::new(),
                    has_logo: false,
                },
            )
            .await?;
        self.settings
            .set_json(KEY_PALETTE, &Palette::default())
            .await?;
        self.settings.set_json(KEY_SETUP_DONE, &true).await?;
        self.audit.anonymous(meta, "setup.completed", "").await
    }
}
