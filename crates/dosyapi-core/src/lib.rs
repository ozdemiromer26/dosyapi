//! dosyapı iş kuralları katmanı.
//!
//! Bu crate hiçbir altyapı ayrıntısını bilmez: HTTP, SQL, dosya sistemi ya da
//! şifreleme kütüphanesi yoktur. Dış dünya yalnızca [`ports`] içindeki
//! arayüzlerle görülür (bağımlılıkların tersine çevrilmesi).

pub mod error;
pub mod model;
pub mod password;
pub mod policy;
pub mod ports;
pub mod services;
pub mod validate;

pub use error::{AppError, AppResult};
