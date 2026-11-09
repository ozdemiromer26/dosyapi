use crate::error::{AppError, AppResult};
use crate::model::*;
use crate::ports::*;
use crate::services::audit::Auditor;
use crate::validate;
use std::sync::Arc;

const CONTEXTS: &[&str] = &["project", "authors", "contractor"];
const MAX_HTML: usize = 512 * 1024;

/// Yazı tipi değeri CSS içine yazılır; yalnızca güvenli karakterlere izin verilir.
fn safe_font(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 120
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, ' ' | ',' | '\'' | '-'))
}

#[derive(Clone)]
pub struct TemplateService {
    pub templates: Arc<dyn TemplateRepo>,
    pub sanitizer: Arc<dyn HtmlSanitizer>,
    pub clock: Arc<dyn Clock>,
    pub audit: Auditor,
}

impl TemplateService {
    /// Şablonu doğrular ve HTML içeriğini kaydetmeden önce temizler (kalıcı XSS engeli).
    pub fn normalize(&self, template: Template, now: Timestamp) -> AppResult<Template> {
        let name = validate::required(&template.name, "Şablon adı", 160)?;
        if template.contexts.is_empty() {
            return Err(AppError::validation("En az bir kullanım yeri seçin."));
        }
        if template
            .contexts
            .iter()
            .any(|c| !CONTEXTS.contains(&c.as_str()))
        {
            return Err(AppError::validation("Geçersiz kullanım yeri."));
        }
        if !["A4", "A5", "Letter"].contains(&template.size.as_str()) {
            return Err(AppError::validation("Geçersiz kağıt boyutu."));
        }
        if !["portrait", "landscape"].contains(&template.orient.as_str()) {
            return Err(AppError::validation("Geçersiz sayfa yönü."));
        }
        if !["left", "center", "right"].contains(&template.page_no_pos.as_str()) {
            return Err(AppError::validation("Geçersiz sayfa numarası konumu."));
        }
        if !safe_font(&template.font) {
            return Err(AppError::validation("Geçersiz yazı tipi."));
        }
        if !(6.0..=96.0).contains(&template.font_size) {
            return Err(AppError::validation(
                "Yazı boyutu 6 ile 96 arasında olmalı.",
            ));
        }
        let m = &template.margins;
        if [m.t, m.r, m.b, m.l]
            .iter()
            .any(|v| !(0.0..=100.0).contains(v))
        {
            return Err(AppError::validation(
                "Kenar boşlukları 0 ile 100 mm arasında olmalı.",
            ));
        }
        if [&template.header, &template.body, &template.footer]
            .iter()
            .any(|h| h.len() > MAX_HTML)
        {
            return Err(AppError::PayloadTooLarge(
                "Şablon içeriği çok büyük.".into(),
            ));
        }
        Ok(Template {
            name,
            header: self.sanitizer.sanitize(&template.header),
            body: self.sanitizer.sanitize(&template.body),
            footer: self.sanitizer.sanitize(&template.footer),
            updated: now,
            ..template
        })
    }

    pub async fn save(&self, actor: &Actor, template: Template) -> AppResult<Template> {
        if !actor.can_templates() {
            return Err(AppError::Forbidden);
        }
        let mut clean = self.normalize(template, self.clock.now())?;
        if clean.id.is_empty() {
            clean.id = new_id();
        } else {
            clean.id = validate::uuid(&clean.id)?;
        }
        self.templates.upsert(&clean).await?;
        self.audit
            .user(actor, "template.save", &clean.id, "")
            .await?;
        Ok(clean)
    }

    pub async fn delete(&self, actor: &Actor, id: &str) -> AppResult<()> {
        if !actor.can_templates() {
            return Err(AppError::Forbidden);
        }
        self.templates.get(id).await?.ok_or(AppError::NotFound)?;
        self.templates.delete(id).await?;
        self.audit.user(actor, "template.delete", id, "").await
    }
}
