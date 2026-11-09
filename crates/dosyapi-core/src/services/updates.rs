//! Güncelleme yönetimi. Bildirim imzası `UpdateSource`, paket özeti `UpdateInstaller`
//! tarafından doğrulanır; burada sürüm ve kanal kuralları uygulanır.

use crate::error::{AppError, AppResult};
use crate::model::{RequestMeta, Timestamp};
use crate::ports::*;
use crate::services::audit::Auditor;
use crate::services::settings::*;
use semver::Version;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

pub const CHANNELS: &[&str] = &["stable", "beta", "dev"];

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheck {
    pub current: String,
    pub channel: String,
    pub latest: String,
    pub available: bool,
    pub notes: String,
    pub released_at: String,
    pub blocked_reason: String,
    pub installer_supported: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct InstalledVersion {
    version: String,
    at: Timestamp,
}

#[derive(Clone)]
pub struct UpdateService {
    pub source: Arc<dyn UpdateSource>,
    pub installer: Arc<dyn UpdateInstaller>,
    pub settings: Settings,
    pub clock: Arc<dyn Clock>,
    pub audit: Auditor,
    pub current_version: String,
    pub os: String,
    pub arch: String,
}

impl UpdateService {
    pub fn current_version(&self) -> &str {
        &self.current_version
    }

    /// Çalışan sürümün bu sunucuya ilk kez ne zaman geldiğini kaydeder ve döndürür.
    /// Sürüm değişmediyse eski tarih korunur; "Son güncelleme" bu değerdir.
    pub async fn record_running_version(&self) -> AppResult<Timestamp> {
        let stored: Option<InstalledVersion> = self.settings.get_json(KEY_INSTALLED).await?;
        if let Some(v) = stored.filter(|v| v.version == self.current_version) {
            return Ok(v.at);
        }
        let entry = InstalledVersion {
            version: self.current_version.clone(),
            at: self.clock.now(),
        };
        self.settings.set_json(KEY_INSTALLED, &entry).await?;
        Ok(entry.at)
    }

    pub async fn channel(&self) -> AppResult<String> {
        Ok(self
            .settings
            .get_json(KEY_CHANNEL)
            .await?
            .unwrap_or_else(|| "stable".to_string()))
    }

    pub async fn set_channel(&self, channel: &str, meta: &RequestMeta) -> AppResult<()> {
        if !CHANNELS.contains(&channel) {
            return Err(AppError::validation("Geçersiz güncelleme kanalı."));
        }
        self.settings.set_json(KEY_CHANNEL, &channel).await?;
        self.audit.master(meta, "update.channel", channel, "").await
    }

    fn parse(value: &str) -> AppResult<Version> {
        Version::parse(value).map_err(|_| {
            AppError::Unavailable("Güncelleme bildirimi geçersiz sürüm içeriyor.".into())
        })
    }

    /// Sürüm kuralları: yalnızca daha yeni sürüme geçilir (geri alma saldırısı engeli).
    pub fn evaluate(&self, manifest: &UpdateManifest) -> AppResult<(bool, String)> {
        let current = Self::parse(&self.current_version)?;
        let latest = Self::parse(&manifest.version)?;
        if latest <= current {
            return Ok((false, String::new()));
        }
        let minimum = Self::parse(&manifest.min_version)?;
        if current < minimum {
            return Ok((
                true,
                format!(
                    "Bu sürüme geçmek için önce {} sürümüne güncelleyin.",
                    manifest.min_version
                ),
            ));
        }
        if !manifest
            .artifacts
            .iter()
            .any(|a| a.os == self.os && a.arch == self.arch)
        {
            return Ok((true, "Bu sunucu mimarisi için paket yayınlanmamış.".into()));
        }
        Ok((true, String::new()))
    }

    pub async fn check(&self) -> AppResult<UpdateCheck> {
        let channel = self.channel().await?;
        let manifest = self.source.fetch_manifest(&channel).await?.manifest;
        let (available, blocked_reason) = self.evaluate(&manifest)?;
        self.settings
            .set_json(KEY_LAST_CHECK, &self.clock.now())
            .await?;
        Ok(UpdateCheck {
            current: self.current_version.clone(),
            channel,
            latest: manifest.version,
            available,
            notes: manifest.notes,
            released_at: manifest.released_at,
            blocked_reason,
            installer_supported: self.installer.supported(),
        })
    }

    pub async fn apply(&self, meta: &RequestMeta) -> AppResult<String> {
        if !self.installer.supported() {
            return Err(AppError::Unavailable(
                "Bu kurulumda uygulama içi güncelleme desteklenmiyor.".into(),
            ));
        }
        let channel = self.channel().await?;
        let signed = self.source.fetch_manifest(&channel).await?;
        let manifest = &signed.manifest;
        let (available, blocked) = self.evaluate(manifest)?;
        if !available {
            return Err(AppError::conflict("Sistem zaten güncel."));
        }
        if !blocked.is_empty() {
            return Err(AppError::conflict(blocked));
        }
        let artifact = manifest
            .artifacts
            .iter()
            .find(|a| a.os == self.os && a.arch == self.arch)
            .ok_or_else(|| AppError::conflict("Bu sunucu mimarisi için paket yayınlanmamış."))?;
        self.installer.stage_and_request(&signed, artifact).await?;
        self.audit
            .master(meta, "update.requested", &manifest.version, "")
            .await?;
        Ok(manifest.version.clone())
    }

    pub async fn status(&self) -> AppResult<Option<UpdateJobStatus>> {
        self.installer.status().await
    }
}
