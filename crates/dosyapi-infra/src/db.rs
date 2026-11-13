use dosyapi_core::error::{AppError, AppResult};
pub use sqlx::SqlitePool;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};
use std::path::Path;
use std::str::FromStr;
use std::time::Duration;

pub fn db_err(error: sqlx::Error) -> AppError {
    if let sqlx::Error::Database(db) = &error {
        if db.is_unique_violation() {
            return AppError::conflict("Bu kayıt zaten mevcut.");
        }
        if db.is_foreign_key_violation() {
            return AppError::conflict("Kayıt başka verilerle ilişkili.");
        }
    }
    AppError::internal(error)
}

pub async fn connect(path: &Path) -> AppResult<SqlitePool> {
    let location = format!("sqlite://{}", path.display());
    let options = SqliteConnectOptions::from_str(&location)
        .map_err(AppError::internal)?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .foreign_keys(true)
        .busy_timeout(Duration::from_secs(10))
        // Silinen veri diskte sıfırlanır.
        .pragma("secure_delete", "ON");
    let pool = SqlitePoolOptions::new()
        .max_connections(8)
        .acquire_timeout(Duration::from_secs(15))
        .connect_with(options)
        .await
        .map_err(AppError::internal)?;
    restrict_file(path)?;
    Ok(pool)
}

#[cfg(unix)]
pub fn restrict_file(path: &Path) -> AppResult<()> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
        .map_err(AppError::internal)
}

#[cfg(not(unix))]
pub fn restrict_file(_path: &Path) -> AppResult<()> {
    Ok(())
}

pub async fn migrate(pool: &SqlitePool) -> AppResult<()> {
    // Geri dönüşte eski ikili, yeni sürümün eklediği göçleri görmezden gelebilmeli.
    let mut migrator = sqlx::migrate!("./migrations");
    migrator.set_ignore_missing(true);
    migrator.run(pool).await.map_err(AppError::internal)
}
