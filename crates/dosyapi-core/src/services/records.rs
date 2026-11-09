use crate::error::{AppError, AppResult};
use crate::model::*;
use crate::ports::*;
use crate::services::changes::*;
use std::sync::Arc;

#[derive(Clone)]
pub struct RecordService {
    pub gate: ChangeGate,
    pub authors: Arc<dyn AuthorRepo>,
    pub contractors: Arc<dyn ContractorRepo>,
    pub projects: Arc<dyn ProjectRepo>,
    pub professions: Arc<dyn ProfessionRepo>,
    pub pendings: Arc<dyn PendingRepo>,
}

fn change(
    kind: PendingKind,
    entity: Entity,
    title: String,
    detail: String,
    payload: PendingPayload,
) -> Change {
    Change {
        kind,
        entity,
        title,
        detail,
        payload,
        doc_key: None,
        file_name: None,
    }
}

impl RecordService {
    async fn check_job(&self, job: &str) -> AppResult<()> {
        if self.professions.list().await?.iter().any(|p| p.name == job) {
            return Ok(());
        }
        Err(AppError::validation(
            "Meslek seçin (şirket ayarlarında tanımlı listeden).",
        ))
    }

    fn require_write(actor: &Actor) -> AppResult<AccessMode> {
        let mode = actor.record_mode();
        if mode.can_write() {
            Ok(mode)
        } else {
            Err(AppError::Forbidden)
        }
    }

    pub async fn create_author(
        &self,
        actor: &Actor,
        input: AuthorInput,
    ) -> AppResult<(Id, Submitted)> {
        let mode = Self::require_write(actor)?;
        let input = normalize_author(&input)?;
        self.check_job(&input.job).await?;
        let id = new_id();
        let item = change(
            PendingKind::Create,
            Entity::Author,
            format!("Yeni müellif: {} {}", input.first, input.last),
            format!("{} · {}", input.job, input.company),
            PendingPayload::AuthorCreate {
                id: id.clone(),
                input,
            },
        );
        Ok((id, self.gate.submit(actor, mode, item).await?))
    }

    pub async fn update_author(
        &self,
        actor: &Actor,
        id: &str,
        input: AuthorInput,
    ) -> AppResult<Submitted> {
        let mode = Self::require_write(actor)?;
        let current = self.authors.get(id).await?.ok_or(AppError::NotFound)?;
        ensure_unlocked(self.pendings.as_ref(), id).await?;
        let input = normalize_author(&input)?;
        self.check_job(&input.job).await?;
        let patch = diff(&current.input(), &input)?;
        if patch.fields.is_empty() {
            return Ok(Submitted::Applied);
        }
        let item = change(
            PendingKind::Update,
            Entity::Author,
            format!("Müellif düzenleme: {} {}", input.first, input.last),
            format!("Değişen: {}", field_labels(&patch.fields)),
            PendingPayload::AuthorUpdate {
                id: id.to_string(),
                input,
                patch,
            },
        );
        self.gate.submit(actor, mode, item).await
    }

    pub async fn delete_author(&self, actor: &Actor, id: &str) -> AppResult<Submitted> {
        let mode = Self::require_write(actor)?;
        let author = self.authors.get(id).await?.ok_or(AppError::NotFound)?;
        ensure_unlocked(self.pendings.as_ref(), id).await?;
        let item = change(
            PendingKind::Delete,
            Entity::Author,
            format!("Silme: {} {}", author.first, author.last),
            "Kayıt silme talebi".into(),
            PendingPayload::AuthorDelete { id: id.to_string() },
        );
        self.gate.submit(actor, mode, item).await
    }

    pub async fn create_contractor(
        &self,
        actor: &Actor,
        input: ContractorInput,
    ) -> AppResult<(Id, Submitted)> {
        let mode = Self::require_write(actor)?;
        let input = normalize_contractor(&input)?;
        let id = new_id();
        let item = change(
            PendingKind::Create,
            Entity::Contractor,
            format!("Yeni müteahhit: {}", input.title),
            format!("{} · Sınıf {}", input.owner, input.rank),
            PendingPayload::ContractorCreate {
                id: id.clone(),
                input,
            },
        );
        Ok((id, self.gate.submit(actor, mode, item).await?))
    }

    pub async fn update_contractor(
        &self,
        actor: &Actor,
        id: &str,
        input: ContractorInput,
    ) -> AppResult<Submitted> {
        let mode = Self::require_write(actor)?;
        let current = self.contractors.get(id).await?.ok_or(AppError::NotFound)?;
        ensure_unlocked(self.pendings.as_ref(), id).await?;
        let input = normalize_contractor(&input)?;
        let patch = diff(&current.input(), &input)?;
        if patch.fields.is_empty() {
            return Ok(Submitted::Applied);
        }
        let item = change(
            PendingKind::Update,
            Entity::Contractor,
            format!("Müteahhit düzenleme: {}", input.title),
            format!("Değişen: {}", field_labels(&patch.fields)),
            PendingPayload::ContractorUpdate {
                id: id.to_string(),
                input,
                patch,
            },
        );
        self.gate.submit(actor, mode, item).await
    }

    pub async fn delete_contractor(&self, actor: &Actor, id: &str) -> AppResult<Submitted> {
        let mode = Self::require_write(actor)?;
        let contractor = self.contractors.get(id).await?.ok_or(AppError::NotFound)?;
        ensure_unlocked(self.pendings.as_ref(), id).await?;
        if self.projects.uses_contractor(id).await? {
            return Err(AppError::conflict(
                "Bu müteahhit projelerde kullanılıyor; önce projelerden kaldırın.",
            ));
        }
        let item = change(
            PendingKind::Delete,
            Entity::Contractor,
            format!("Silme: {}", contractor.title),
            "Kayıt silme talebi".into(),
            PendingPayload::ContractorDelete { id: id.to_string() },
        );
        self.gate.submit(actor, mode, item).await
    }
}
