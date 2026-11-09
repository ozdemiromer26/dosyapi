use crate::crypto::Keyring;
use crate::db::db_err;
use async_trait::async_trait;
use dosyapi_core::error::{AppError, AppResult};
use dosyapi_core::model::{AuditEvent, AuditRecord, Timestamp};
use dosyapi_core::ports::AuditRepo;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use sqlx::{Row, SqlitePool};
use tokio::sync::Mutex;
use zeroize::Zeroizing;

/// Her kayıt önceki kaydın özetini anahtarlı olarak içerir. Veritabanına doğrudan
/// erişen biri kaydı değiştirirse ya da silerse zincir kırılır.
pub struct SqliteAudit {
    pool: SqlitePool,
    key: Zeroizing<[u8; 32]>,
    write: Mutex<()>,
}

impl SqliteAudit {
    pub fn new(pool: SqlitePool, keyring: &Keyring) -> Self {
        Self {
            pool,
            key: keyring.derive("audit-chain"),
            write: Mutex::new(()),
        }
    }

    #[allow(clippy::expect_used, clippy::too_many_arguments)]
    fn chain(
        &self,
        prev: &[u8],
        at: Timestamp,
        kind: &str,
        id: &str,
        action: &str,
        target: &str,
        ip: &str,
        detail: &str,
    ) -> Vec<u8> {
        let mut mac = <Hmac<Sha256> as hmac::KeyInit>::new_from_slice(self.key.as_slice())
            .expect("HMAC anahtarı");
        mac.update(prev);
        mac.update(&at.to_be_bytes());
        for field in [kind, id, action, target, ip, detail] {
            mac.update(&(field.len() as u64).to_be_bytes());
            mac.update(field.as_bytes());
        }
        mac.finalize().into_bytes().to_vec()
    }
}

#[async_trait]
impl AuditRepo for SqliteAudit {
    async fn append(&self, event: AuditEvent, at: Timestamp) -> AppResult<()> {
        let _guard = self.write.lock().await;
        let prev: Vec<u8> =
            sqlx::query_scalar("SELECT hash FROM audit_log ORDER BY seq DESC LIMIT 1")
                .fetch_optional(&self.pool)
                .await
                .map_err(db_err)?
                .unwrap_or_default();
        let hash = self.chain(
            &prev,
            at,
            &event.actor_kind,
            &event.actor_id,
            &event.action,
            &event.target,
            &event.ip,
            &event.detail,
        );
        sqlx::query(
            "INSERT INTO audit_log (at, actor_kind, actor_id, action, target, ip, detail, prev_hash, hash)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(at)
        .bind(&event.actor_kind)
        .bind(&event.actor_id)
        .bind(&event.action)
        .bind(&event.target)
        .bind(&event.ip)
        .bind(&event.detail)
        .bind(&prev)
        .bind(&hash)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn list(&self, limit: i64, before: Option<i64>) -> AppResult<Vec<AuditRecord>> {
        let rows = sqlx::query(
            "SELECT seq, at, actor_kind, actor_id, action, target, ip, detail, hash FROM audit_log
             WHERE seq < ? ORDER BY seq DESC LIMIT ?",
        )
        .bind(before.unwrap_or(i64::MAX))
        .bind(limit.clamp(1, 500))
        .fetch_all(&self.pool)
        .await
        .map_err(db_err)?;
        rows.into_iter()
            .map(|r| {
                Ok(AuditRecord {
                    seq: r.try_get("seq").map_err(db_err)?,
                    at: r.try_get("at").map_err(db_err)?,
                    actor_kind: r.try_get("actor_kind").map_err(db_err)?,
                    actor_id: r.try_get("actor_id").map_err(db_err)?,
                    action: r.try_get("action").map_err(db_err)?,
                    target: r.try_get("target").map_err(db_err)?,
                    ip: r.try_get("ip").map_err(db_err)?,
                    detail: r.try_get("detail").map_err(db_err)?,
                    hash: hex::encode(r.try_get::<Vec<u8>, _>("hash").map_err(db_err)?),
                })
            })
            .collect()
    }

    async fn verify(&self) -> AppResult<Option<i64>> {
        let rows = sqlx::query(
            "SELECT seq, at, actor_kind, actor_id, action, target, ip, detail, prev_hash, hash FROM audit_log ORDER BY seq",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(db_err)?;
        let mut prev: Vec<u8> = Vec::new();
        let mut next_seq: Option<i64> = None;
        for r in rows {
            let seq: i64 = r.try_get("seq").map_err(db_err)?;
            let stored_prev: Vec<u8> = r.try_get("prev_hash").map_err(db_err)?;
            let stored: Vec<u8> = r.try_get("hash").map_err(db_err)?;
            let get = |name: &str| r.try_get::<String, _>(name).map_err(AppError::internal);
            let computed = self.chain(
                &stored_prev,
                r.try_get("at").map_err(db_err)?,
                &get("actor_kind")?,
                &get("actor_id")?,
                &get("action")?,
                &get("target")?,
                &get("ip")?,
                &get("detail")?,
            );
            let gap = next_seq.is_some_and(|expected| expected != seq);
            if computed != stored || stored_prev != prev || gap {
                return Ok(Some(seq));
            }
            prev = stored;
            next_seq = Some(seq + 1);
        }
        Ok(None)
    }
}
