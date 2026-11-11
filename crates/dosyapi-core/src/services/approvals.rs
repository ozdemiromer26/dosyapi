use crate::error::{AppError, AppResult};
use crate::model::*;
use crate::policy;
use crate::ports::*;
use crate::services::audit::Auditor;
use crate::services::changes::ChangeApplier;
use std::sync::Arc;

#[derive(Clone)]
pub struct ApprovalService {
    pub pendings: Arc<dyn PendingRepo>,
    pub history: Arc<dyn HistoryRepo>,
    pub outcomes: Arc<dyn OutcomeRepo>,
    pub users: Arc<dyn UserRepo>,
    pub roles: Arc<dyn RoleRepo>,
    pub sessions: Arc<dyn SessionRepo>,
    pub files: Arc<dyn FileRepo>,
    pub store: Arc<dyn FileStore>,
    pub applier: ChangeApplier,
    pub clock: Arc<dyn Clock>,
    pub audit: Auditor,
}

impl ApprovalService {
    async fn close(&self, actor: &Actor, pending: &Pending, ok: bool) -> AppResult<()> {
        self.pendings.delete(&pending.id).await?;
        // Kayıt talebinde talep eden henüz bir hesap değil; diğerlerinde sonuç ona gösterilir.
        if pending.kind != PendingKind::UserApprove {
            self.outcomes
                .insert(&RequestOutcome {
                    id: new_id(),
                    by_id: pending.by_id.clone(),
                    kind: pending.kind,
                    entity: pending.entity,
                    title: pending.title.clone(),
                    detail: pending.detail.clone(),
                    sent_at: pending.when,
                    decided_at: self.clock.now(),
                    decider: actor.name.clone(),
                    approved: ok,
                })
                .await?;
        }
        self.history
            .insert(&HistoryEntry {
                id: new_id(),
                text: format!(
                    "{} {}",
                    pending.title,
                    if ok { "onaylandı" } else { "reddedildi" }
                ),
                when: self.clock.now(),
                ok,
            })
            .await
    }

    pub async fn approve(&self, actor: &Actor, id: &str, role_id: Option<&str>) -> AppResult<()> {
        let pending = self.pendings.get(id).await?.ok_or(AppError::NotFound)?;
        if !policy::can_decide_pending(actor, &pending) {
            return Err(AppError::Forbidden);
        }
        match &pending.payload {
            PendingPayload::UserApprove { id: user_id } => {
                let roles = self.roles.list().await?;
                let allowed = policy::manageable_roles(actor, &roles);
                let role = match role_id {
                    Some(rid) => allowed.iter().find(|r| r.id == rid),
                    None => allowed.first(),
                }
                .ok_or_else(|| AppError::validation("Atanabilir rol yok."))?;
                self.users
                    .set_role(user_id, Some(&role.id), UserStatus::Active)
                    .await?;
            }
            PendingPayload::UserDelete { id: user_id } => {
                let target = self.users.get(user_id).await?.ok_or(AppError::NotFound)?;
                let role = match &target.role_id {
                    Some(rid) => self.roles.get(rid).await?,
                    None => None,
                };
                if !policy::can_manage_user(actor, role.as_ref()) {
                    return Err(AppError::Forbidden);
                }
                self.sessions.delete_for_user(user_id, None).await?;
                self.users.delete(user_id).await?;
            }
            payload => self.applier.apply(payload).await?,
        }
        self.close(actor, &pending, true).await?;
        self.audit
            .user(actor, "approval.approved", &pending.title, "")
            .await
    }

    pub async fn reject(&self, actor: &Actor, id: &str) -> AppResult<()> {
        let pending = self.pendings.get(id).await?.ok_or(AppError::NotFound)?;
        if !policy::can_decide_pending(actor, &pending) {
            return Err(AppError::Forbidden);
        }
        match &pending.payload {
            PendingPayload::UserApprove { id: user_id } => self.users.delete(user_id).await?,
            PendingPayload::FileAdd { file_id, .. } => {
                self.files.delete(file_id).await?;
                self.store.delete(file_id).await?;
            }
            _ => {}
        }
        self.close(actor, &pending, false).await?;
        self.audit
            .user(actor, "approval.rejected", &pending.title, "")
            .await
    }

    /// Talep eden, karar verilmemiş kendi talebini geri çeker. Başkasının talebi "yok" sayılır.
    pub async fn withdraw(&self, actor: &Actor, id: &str) -> AppResult<()> {
        let pending = self
            .pendings
            .get(id)
            .await?
            .filter(|p| p.by_id == actor.user_id && p.kind != PendingKind::UserApprove)
            .ok_or(AppError::NotFound)?;
        if let PendingPayload::FileAdd { file_id, .. } = &pending.payload {
            self.files.delete(file_id).await?;
            self.store.delete(file_id).await?;
        }
        self.pendings.delete(&pending.id).await?;
        self.history
            .insert(&HistoryEntry {
                id: new_id(),
                text: format!("{} geri çekildi", pending.title),
                when: self.clock.now(),
                ok: false,
            })
            .await?;
        self.audit
            .user(actor, "approval.withdrawn", &pending.title, "")
            .await
    }

    pub async fn sent_outcomes(&self, actor: &Actor) -> AppResult<Vec<RequestOutcome>> {
        self.outcomes.list_for(&actor.user_id, 30).await
    }
}
