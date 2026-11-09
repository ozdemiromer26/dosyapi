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
    async fn close(&self, pending: &Pending, ok: bool) -> AppResult<()> {
        self.pendings.delete(&pending.id).await?;
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
        self.close(&pending, true).await?;
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
        self.close(&pending, false).await?;
        self.audit
            .user(actor, "approval.rejected", &pending.title, "")
            .await
    }
}
