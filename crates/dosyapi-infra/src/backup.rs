use crate::db::{db_err, restrict_file};
use async_trait::async_trait;
use dosyapi_core::error::{AppError, AppResult};
use dosyapi_core::ports::{BackupInfo, BackupService, DataEraser};
use sqlx::SqlitePool;
use std::path::PathBuf;
use tokio::fs;

/// Tutarlı anlık yedek (`VACUUM INTO`). Dosya anahtarları yedeğe girmez; hassas alanlar
/// yedekte de şifrelidir, geri yüklemek için `secret.key` gerekir.
pub struct SqliteBackups {
    pub pool: SqlitePool,
    pub dir: PathBuf,
}

#[async_trait]
impl BackupService for SqliteBackups {
    async fn create(&self, label: &str) -> AppResult<BackupInfo> {
        fs::create_dir_all(&self.dir)
            .await
            .map_err(AppError::internal)?;
        let now = time::OffsetDateTime::now_utc().unix_timestamp();
        let safe: String = label
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
            .take(32)
            .collect();
        let name = format!(
            "dosyapi-{now}-{safe}-{}.sqlite",
            hex::encode(crate::crypto::random_bytes::<3>())
        );
        let path = self.dir.join(&name);
        let target = path
            .to_str()
            .ok_or_else(|| AppError::internal("yedek yolu geçersiz"))?;
        sqlx::query("VACUUM INTO ?")
            .bind(target)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        restrict_file(&path)?;
        let size = fs::metadata(&path).await.map_err(AppError::internal)?.len();
        Ok(BackupInfo {
            name,
            size,
            at: now,
        })
    }

    async fn list(&self) -> AppResult<Vec<BackupInfo>> {
        let mut out = Vec::new();
        let Ok(mut entries) = fs::read_dir(&self.dir).await else {
            return Ok(out);
        };
        while let Some(entry) = entries.next_entry().await.map_err(AppError::internal)? {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.ends_with(".sqlite") {
                continue;
            }
            let meta = entry.metadata().await.map_err(AppError::internal)?;
            let at = meta
                .modified()
                .ok()
                .and_then(|m| m.duration_since(std::time::UNIX_EPOCH).ok())
                .map_or(0, |d| d.as_secs() as i64);
            out.push(BackupInfo {
                name,
                size: meta.len(),
                at,
            });
        }
        out.sort_by_key(|b| std::cmp::Reverse(b.at));
        Ok(out)
    }
}

/// Fabrika ayarlarına dönüş. Denetim günlüğü korunur: bu işlemin de izi kalmalı.
pub struct SqliteEraser {
    pub pool: SqlitePool,
    pub files_root: PathBuf,
}

#[async_trait]
impl DataEraser for SqliteEraser {
    async fn erase_all(&self) -> AppResult<()> {
        let mut tx = self.pool.begin().await.map_err(db_err)?;
        for table in [
            "sessions",
            "auth_tokens",
            "pendings",
            "history",
            "tasks",
            "todos",
            "project_notes",
            "totp_recovery",
            "files",
            "project_authors",
            "projects",
            "authors",
            "contractors",
            "doc_types",
            "professions",
            "templates",
            "users",
            "roles",
            "settings",
        ] {
            sqlx::query(&format!("DELETE FROM {table}"))
                .execute(&mut *tx)
                .await
                .map_err(db_err)?;
        }
        tx.commit().await.map_err(db_err)?;
        let objects = self.files_root.join("objects");
        if fs::metadata(&objects).await.is_ok() {
            fs::remove_dir_all(&objects)
                .await
                .map_err(AppError::internal)?;
            fs::create_dir_all(&objects)
                .await
                .map_err(AppError::internal)?;
        }
        Ok(())
    }
}
