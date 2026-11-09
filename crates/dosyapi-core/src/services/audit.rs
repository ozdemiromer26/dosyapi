use crate::error::AppResult;
use crate::model::{Actor, AuditEvent, RequestMeta};
use crate::ports::{AuditRepo, Clock};
use std::sync::Arc;

/// Denetim kaydını tek noktadan yazar. Kayıt yazılamazsa işlem başarısız sayılır:
/// izi kalmayan yetkili işlem olmamalı.
#[derive(Clone)]
pub struct Auditor {
    repo: Arc<dyn AuditRepo>,
    clock: Arc<dyn Clock>,
}

impl Auditor {
    pub fn new(repo: Arc<dyn AuditRepo>, clock: Arc<dyn Clock>) -> Self {
        Self { repo, clock }
    }

    async fn write(
        &self,
        kind: &str,
        id: &str,
        action: &str,
        target: &str,
        ip: &str,
        detail: &str,
    ) -> AppResult<()> {
        let event = AuditEvent {
            actor_kind: kind.into(),
            actor_id: id.into(),
            action: action.into(),
            target: target.into(),
            ip: ip.into(),
            detail: detail.into(),
        };
        self.repo.append(event, self.clock.now()).await
    }

    pub async fn user(
        &self,
        actor: &Actor,
        action: &str,
        target: &str,
        detail: &str,
    ) -> AppResult<()> {
        self.write("user", &actor.user_id, action, target, "", detail)
            .await
    }

    pub async fn user_at(
        &self,
        user_id: &str,
        meta: &RequestMeta,
        action: &str,
        detail: &str,
    ) -> AppResult<()> {
        self.write("user", user_id, action, user_id, &meta.ip, detail)
            .await
    }

    pub async fn master(
        &self,
        meta: &RequestMeta,
        action: &str,
        target: &str,
        detail: &str,
    ) -> AppResult<()> {
        self.write("master", "master", action, target, &meta.ip, detail)
            .await
    }

    pub async fn anonymous(&self, meta: &RequestMeta, action: &str, target: &str) -> AppResult<()> {
        self.write("anonymous", "", action, target, &meta.ip, "")
            .await
    }

    pub async fn system(&self, action: &str, detail: &str) -> AppResult<()> {
        self.write("system", "", action, "", "", detail).await
    }
}
