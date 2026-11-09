//! Yetkili güncelleyici. Root olarak, kısa ömürlü bir systemd işi içinde çalışır.
//!
//! Uygulama süreci ele geçirilmiş olsa bile kötü amaçlı paket kurulamasın diye
//! `request.json` içeriğine güvenilmez: imza bu ikilinin içindeki anahtarlarla yeniden
//! doğrulanır, paket özeti imzalı bildirimden alınır ve sürüm geri alınamaz.

use crate::config::Config;
use crate::release_keys;
use anyhow::{Context, Result, anyhow, bail};
use dosyapi_core::ports::{UpdateJobStatus, UpdateManifest};
use dosyapi_infra::update::*;
use semver::Version;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};

pub struct UpdaterArgs {
    pub binary: PathBuf,
    pub service: String,
    pub health_url: String,
    pub health_timeout: Duration,
}

fn now() -> i64 {
    time::OffsetDateTime::now_utc().unix_timestamp()
}

/// Durum root'a ait klasöre yazılır. Uygulama süreci bu klasöre yazamadığı için
/// sembolik bağlantıyla root'a başka bir dosyayı ezdiremez.
fn write_status(dir: &Path, status: &str, version: &str, message: &str) {
    let job = UpdateJobStatus {
        state: status.into(),
        version: version.into(),
        message: message.into(),
        at: now(),
    };
    if let Ok(body) = serde_json::to_vec_pretty(&job) {
        let temp = dir.join("status.tmp");
        if std::fs::write(&temp, body).is_ok() {
            let _ = std::fs::rename(&temp, status_path(dir));
        }
    }
}

fn safe_file_name(name: &str) -> Result<&str> {
    if name.is_empty() || name.contains(['/', '\\']) || name.starts_with('.') {
        bail!("geçersiz paket adı");
    }
    Ok(name)
}

fn verified_manifest(state: &Path, channel: &str) -> Result<UpdateManifest> {
    let keys = release_keys::trusted_keys()
        .into_iter()
        .map(parse_public_key)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| anyhow!("{e}"))?;
    if keys.is_empty() {
        bail!("güvenilir anahtar yok");
    }
    let raw = std::fs::read(manifest_path(state)).context("bildirim okunamadı")?;
    let signature = std::fs::read_to_string(signature_path(state)).context("imza okunamadı")?;
    verify_manifest(&keys, &raw, &signature).map_err(|e| anyhow!("{e}"))?;
    decode_manifest(&raw, channel).map_err(|e| anyhow!("{e}"))
}

async fn wait_healthy(url: &str, timeout: Duration) -> bool {
    let Ok(client) = reqwest_client() else {
        return false;
    };
    let start = Instant::now();
    while start.elapsed() < timeout {
        if let Ok(response) = client.get(url).send().await
            && response.status().is_success()
        {
            return true;
        }
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
    false
}

fn reqwest_client() -> Result<dosyapi_infra::update::HealthClient> {
    dosyapi_infra::update::HealthClient::new().map_err(|e| anyhow!("{e}"))
}

fn restart(service: &str) -> Result<()> {
    let status = Command::new("systemctl")
        .args(["restart", service])
        .status()
        .context("systemctl çalıştırılamadı")?;
    if !status.success() {
        bail!("servis yeniden başlatılamadı");
    }
    Ok(())
}

/// Sembolik bağlantı izlemeden, tek bağlantılı normal dosya olarak açar.
fn open_regular(path: &Path) -> Result<std::fs::File> {
    use std::os::unix::fs::{MetadataExt, OpenOptionsExt};
    let file = std::fs::OpenOptions::new()
        .read(true)
        .custom_flags(libc_nofollow())
        .open(path)
        .context("paket açılamadı")?;
    let meta = file.metadata()?;
    if !meta.is_file() || meta.nlink() != 1 {
        bail!("paket normal bir dosya değil");
    }
    Ok(file)
}

#[cfg(target_os = "linux")]
const fn libc_nofollow() -> i32 {
    0o400000
}

#[cfg(not(target_os = "linux"))]
const fn libc_nofollow() -> i32 {
    0x0100
}

/// Paket önce root'a ait klasöre kopyalanır, özeti bu kopya üzerinden doğrulanır.
/// Böylece denetim ile kurulum arasında uygulama süreci dosyayı değiştiremez.
async fn install(staged: &Path, binary: &Path, expected_sha256: &str) -> Result<PathBuf> {
    use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
    let previous = binary.with_extension("prev");
    let incoming = binary.with_extension("new");
    let _ = std::fs::remove_file(&incoming);
    let mut source = open_regular(staged)?;
    let mut target = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o700)
        .open(&incoming)
        .context("geçici dosya açılamadı")?;
    std::io::copy(&mut source, &mut target).context("paket kopyalanamadı")?;
    target.sync_all()?;
    drop(target);
    let digest = sha256_file(&incoming).await.map_err(|e| anyhow!("{e}"))?;
    if digest != expected_sha256.to_lowercase() {
        let _ = std::fs::remove_file(&incoming);
        bail!("paket özeti imzalı bildirimle uyuşmuyor");
    }
    std::fs::copy(binary, &previous).context("mevcut sürüm yedeklenemedi")?;
    std::fs::set_permissions(&incoming, std::fs::Permissions::from_mode(0o755))?;
    std::fs::rename(&incoming, binary).context("yeni sürüm yerleştirilemedi")?;
    Ok(previous)
}

pub async fn run(config: &Config, args: UpdaterArgs) -> Result<()> {
    let state = config.update_state();
    let status_dir = config.update_status();
    std::fs::create_dir_all(&status_dir).context("durum klasörü oluşturulamadı")?;
    let Ok(raw) = std::fs::read(request_path(&state)) else {
        return Ok(());
    };
    let outcome = apply(&state, &status_dir, &raw, &args).await;
    let _ = std::fs::remove_file(request_path(&state));
    match outcome {
        Ok(Outcome::Installed) => Ok(()),
        Ok(Outcome::RolledBack) => bail!("yeni sürüm açılamadı, önceki sürüme dönüldü"),
        Err(error) => {
            write_status(&status_dir, "failed", "", &error.to_string());
            Err(error)
        }
    }
}

enum Outcome {
    Installed,
    RolledBack,
}

async fn apply(state: &Path, status_dir: &Path, raw: &[u8], args: &UpdaterArgs) -> Result<Outcome> {
    let request: UpdateRequest = serde_json::from_slice(raw).context("iş emri okunamadı")?;
    let manifest = verified_manifest(state, &request.channel)?;
    let current = Version::parse(env!("CARGO_PKG_VERSION"))?;
    let target = Version::parse(&manifest.version)?;
    if target <= current {
        bail!("sürüm geri alınamaz: {target} <= {current}");
    }
    let artifact = manifest
        .artifacts
        .iter()
        .find(|a| a.os == std::env::consts::OS && a.arch == std::env::consts::ARCH)
        .ok_or_else(|| anyhow!("bu mimari için paket yok"))?;
    let staged = state.join(safe_file_name(&request.file)?);

    write_status(
        status_dir,
        "installing",
        &manifest.version,
        "Yeni sürüm kuruluyor.",
    );
    let previous = install(&staged, &args.binary, &artifact.sha256).await?;
    restart(&args.service)?;
    if wait_healthy(&args.health_url, args.health_timeout).await {
        write_status(
            status_dir,
            "done",
            &manifest.version,
            "Güncelleme tamamlandı.",
        );
        let _ = std::fs::remove_file(&staged);
        return Ok(Outcome::Installed);
    }

    std::fs::rename(&previous, &args.binary).context("eski sürüme dönülemedi")?;
    restart(&args.service)?;
    let healthy = wait_healthy(&args.health_url, args.health_timeout).await;
    let message = if healthy {
        "Yeni sürüm açılamadı; önceki sürüme geri dönüldü."
    } else {
        "Yeni sürüm açılamadı ve geri dönüş de doğrulanamadı; sunucuyu kontrol edin."
    };
    write_status(status_dir, "rolled_back", &manifest.version, message);
    Ok(Outcome::RolledBack)
}
