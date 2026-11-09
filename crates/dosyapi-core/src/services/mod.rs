//! Kullanım senaryoları. Her servis tek bir sorumluluğa sahiptir ve yalnızca
//! ihtiyacı olan portları alır; yetki denetimi her servis yönteminin başındadır.

pub mod approvals;
pub mod audit;
pub mod auth;
pub mod bootstrap;
pub mod changes;
pub mod company;
pub mod dns;
pub mod files;
pub mod mail;
pub mod master;
pub mod projects;
pub mod records;
pub mod roles;
pub mod settings;
pub mod setup;
pub mod tasks;
pub mod templates;
pub mod updates;
pub mod users;
