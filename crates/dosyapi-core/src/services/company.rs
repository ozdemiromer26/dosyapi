//! Şirket kimliği, e-posta alan adları, belge türleri ve meslekler.

use crate::error::{AppError, AppResult};
use crate::model::*;
use crate::ports::*;
use crate::services::audit::Auditor;
use crate::services::files::{MAX_LOGO_BYTES, logo_mime};
use crate::services::settings::*;
use crate::validate;
use serde::Deserialize;
use std::sync::Arc;

const LOGO_KEY: &str = "logo";
const KEY_LOGO_MIME: &str = "company.logoMime";

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct IdentityInput {
    pub name: String,
    #[serde(default)]
    pub desc: String,
    pub pri: String,
}

#[derive(Clone)]
pub struct CompanyService {
    pub settings: Settings,
    pub doc_types: Arc<dyn DocTypeRepo>,
    pub professions: Arc<dyn ProfessionRepo>,
    pub users: Arc<dyn UserRepo>,
    pub store: Arc<dyn FileStore>,
    pub audit: Auditor,
}

impl CompanyService {
    pub async fn save_identity(&self, input: IdentityInput, meta: &RequestMeta) -> AppResult<()> {
        let mut company = self.settings.company().await?;
        company.name = validate::required(&input.name, "Şirket adı", 160)?;
        company.desc = validate::text(&input.desc, "Kısa açıklama", 500)?;
        let palette = Palette {
            pri: validate::hex_color(&input.pri)?,
        };
        self.settings.set_json(KEY_COMPANY, &company).await?;
        self.settings.set_json(KEY_PALETTE, &palette).await?;
        self.audit.master(meta, "company.identity", "", "").await
    }

    pub async fn save_notice(&self, text: &str, meta: &RequestMeta) -> AppResult<()> {
        let text = validate::multiline(text, "Aydınlatma metni", 20_000)?;
        self.settings.set_json(KEY_NOTICE, &text).await?;
        self.audit.master(meta, "legal.notice", "", "").await
    }

    /// SVG kabul edilmez: içinde betik taşıyabilir.
    pub async fn save_logo(&self, bytes: &[u8], meta: &RequestMeta) -> AppResult<()> {
        if bytes.len() > MAX_LOGO_BYTES {
            return Err(AppError::PayloadTooLarge(
                "Logo en fazla 2 MB olabilir.".into(),
            ));
        }
        let mime = logo_mime(bytes)
            .ok_or_else(|| AppError::validation("Logo PNG, JPEG veya WEBP olmalı."))?;
        self.store.put_small(LOGO_KEY, bytes).await?;
        self.settings.set_json(KEY_LOGO_MIME, &mime).await?;
        let mut company = self.settings.company().await?;
        company.has_logo = true;
        self.settings.set_json(KEY_COMPANY, &company).await?;
        self.audit.master(meta, "company.logo", "", "").await
    }

    pub async fn clear_logo(&self, meta: &RequestMeta) -> AppResult<()> {
        let mut company = self.settings.company().await?;
        company.has_logo = false;
        self.settings.set_json(KEY_COMPANY, &company).await?;
        self.store.delete(LOGO_KEY).await?;
        self.settings.remove(KEY_LOGO_MIME).await?;
        self.audit
            .master(meta, "company.logo_removed", "", "")
            .await
    }

    pub async fn logo(&self) -> AppResult<Option<(Vec<u8>, String)>> {
        let Some(mime) = self.settings.get_json::<String>(KEY_LOGO_MIME).await? else {
            return Ok(None);
        };
        Ok(self
            .store
            .get_small(LOGO_KEY)
            .await?
            .map(|bytes| (bytes, mime)))
    }

    async fn conflicts(&self, domains: &[String]) -> AppResult<Vec<User>> {
        Ok(self
            .users
            .list()
            .await?
            .into_iter()
            .filter(|u| !domains.contains(&validate::email_domain(&u.email)))
            .collect())
    }

    pub async fn add_domain(&self, domain: &str, meta: &RequestMeta) -> AppResult<()> {
        let domain = validate::domain(domain)?;
        let mut domains = self.settings.domains().await?;
        if domains.contains(&domain) {
            return Err(AppError::conflict("Bu alan adı zaten listede."));
        }
        if domains.len() >= 50 {
            return Err(AppError::validation("En fazla 50 alan adı eklenebilir."));
        }
        domains.push(domain.clone());
        self.settings.set_json(KEY_DOMAINS, &domains).await?;
        self.audit
            .master(meta, "email.domain_added", &domain, "")
            .await
    }

    pub async fn remove_domain(&self, domain: &str, meta: &RequestMeta) -> AppResult<()> {
        let mut domains = self.settings.domains().await?;
        domains.retain(|d| d != domain);
        if self.settings.domain_lock().await? {
            if domains.is_empty() {
                return Err(AppError::conflict(
                    "Kısıtlama açıkken son alan adı silinemez.",
                ));
            }
            if !self.conflicts(&domains).await?.is_empty() {
                return Err(AppError::conflict("Bu alan adını kullanan hesaplar var."));
            }
        }
        self.settings.set_json(KEY_DOMAINS, &domains).await?;
        self.audit
            .master(meta, "email.domain_removed", domain, "")
            .await
    }

    pub async fn set_domain_lock(&self, on: bool, meta: &RequestMeta) -> AppResult<()> {
        if on {
            let domains = self.settings.domains().await?;
            if domains.is_empty() {
                return Err(AppError::validation(
                    "Kısıtlamayı açmak için en az bir alan adı ekleyin.",
                ));
            }
            if !self.conflicts(&domains).await?.is_empty() {
                return Err(AppError::conflict(
                    "Listede olmayan alan adı kullanan hesaplar var; önce bu hesapları silin veya e-postalarını değiştirin.",
                ));
            }
        }
        self.settings.set_json(KEY_DOMAIN_LOCK, &on).await?;
        self.audit
            .master(meta, "email.domain_lock", if on { "on" } else { "off" }, "")
            .await
    }

    pub async fn domain_conflicts(&self) -> AppResult<Vec<(Id, String, String)>> {
        let domains = self.settings.domains().await?;
        if domains.is_empty() {
            return Ok(vec![]);
        }
        Ok(self
            .conflicts(&domains)
            .await?
            .into_iter()
            .map(|u| (u.id, u.name, u.email))
            .collect())
    }

    fn require(actor: &Actor) -> AppResult<()> {
        if actor.can_company() {
            Ok(())
        } else {
            Err(AppError::Forbidden)
        }
    }

    pub async fn add_doc_type(&self, actor: &Actor, input: DocTypeInput) -> AppResult<DocType> {
        Self::require(actor)?;
        let doc_type = DocType {
            id: new_id(),
            name: validate::required(&input.name, "Belge adı", 160)?,
            required: input.required,
            accept: input.accept,
            multi: input.multi,
        };
        self.doc_types.insert(&doc_type).await?;
        self.audit
            .user(actor, "doctype.add", &doc_type.id, "")
            .await?;
        Ok(doc_type)
    }

    pub async fn update_doc_type(
        &self,
        actor: &Actor,
        id: &str,
        input: DocTypeInput,
    ) -> AppResult<()> {
        Self::require(actor)?;
        self.doc_types.get(id).await?.ok_or(AppError::NotFound)?;
        self.doc_types
            .update(&DocType {
                id: id.to_string(),
                name: validate::required(&input.name, "Belge adı", 160)?,
                required: input.required,
                accept: input.accept,
                multi: input.multi,
            })
            .await?;
        self.audit.user(actor, "doctype.update", id, "").await
    }

    pub async fn delete_doc_type(&self, actor: &Actor, id: &str) -> AppResult<()> {
        Self::require(actor)?;
        self.doc_types.get(id).await?.ok_or(AppError::NotFound)?;
        self.doc_types.delete(id).await?;
        self.audit.user(actor, "doctype.delete", id, "").await
    }

    pub async fn save_profession(
        &self,
        actor: &Actor,
        name: &str,
        required: bool,
    ) -> AppResult<()> {
        Self::require(actor)?;
        let name = validate::required(name, "Meslek", 100)?;
        self.professions
            .upsert(&Profession {
                name: name.clone(),
                required,
            })
            .await?;
        self.audit.user(actor, "profession.save", &name, "").await
    }

    pub async fn delete_profession(&self, actor: &Actor, name: &str) -> AppResult<()> {
        Self::require(actor)?;
        self.professions.delete(name).await?;
        self.audit.user(actor, "profession.delete", name, "").await
    }
}
