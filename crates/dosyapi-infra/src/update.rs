//! İmzalı güncelleme.
//!
//! Bildirim Ed25519 ile imzalıdır; açık anahtarlar programın içine gömülüdür. İmza
//! doğrulanmadan bildirimdeki hiçbir bilgiye güvenilmez. Paket SHA-256 ile bildirime
//! bağlıdır. Çalışan süreç kendi ikili dosyasını değiştiremez: paketi hazırlar ve
//! yetkili güncelleyici servise iş bırakır.

use async_trait::async_trait;
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use dosyapi_core::error::{AppError, AppResult};
use dosyapi_core::model::Timestamp;
use dosyapi_core::ports::{
    SignedManifest, UpdateArtifact, UpdateInstaller, UpdateJobStatus, UpdateManifest, UpdateSource,
};
use ed25519_dalek::{Signature, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::fs;
use tokio::io::AsyncWriteExt;

pub const PRODUCT: &str = "dosyapi";
const MAX_MANIFEST_BYTES: usize = 256 * 1024;

fn unavailable(message: &str) -> AppError {
    AppError::Unavailable(message.to_string())
}

pub fn parse_public_key(hex_key: &str) -> AppResult<VerifyingKey> {
    let bytes: [u8; 32] = hex::decode(hex_key.trim())
        .map_err(AppError::internal)?
        .try_into()
        .map_err(|_| AppError::internal("açık anahtar uzunluğu hatalı"))?;
    VerifyingKey::from_bytes(&bytes).map_err(AppError::internal)
}

/// Herhangi bir güvenilir anahtarla geçerli katı imza arar.
pub fn verify_manifest(
    keys: &[VerifyingKey],
    manifest: &[u8],
    signature_b64: &str,
) -> AppResult<()> {
    let raw = STANDARD
        .decode(signature_b64.trim())
        .map_err(|_| unavailable("Güncelleme imzası okunamadı."))?;
    let signature =
        Signature::from_slice(&raw).map_err(|_| unavailable("Güncelleme imzası okunamadı."))?;
    if keys
        .iter()
        .any(|key| key.verify_strict(manifest, &signature).is_ok())
    {
        return Ok(());
    }
    Err(unavailable(
        "Güncelleme imzası doğrulanamadı; bildirim reddedildi.",
    ))
}

pub fn decode_manifest(bytes: &[u8], channel: &str) -> AppResult<UpdateManifest> {
    let manifest: UpdateManifest = serde_json::from_slice(bytes)
        .map_err(|_| unavailable("Güncelleme bildirimi okunamadı."))?;
    if manifest.product != PRODUCT {
        return Err(unavailable("Bildirim bu ürüne ait değil."));
    }
    if manifest.channel != channel {
        return Err(unavailable("Bildirim seçili kanala ait değil."));
    }
    Ok(manifest)
}

fn ensure_https(url: &str, allow_http: bool) -> AppResult<()> {
    if url.starts_with("https://") || (allow_http && url.starts_with("http://127.0.0.1")) {
        return Ok(());
    }
    Err(unavailable("Güncelleme adresi HTTPS olmalı."))
}

pub struct HttpUpdateSource {
    base_url: String,
    keys: Vec<VerifyingKey>,
    http: reqwest::Client,
    allow_http: bool,
}

impl HttpUpdateSource {
    pub fn new(base_url: &str, keys: Vec<VerifyingKey>, allow_http: bool) -> AppResult<Self> {
        ensure_https(base_url, allow_http)?;
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .redirect(reqwest::redirect::Policy::limited(3))
            .https_only(!allow_http)
            .user_agent(concat!("dosyapi-updater/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(AppError::internal)?;
        Ok(Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            keys,
            http,
            allow_http,
        })
    }

    async fn fetch(&self, url: &str) -> AppResult<Vec<u8>> {
        let response = self
            .http
            .get(url)
            .send()
            .await
            .map_err(|_| unavailable("Güncelleme sunucusuna ulaşılamadı."))?;
        if !response.status().is_success() {
            return Err(unavailable("Güncelleme bilgisi alınamadı."));
        }
        let bytes = response
            .bytes()
            .await
            .map_err(|_| unavailable("Güncelleme bilgisi okunamadı."))?;
        if bytes.len() > MAX_MANIFEST_BYTES {
            return Err(unavailable("Güncelleme bildirimi çok büyük."));
        }
        Ok(bytes.to_vec())
    }
}

#[async_trait]
impl UpdateSource for HttpUpdateSource {
    async fn fetch_manifest(&self, channel: &str) -> AppResult<SignedManifest> {
        if self.keys.is_empty() {
            return Err(unavailable(
                "Bu derlemede güncelleme anahtarı tanımlı değil.",
            ));
        }
        ensure_https(&self.base_url, self.allow_http)?;
        let url = format!("{}/{}/manifest.json", self.base_url, channel);
        let manifest = self.fetch(&url).await?;
        let signature = self.fetch(&format!("{url}.sig")).await?;
        let signature = String::from_utf8(signature)
            .map_err(|_| unavailable("Güncelleme imzası okunamadı."))?;
        verify_manifest(&self.keys, &manifest, &signature)?;
        let decoded = decode_manifest(&manifest, channel)?;
        Ok(SignedManifest {
            manifest: decoded,
            raw: manifest,
            signature,
        })
    }
}

/// Yetkili güncelleyicinin okuduğu iş emri. Bu dosya yetkisiz süreçten geldiği için
/// içindeki hiçbir şeye güvenilmez: güncelleyici imzayı kendisi doğrular.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRequest {
    pub channel: String,
    pub file: String,
    pub requested_at: Timestamp,
}

pub fn manifest_path(state: &Path) -> PathBuf {
    state.join("manifest.json")
}

pub fn signature_path(state: &Path) -> PathBuf {
    state.join("manifest.json.sig")
}

pub fn request_path(state: &Path) -> PathBuf {
    state.join("request.json")
}

pub fn status_path(state: &Path) -> PathBuf {
    state.join("status.json")
}

pub async fn sha256_file(path: &Path) -> AppResult<String> {
    use tokio::io::AsyncReadExt;
    let mut file = fs::File::open(path).await.map_err(AppError::internal)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 256 * 1024];
    loop {
        let count = file.read(&mut buffer).await.map_err(AppError::internal)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(hex::encode(hasher.finalize()))
}

/// Güncelleyicinin sağlık denetimi için küçük HTTP istemcisi.
pub struct HealthClient(reqwest::Client);

impl HealthClient {
    pub fn new() -> AppResult<Self> {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .map(Self)
            .map_err(AppError::internal)
    }

    pub fn get(&self, url: &str) -> reqwest::RequestBuilder {
        self.0.get(url)
    }
}

pub struct StagedInstaller {
    state_dir: PathBuf,
    status_dir: PathBuf,
    http: reqwest::Client,
    enabled: bool,
    allow_http: bool,
}

impl StagedInstaller {
    pub fn new(
        state_dir: PathBuf,
        status_dir: PathBuf,
        enabled: bool,
        allow_http: bool,
    ) -> AppResult<Self> {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(900))
            .redirect(reqwest::redirect::Policy::limited(5))
            .https_only(!allow_http)
            .user_agent(concat!("dosyapi-updater/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(AppError::internal)?;
        Ok(Self {
            state_dir,
            status_dir,
            http,
            enabled,
            allow_http,
        })
    }

    async fn download(&self, artifact: &UpdateArtifact, target: &Path) -> AppResult<()> {
        ensure_https(&artifact.url, self.allow_http)?;
        let mut response = self
            .http
            .get(&artifact.url)
            .send()
            .await
            .map_err(|_| unavailable("Güncelleme paketi indirilemedi."))?;
        if !response.status().is_success() {
            return Err(unavailable("Güncelleme paketi indirilemedi."));
        }
        let mut file = fs::File::create(target).await.map_err(AppError::internal)?;
        let mut hasher = Sha256::new();
        let mut received: u64 = 0;
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| unavailable("Güncelleme paketi indirilemedi."))?
        {
            received += chunk.len() as u64;
            if received > artifact.size {
                return Err(unavailable("Paket boyutu bildirimle uyuşmuyor."));
            }
            hasher.update(&chunk);
            file.write_all(&chunk).await.map_err(AppError::internal)?;
        }
        file.sync_all().await.map_err(AppError::internal)?;
        if received != artifact.size
            || hex::encode(hasher.finalize()) != artifact.sha256.to_lowercase()
        {
            return Err(unavailable(
                "Paket özeti bildirimle uyuşmuyor; güncelleme iptal edildi.",
            ));
        }
        Ok(())
    }
}

#[async_trait]
impl UpdateInstaller for StagedInstaller {
    fn supported(&self) -> bool {
        self.enabled
    }

    async fn stage_and_request(
        &self,
        signed: &SignedManifest,
        artifact: &UpdateArtifact,
    ) -> AppResult<()> {
        fs::create_dir_all(&self.state_dir)
            .await
            .map_err(AppError::internal)?;
        let name = format!(
            "dosyapi-{}.bin",
            artifact.sha256.get(..16).unwrap_or("paket")
        );
        let target = self.state_dir.join(&name);
        let outcome = self.download(artifact, &target).await;
        if let Err(error) = outcome {
            let _ = fs::remove_file(&target).await;
            return Err(error);
        }
        fs::write(manifest_path(&self.state_dir), &signed.raw)
            .await
            .map_err(AppError::internal)?;
        fs::write(signature_path(&self.state_dir), &signed.signature)
            .await
            .map_err(AppError::internal)?;
        let request = UpdateRequest {
            channel: signed.manifest.channel.clone(),
            file: name,
            requested_at: time::OffsetDateTime::now_utc().unix_timestamp(),
        };
        let body = serde_json::to_vec_pretty(&request).map_err(AppError::internal)?;
        let temp = self.state_dir.join("request.json.tmp");
        fs::write(&temp, body).await.map_err(AppError::internal)?;
        fs::rename(&temp, request_path(&self.state_dir))
            .await
            .map_err(AppError::internal)
    }

    async fn status(&self) -> AppResult<Option<UpdateJobStatus>> {
        match fs::read(status_path(&self.status_dir)).await {
            Ok(bytes) => serde_json::from_slice(&bytes)
                .map(Some)
                .map_err(AppError::internal),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(error) => Err(AppError::internal(error)),
        }
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    fn signed(body: &str) -> (VerifyingKey, String) {
        let key = SigningKey::from_bytes(&[3u8; 32]);
        (
            key.verifying_key(),
            STANDARD.encode(key.sign(body.as_bytes()).to_bytes()),
        )
    }

    const BODY: &str = r#"{"product":"dosyapi","channel":"stable","version":"1.2.0","releasedAt":"2026-11-06","notes":"","minVersion":"0.1.0","artifacts":[]}"#;

    #[test]
    fn valid_signature_is_accepted() {
        let (key, sig) = signed(BODY);
        verify_manifest(&[key], BODY.as_bytes(), &sig).unwrap();
        assert_eq!(
            decode_manifest(BODY.as_bytes(), "stable").unwrap().version,
            "1.2.0"
        );
    }

    #[test]
    fn tampered_manifest_is_rejected() {
        let (key, sig) = signed(BODY);
        let forged = BODY.replace("1.2.0", "9.9.9");
        assert!(verify_manifest(&[key], forged.as_bytes(), &sig).is_err());
    }

    #[test]
    fn wrong_key_is_rejected() {
        let (_, sig) = signed(BODY);
        let other = SigningKey::from_bytes(&[4u8; 32]).verifying_key();
        assert!(verify_manifest(&[other], BODY.as_bytes(), &sig).is_err());
    }

    #[test]
    fn channel_replay_is_rejected() {
        assert!(decode_manifest(BODY.as_bytes(), "beta").is_err());
    }

    #[test]
    fn http_urls_are_refused() {
        assert!(ensure_https("http://kotu.example/x", false).is_err());
        assert!(ensure_https("https://guvenli.example/x", false).is_ok());
    }
}
