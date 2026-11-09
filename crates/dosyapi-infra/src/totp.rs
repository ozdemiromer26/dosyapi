use dosyapi_core::error::{AppError, AppResult};
use dosyapi_core::model::Timestamp;
use dosyapi_core::ports::Totp;
use totp_rs::{Algorithm, Secret, TOTP};

/// RFC 6238 zaman tabanlı tek kullanımlık kod (6 hane, 30 sn, ±1 pencere).
pub struct RfcTotp;

fn build(secret: &str, account: &str, issuer: &str) -> AppResult<TOTP> {
    let bytes = Secret::Encoded(secret.to_string())
        .to_bytes()
        .map_err(|_| AppError::internal("totp gizli değeri bozuk"))?;
    TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        bytes,
        Some(issuer.to_string()),
        account.to_string(),
    )
    .map_err(AppError::internal)
}

impl Totp for RfcTotp {
    fn new_secret(&self) -> String {
        let bytes = crate::crypto::random_bytes::<20>();
        Secret::Raw(bytes.to_vec()).to_encoded().to_string()
    }

    fn provisioning_uri(&self, secret: &str, account: &str, issuer: &str) -> AppResult<String> {
        Ok(build(secret, account, &issuer.replace(':', " "))?.get_url())
    }

    fn verify(&self, secret: &str, code: &str, now: Timestamp) -> bool {
        if code.len() != 6 || !code.bytes().all(|b| b.is_ascii_digit()) {
            return false;
        }
        build(secret, "dosyapi", "dosyapi")
            .map(|t| t.check(code, now as u64))
            .unwrap_or(false)
    }
}
