//! SQLite depoları. Tüm sorgular parametre bağlamalıdır (`bind`); kullanıcı girdisi
//! SQL metnine asla eklenmez. Kişisel veri bu katmanda şifrelenip çözülür, böylece
//! çekirdek şifrelemeden habersizdir.

mod audit;
mod identity;
mod records;
mod workflow;

use crate::crypto::FieldCipher;
use sqlx::SqlitePool;

/// Tüm depoların paylaştığı bağlantı ve alan şifreleyici.
#[derive(Clone)]
pub struct Db {
    pub pool: SqlitePool,
    pub cipher: FieldCipher,
}

impl Db {
    pub fn new(pool: SqlitePool, cipher: FieldCipher) -> Self {
        Self { pool, cipher }
    }
}

pub use audit::SqliteAudit;
