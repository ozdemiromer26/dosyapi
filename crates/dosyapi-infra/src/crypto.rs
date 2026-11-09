//! Anahtar yönetimi ve kriptografik işlemler.
//!
//! Tek bir ana anahtar (`secret.key`) HKDF ile amaçlara ayrılır; böylece bir alt
//! anahtarın sızması diğerlerini etkilemez. Ana anahtar veritabanında tutulmaz.

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::password_hash::phc::PasswordHash;
use argon2::password_hash::{PasswordHasher as _, PasswordVerifier};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use dosyapi_core::error::{AppError, AppResult};
use dosyapi_core::ports::{PasswordHasher, SecretBox, TokenService};
use hkdf::Hkdf;
use hmac::{Hmac, Mac};
use rand::Rng;
use sha2::Sha256;
use std::path::Path;
use std::sync::Arc;
use subtle::ConstantTimeEq;
use zeroize::Zeroizing;

pub const KEY_LEN: usize = 32;
const NONCE_LEN: usize = 12;

pub fn random_bytes<const N: usize>() -> [u8; N] {
    let mut out = [0u8; N];
    rand::rng().fill_bytes(&mut out);
    out
}

/// Ana anahtardan türetilmiş amaç bazlı anahtarlar.
pub struct Keyring {
    root: Zeroizing<[u8; KEY_LEN]>,
}

impl Keyring {
    pub fn from_root(root: [u8; KEY_LEN]) -> Self {
        Self {
            root: Zeroizing::new(root),
        }
    }

    pub fn derive(&self, purpose: &str) -> Zeroizing<[u8; KEY_LEN]> {
        let mut out = Zeroizing::new([0u8; KEY_LEN]);
        let hk = Hkdf::<Sha256>::new(Some(b"dosyapi.v1"), self.root.as_slice());
        // Uzunluk sabit ve geçerli olduğundan expand başarısız olamaz.
        let _ = hk.expand(purpose.as_bytes(), out.as_mut_slice());
        out
    }

    /// Anahtar dosyasını okur; yoksa ve izin verildiyse 0600 kipinde oluşturur.
    pub fn load_or_create(path: &Path, create: bool) -> AppResult<Self> {
        match std::fs::read_to_string(path) {
            Ok(text) => {
                let bytes = Zeroizing::new(
                    hex::decode(text.trim())
                        .map_err(|_| AppError::internal("anahtar dosyası bozuk"))?,
                );
                let root: [u8; KEY_LEN] = bytes
                    .as_slice()
                    .try_into()
                    .map_err(|_| AppError::internal("anahtar uzunluğu hatalı"))?;
                check_permissions(path)?;
                Ok(Self::from_root(root))
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound && create => {
                if let Some(parent) = path.parent() {
                    std::fs::create_dir_all(parent).map_err(AppError::internal)?;
                }
                let root = random_bytes::<KEY_LEN>();
                write_private(path, hex::encode(root).as_bytes())?;
                Ok(Self::from_root(root))
            }
            Err(error) => Err(AppError::internal(format!("anahtar okunamadı: {error}"))),
        }
    }
}

#[cfg(unix)]
fn check_permissions(path: &Path) -> AppResult<()> {
    use std::os::unix::fs::PermissionsExt;
    let mode = std::fs::metadata(path)
        .map_err(AppError::internal)?
        .permissions()
        .mode();
    if mode & 0o077 != 0 {
        return Err(AppError::internal(format!(
            "{} başka kullanıcılara açık (kip {:o}); `chmod 600` uygulayın",
            path.display(),
            mode & 0o777
        )));
    }
    Ok(())
}

#[cfg(not(unix))]
fn check_permissions(_path: &Path) -> AppResult<()> {
    Ok(())
}

pub fn write_private(path: &Path, bytes: &[u8]) -> AppResult<()> {
    use std::io::Write;
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(path).map_err(AppError::internal)?;
    file.write_all(bytes).map_err(AppError::internal)?;
    file.sync_all().map_err(AppError::internal)
}

/// AES-256-GCM. Bağlam (AAD) sayesinde bir kolonun şifreli değeri başka
/// bir satıra ya da kolona kopyalansa çözülemez.
#[derive(Clone)]
pub struct FieldCipher {
    cipher: Aes256Gcm,
}

impl FieldCipher {
    pub fn new(key: &[u8; KEY_LEN]) -> AppResult<Self> {
        Ok(Self {
            cipher: Aes256Gcm::new_from_slice(key).map_err(AppError::internal)?,
        })
    }

    pub fn encrypt(&self, context: &str, plaintext: &[u8]) -> AppResult<Vec<u8>> {
        let nonce_bytes = random_bytes::<NONCE_LEN>();
        let nonce = Nonce::try_from(&nonce_bytes[..]).map_err(AppError::internal)?;
        let ciphertext = self
            .cipher
            .encrypt(
                &nonce,
                Payload {
                    msg: plaintext,
                    aad: context.as_bytes(),
                },
            )
            .map_err(|_| AppError::internal("şifreleme başarısız"))?;
        let mut out = Vec::with_capacity(NONCE_LEN + ciphertext.len());
        out.extend_from_slice(&nonce_bytes);
        out.extend_from_slice(&ciphertext);
        Ok(out)
    }

    pub fn decrypt(&self, context: &str, blob: &[u8]) -> AppResult<Vec<u8>> {
        if blob.len() < NONCE_LEN {
            return Err(AppError::internal("şifreli veri kısa"));
        }
        let (nonce_bytes, ciphertext) = blob.split_at(NONCE_LEN);
        let nonce = Nonce::try_from(nonce_bytes).map_err(AppError::internal)?;
        self.cipher
            .decrypt(
                &nonce,
                Payload {
                    msg: ciphertext,
                    aad: context.as_bytes(),
                },
            )
            .map_err(|_| AppError::internal("şifre çözülemedi"))
    }

    pub fn encrypt_text(&self, context: &str, plaintext: &str) -> AppResult<Vec<u8>> {
        self.encrypt(context, plaintext.as_bytes())
    }

    pub fn decrypt_text(&self, context: &str, blob: Option<&[u8]>) -> AppResult<String> {
        match blob {
            Some(data) => {
                String::from_utf8(self.decrypt(context, data)?).map_err(AppError::internal)
            }
            None => Ok(String::new()),
        }
    }
}

impl SecretBox for FieldCipher {
    fn seal(&self, context: &str, plaintext: &str) -> AppResult<String> {
        Ok(URL_SAFE_NO_PAD.encode(self.encrypt(context, plaintext.as_bytes())?))
    }

    fn open(&self, context: &str, sealed: &str) -> AppResult<String> {
        let blob = URL_SAFE_NO_PAD.decode(sealed).map_err(AppError::internal)?;
        String::from_utf8(self.decrypt(context, &blob)?).map_err(AppError::internal)
    }
}

/// Argon2id (64 MiB, 3 tur). Bellek sertliği GPU saldırısını pahalılaştırır.
pub struct ArgonHasher {
    argon: Argon2<'static>,
    limit: Arc<tokio::sync::Semaphore>,
}

impl ArgonHasher {
    pub fn new() -> AppResult<Self> {
        let params = Params::new(64 * 1024, 3, 1, Some(32)).map_err(AppError::internal)?;
        Ok(Self {
            argon: Argon2::new(Algorithm::Argon2id, Version::V0x13, params),
            limit: Arc::new(tokio::sync::Semaphore::new(4)),
        })
    }

    /// Test ve geliştirme için hızlı parametreler.
    pub fn fast_for_tests() -> AppResult<Self> {
        let params = Params::new(1024, 1, 1, Some(32)).map_err(AppError::internal)?;
        Ok(Self {
            argon: Argon2::new(Algorithm::Argon2id, Version::V0x13, params),
            limit: Arc::new(tokio::sync::Semaphore::new(64)),
        })
    }

    /// CPU yoğun işi çalışma zamanını kilitlemeden yürütür ve eşzamanlılığı sınırlar.
    fn blocking<T>(&self, work: impl FnOnce() -> T) -> T {
        match tokio::runtime::Handle::try_current() {
            Ok(handle) if handle.runtime_flavor() == tokio::runtime::RuntimeFlavor::MultiThread => {
                tokio::task::block_in_place(|| {
                    let _permit = handle.block_on(self.limit.acquire());
                    work()
                })
            }
            _ => work(),
        }
    }
}

impl PasswordHasher for ArgonHasher {
    fn hash(&self, password: &str) -> AppResult<String> {
        self.blocking(|| {
            self.argon
                .hash_password(password.as_bytes())
                .map(|hash| hash.to_string())
                .map_err(AppError::internal)
        })
    }

    fn verify(&self, hash: &str, password: &str) -> bool {
        self.blocking(|| {
            PasswordHash::new(hash)
                .map(|parsed| {
                    self.argon
                        .verify_password(password.as_bytes(), &parsed)
                        .is_ok()
                })
                .unwrap_or(false)
        })
    }

    fn burn(&self, password: &str) {
        self.blocking(|| {
            let mut out = Zeroizing::new([0u8; 32]);
            let _ = self.argon.hash_password_into(
                password.as_bytes(),
                b"dosyapi-burn-salt",
                out.as_mut_slice(),
            );
        });
    }
}

type HmacSha256 = Hmac<Sha256>;

/// Oturum ve sıfırlama belirteçleri. Veritabanında yalnızca anahtarlı özet durur:
/// veritabanı sızsa bile belirteçler kullanılamaz.
pub struct HmacTokens {
    token_key: Zeroizing<[u8; KEY_LEN]>,
    csrf_key: Zeroizing<[u8; KEY_LEN]>,
}

impl HmacTokens {
    pub fn new(keyring: &Keyring) -> Self {
        Self {
            token_key: keyring.derive("session-token"),
            csrf_key: keyring.derive("csrf"),
        }
    }

    #[allow(clippy::expect_used)]
    fn mac(key: &[u8], data: &[u8]) -> Vec<u8> {
        let mut mac = <HmacSha256 as hmac::KeyInit>::new_from_slice(key)
            .expect("HMAC her anahtar uzunluğunu kabul eder");
        mac.update(data);
        mac.finalize().into_bytes().to_vec()
    }
}

impl TokenService for HmacTokens {
    fn generate(&self) -> String {
        URL_SAFE_NO_PAD.encode(random_bytes::<32>())
    }

    fn hash(&self, token: &str) -> Vec<u8> {
        Self::mac(self.token_key.as_slice(), token.as_bytes())
    }

    fn csrf_token(&self, token_hash: &[u8]) -> String {
        URL_SAFE_NO_PAD.encode(Self::mac(self.csrf_key.as_slice(), token_hash))
    }

    fn csrf_valid(&self, token_hash: &[u8], candidate: &str) -> bool {
        let expected = self.csrf_token(token_hash);
        expected.as_bytes().ct_eq(candidate.as_bytes()).into()
    }

    fn csrf_valid_raw(&self, left: &[u8], right: &[u8]) -> bool {
        left.ct_eq(right).into()
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    fn cipher() -> FieldCipher {
        FieldCipher::new(&[7u8; KEY_LEN]).unwrap()
    }

    #[test]
    fn roundtrip_and_context_binding() {
        let c = cipher();
        let blob = c.encrypt("authors.tc:1", b"12345678901").unwrap();
        assert_eq!(c.decrypt("authors.tc:1", &blob).unwrap(), b"12345678901");
        assert!(
            c.decrypt("authors.tc:2", &blob).is_err(),
            "başka satırda çözülememeli"
        );
        assert_ne!(
            blob,
            c.encrypt("authors.tc:1", b"12345678901").unwrap(),
            "nonce tekrar etmemeli"
        );
    }

    #[test]
    fn tamper_is_detected() {
        let c = cipher();
        let mut blob = c.encrypt("x", b"veri").unwrap();
        let last = blob.len() - 1;
        blob[last] ^= 1;
        assert!(c.decrypt("x", &blob).is_err());
    }

    #[test]
    fn keys_are_separated_by_purpose() {
        let ring = Keyring::from_root([1u8; KEY_LEN]);
        assert_ne!(ring.derive("a").as_slice(), ring.derive("b").as_slice());
    }

    #[test]
    fn hasher_verifies() {
        let h = ArgonHasher::fast_for_tests().unwrap();
        let hash = h.hash("dogru-parola").unwrap();
        assert!(hash.starts_with("$argon2id$"));
        assert!(h.verify(&hash, "dogru-parola"));
        assert!(!h.verify(&hash, "yanlis-parola"));
        assert!(!h.verify("gecersiz", "x"));
    }

    #[test]
    fn tokens_hash_and_csrf() {
        let t = HmacTokens::new(&Keyring::from_root([2u8; KEY_LEN]));
        let token = t.generate();
        assert!(token.len() >= 43);
        let hash = t.hash(&token);
        let csrf = t.csrf_token(&hash);
        assert!(t.csrf_valid(&hash, &csrf));
        assert!(!t.csrf_valid(&hash, "yanlis"));
    }
}
