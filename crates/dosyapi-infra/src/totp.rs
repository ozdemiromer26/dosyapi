use dosyapi_core::error::{AppError, AppResult};
use dosyapi_core::model::Timestamp;
use dosyapi_core::ports::Totp;
use totp_rs::{Algorithm, Secret, TOTP};

/// RFC 6238 zaman tabanlı tek kullanımlık kod (6 hane, 30 sn, ±1 pencere).
pub struct RfcTotp;

const STEP: i64 = 30;

/// Karışan karakterler (0/o, 1/l/i) çıkarılmış 31 harf. 12 karakter ≈ 59 bit.
const RECOVERY_ALPHABET: &[u8; 31] = b"23456789abcdefghjkmnpqrstuvwxyz";

fn constant_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

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

    fn verify(&self, secret: &str, code: &str, now: Timestamp) -> Option<i64> {
        if code.len() != 6 || !code.bytes().all(|b| b.is_ascii_digit()) {
            return None;
        }
        let totp = build(secret, "dosyapi", "dosyapi").ok()?;
        let current = now.div_euclid(STEP);
        // ±1 adım saat kaymasına tolerans; tüm adaylar sabit sürede karşılaştırılır.
        let mut found = None;
        for step in [current - 1, current, current + 1] {
            if step < 0 {
                continue;
            }
            let expected = totp.generate((step * STEP) as u64);
            if constant_eq(expected.as_bytes(), code.as_bytes()) {
                found = Some(step);
            }
        }
        found
    }

    fn recovery_codes(&self, count: usize) -> Vec<String> {
        (0..count)
            .map(|_| {
                // 128 bit rastgele sayıdan 31 tabanında 12 hane: mod yanlılığı ihmal edilebilir (2^128 ≫ 31^12).
                let mut n = u128::from_le_bytes(crate::crypto::random_bytes::<16>());
                let chars: Vec<char> = (0..12)
                    .map(|_| {
                        let c = RECOVERY_ALPHABET[(n % 31) as usize] as char;
                        n /= 31;
                        c
                    })
                    .collect();
                chars
                    .chunks(4)
                    .map(|c| c.iter().collect::<String>())
                    .collect::<Vec<_>>()
                    .join("-")
            })
            .collect()
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn verify_returns_matching_step_within_one_step() {
        let t = RfcTotp;
        let secret = t.new_secret();
        let now = 1_800_000_015;
        let code = build(&secret, "a", "b").unwrap().generate(now as u64);
        assert_eq!(t.verify(&secret, &code, now), Some(now / 30));
        assert_eq!(t.verify(&secret, &code, now + 30), Some(now / 30));
        assert_eq!(t.verify(&secret, &code, now + 90), None);
        assert_eq!(t.verify(&secret, "12345", now), None);
        assert_eq!(t.verify(&secret, "abcdef", now), None);
    }

    #[test]
    fn recovery_codes_are_unique_and_readable() {
        let codes = RfcTotp.recovery_codes(10);
        let unique: std::collections::HashSet<_> = codes.iter().collect();
        assert_eq!(unique.len(), 10);
        for c in &codes {
            assert_eq!(c.len(), 14);
            assert!(
                c.split('-')
                    .all(|p| p.len() == 4 && p.bytes().all(|b| RECOVERY_ALPHABET.contains(&b)))
            );
        }
    }
}
