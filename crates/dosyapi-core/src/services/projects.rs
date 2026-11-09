use crate::error::{AppError, AppResult};
use crate::model::*;
use crate::ports::*;
use crate::services::changes::*;
use crate::validate;
use std::sync::Arc;

#[derive(Clone)]
pub struct ProjectService {
    pub gate: ChangeGate,
    pub projects: Arc<dyn ProjectRepo>,
    pub pendings: Arc<dyn PendingRepo>,
    pub authors: Arc<dyn AuthorRepo>,
    pub contractors: Arc<dyn ContractorRepo>,
    pub qr: Arc<dyn QrRenderer>,
}

impl ProjectService {
    async fn location_detail(&self, input: &ProjectInput) -> AppResult<String> {
        let contractor = self
            .contractors
            .get(&input.contractor_id)
            .await?
            .ok_or_else(|| AppError::validation("Seçilen müteahhit bulunamadı."))?;
        Ok(format!(
            "{} · Ada {}/Parsel {}",
            contractor.title, input.ada, input.parsel
        ))
    }

    pub async fn create(&self, actor: &Actor, input: ProjectInput) -> AppResult<(Id, Submitted)> {
        if !actor.project_mode().can_write() {
            return Err(AppError::Forbidden);
        }
        let mut input = normalize_project(&input)?;
        check_shares(&mut input.owners)?;
        let id = new_id();
        let change = Change {
            kind: PendingKind::Create,
            entity: Entity::Project,
            title: format!("Yeni proje: {}", input.name),
            detail: self.location_detail(&input).await?,
            payload: PendingPayload::ProjectCreate {
                id: id.clone(),
                input,
            },
            doc_key: None,
            file_name: None,
        };
        let submitted = self
            .gate
            .submit(actor, actor.project_mode(), change)
            .await?;
        Ok((id, submitted))
    }

    pub async fn update(
        &self,
        actor: &Actor,
        id: &str,
        input: ProjectInput,
    ) -> AppResult<Submitted> {
        if !actor.project_mode().can_write() {
            return Err(AppError::Forbidden);
        }
        let current = self.projects.get(id).await?.ok_or(AppError::NotFound)?;
        ensure_unlocked(self.pendings.as_ref(), id).await?;
        let mut input = normalize_project(&input)?;
        // Hisse denetimi yalnızca arsa sahipleri değiştiğinde: eski kayıttaki
        // hatalı hisse, ilgisiz bir alanın düzenlenmesini engellemez.
        if input.owners != current.owners {
            check_shares(&mut input.owners)?;
        }
        let patch = diff(&current.input(), &input)?;
        if patch.fields.is_empty() {
            return Ok(Submitted::Applied);
        }
        let change = Change {
            kind: PendingKind::Update,
            entity: Entity::Project,
            title: format!("Proje düzenleme: {}", input.name),
            detail: format!(
                "{} · Değişen: {}",
                self.location_detail(&input).await?,
                field_labels(&patch.fields)
            ),
            payload: PendingPayload::ProjectUpdate {
                id: id.to_string(),
                input,
                patch,
            },
            doc_key: None,
            file_name: None,
        };
        self.gate.submit(actor, actor.project_mode(), change).await
    }

    pub async fn delete(&self, actor: &Actor, id: &str) -> AppResult<Submitted> {
        if !actor.project_mode().can_write() {
            return Err(AppError::Forbidden);
        }
        let project = self.projects.get(id).await?.ok_or(AppError::NotFound)?;
        ensure_unlocked(self.pendings.as_ref(), id).await?;
        let change = Change {
            kind: PendingKind::Delete,
            entity: Entity::Project,
            title: format!("Silme: {}", project.name),
            detail: "Kayıt silme talebi".into(),
            payload: PendingPayload::ProjectDelete { id: id.to_string() },
            doc_key: None,
            file_name: None,
        };
        self.gate.submit(actor, actor.project_mode(), change).await
    }

    pub async fn assign_author(
        &self,
        actor: &Actor,
        id: &str,
        job: &str,
        author_id: &str,
    ) -> AppResult<Submitted> {
        if !actor.project_mode().can_write() {
            return Err(AppError::Forbidden);
        }
        let project = self.projects.get(id).await?.ok_or(AppError::NotFound)?;
        let job = validate::required(job, "Meslek", 100)?;
        let author_id = if author_id.is_empty() {
            String::new()
        } else {
            validate::uuid(author_id)?
        };
        let label = match self.authors.get(&author_id).await? {
            Some(a) => format!("{} {}", a.first, a.last),
            None => "—".to_string(),
        };
        let change = Change {
            kind: PendingKind::Update,
            entity: Entity::Project,
            title: format!("Müellif ataması: {job}"),
            detail: format!("{} · {label}", project.name),
            payload: PendingPayload::ProjectAuthor {
                id: id.to_string(),
                job,
                author_id,
            },
            doc_key: None,
            file_name: None,
        };
        self.gate.submit(actor, actor.project_mode(), change).await
    }

    /// Şantiye panosundaki QR: yalnızca projenin uygulamadaki adresini kodlar, veri içermez.
    pub async fn board_qr(&self, actor: &Actor, id: &str, public_url: &str) -> AppResult<String> {
        if !actor.project_mode().can_read() {
            return Err(AppError::Forbidden);
        }
        self.projects.get(id).await?.ok_or(AppError::NotFound)?;
        self.qr.svg(&format!(
            "{}/#/proje/{}",
            public_url.trim_end_matches('/'),
            id
        ))
    }
}
