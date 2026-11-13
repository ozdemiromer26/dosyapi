//! Sunucu konsolu komutları: master paneli açma/kapatma/sıfırlama, tam yedek, doğrulama,
//! geri yükleme ve fabrika ayarlarına dönüş.
//!
//! Sunucuya konsoldan erişen kişi zaten veriye erişebilir; bu yüzden bu komutlar kimlik
//! sormaz. Yine de her işlem denetim günlüğüne yazılır ve yıkıcı olanlar yazılı onay ister.

use crate::config::Config;
use anyhow::{Result, anyhow, bail};
use dosyapi_core::model::RequestMeta;
use dosyapi_core::ports::{BackupReport, BackupService, Clock, DataEraser};
use dosyapi_core::services::audit::Auditor;
use dosyapi_core::services::dns::DnsConfig;
use dosyapi_core::services::master::MasterService;
use dosyapi_core::services::settings::{KEY_COMPANY, KEY_DNS, Settings};
use dosyapi_infra::backup::{self, BackupKeys, FullBackups, SqliteEraser};
use dosyapi_infra::clock::SystemClock;
use dosyapi_infra::crypto::{ArgonHasher, FieldCipher, HmacTokens, Keyring};
use dosyapi_infra::db::SqlitePool;
use dosyapi_infra::ratelimit::MemoryRateLimiter;
use dosyapi_infra::repos::{Db, SqliteAudit};
use dosyapi_infra::totp::RfcTotp;
use std::io::{BufRead, IsTerminal, Write};
use std::path::Path;
use std::sync::Arc;

fn err(e: dosyapi_core::AppError) -> anyhow::Error {
    anyhow!("{e}")
}

fn meta() -> RequestMeta {
    RequestMeta {
        ip: "sunucu konsolu".into(),
        user_agent: "dosyapi-ctl".into(),
    }
}

/// Konsol komutlarının ortak parçaları. Sunucu çalışırken de güvenle açılır: dosya deposunun
/// geçici klasörüne dokunmaz, göç çalıştırmaz.
struct Console {
    pool: SqlitePool,
    keys: Keyring,
    settings: Settings,
    audit: Auditor,
    clock: Arc<dyn Clock>,
}

async fn open(config: &Config) -> Result<Console> {
    let keys = Keyring::load_or_create(&config.paths.secret_key, false).map_err(err)?;
    if !config.database().exists() {
        bail!("veritabanı bulunamadı: {}", config.database().display());
    }
    let pool = dosyapi_infra::db::connect(&config.database())
        .await
        .map_err(err)?;
    let db = Arc::new(Db::new(
        pool.clone(),
        FieldCipher::new(&keys.derive("field")).map_err(err)?,
    ));
    let settings = Settings::new(
        db,
        Arc::new(FieldCipher::new(&keys.derive("settings")).map_err(err)?),
    );
    let clock: Arc<dyn Clock> = Arc::new(SystemClock);
    let audit = Auditor::new(
        Arc::new(SqliteAudit::new(pool.clone(), &keys)),
        clock.clone(),
    );
    Ok(Console {
        pool,
        keys,
        settings,
        audit,
        clock,
    })
}

impl Console {
    fn master(&self) -> Result<MasterService> {
        let db = Arc::new(Db::new(
            self.pool.clone(),
            FieldCipher::new(&self.keys.derive("field")).map_err(err)?,
        ));
        Ok(MasterService {
            settings: self.settings.clone(),
            sessions: db,
            hasher: Arc::new(ArgonHasher::new().map_err(err)?),
            tokens: Arc::new(HmacTokens::new(&self.keys)),
            totp: Arc::new(RfcTotp),
            limiter: Arc::new(MemoryRateLimiter::default()),
            clock: self.clock.clone(),
            audit: self.audit.clone(),
        })
    }

    fn backups(&self, config: &Config) -> FullBackups {
        FullBackups::new(
            self.pool.clone(),
            config.backups(),
            config.files(),
            config.paths.secret_key.clone(),
            BackupKeys::new(&self.keys),
            Arc::new(tokio::sync::RwLock::new(())),
        )
    }
}

pub async fn master_disable(config: &Config) -> Result<()> {
    let console = open(config).await?;
    console.master()?.disable(&meta()).await.map_err(err)?;
    println!("Sistem paneli devre dışı bırakıldı; açık panel oturumları kapatıldı.");
    println!("Yeniden açmak için: sudo dosyapi-ctl master-enable");
    Ok(())
}

pub async fn master_enable(config: &Config) -> Result<()> {
    let console = open(config).await?;
    console.master()?.enable(&meta()).await.map_err(err)?;
    println!("Sistem paneli etkin; geçici kilit ve hatalı deneme sayacı sıfırlandı.");
    println!("Master şifre değişmedi.");
    Ok(())
}

fn read_line(prompt: &str) -> Result<String> {
    print!("{prompt}");
    std::io::stdout().flush()?;
    let mut line = String::new();
    std::io::stdin().lock().read_line(&mut line)?;
    Ok(line.trim_end_matches(['\r', '\n']).to_string())
}

pub async fn master_reset(config: &Config) -> Result<()> {
    let console = open(config).await?;
    let new_password = read_line(&format!(
        "Yeni master şifre (en az {} karakter): ",
        dosyapi_core::password::MIN_LEN
    ))?;
    console
        .master()?
        .console_reset(&new_password, &meta())
        .await
        .map_err(err)?;
    println!("Master şifre güncellendi; iki adımlı doğrulama ve kilit sıfırlandı.");
    println!("Sistem paneline yeni şifreyle girin.");
    Ok(())
}

fn print_report(report: &BackupReport) {
    let mb = |b: u64| b as f64 / 1_048_576.0;
    if report.created_at > 0 {
        println!(
            "  Alındı: {} · sürüm {}",
            time::OffsetDateTime::from_unix_timestamp(report.created_at)
                .map(|t| t.to_string())
                .unwrap_or_default(),
            report.version
        );
        println!(
            "  Veritabanı: {:.1} MB · Dosyalar: {} adet, {:.1} MB",
            mb(report.db_bytes),
            report.files,
            mb(report.files_bytes)
        );
    }
    println!(
        "  {}: {}",
        if report.ok { "SAĞLAM" } else { "SORUNLU" },
        report.message
    );
}

pub async fn backup(config: &Config) -> Result<()> {
    let console = open(config).await?;
    let service = console.backups(config);
    println!("Tam yedek alınıyor (veritabanı ve dosyalar)…");
    let info = service.create("konsol").await.map_err(err)?;
    let path = config.backups().join(&info.name);
    console
        .audit
        .master(&meta(), "backup.create", &info.name, "konsol")
        .await
        .map_err(err)?;
    println!("Doğrulanıyor…");
    let report = service.verify(&info.name).await.map_err(err)?;
    print_report(&report);
    println!();
    println!("Yedek dosyası : {}", path.display());
    println!("Anahtar dosyası: {}", config.paths.secret_key.display());
    println!("Geri yüklemek için ikisi birlikte gerekir. Anahtarı yedekle aynı yerde saklamayın.");
    if !report.ok {
        bail!("yedek doğrulanamadı");
    }
    Ok(())
}

fn keys_from(config: &Config, secret_key: Option<&Path>) -> Result<BackupKeys> {
    let path = secret_key.unwrap_or(&config.paths.secret_key);
    let keyring = Keyring::load_or_create(path, false)
        .map_err(|e| anyhow!("anahtar dosyası okunamadı ({}): {e}", path.display()))?;
    Ok(BackupKeys::new(&keyring))
}

pub async fn verify(config: &Config, file: &Path, secret_key: Option<&Path>) -> Result<()> {
    let keys = keys_from(config, secret_key)?;
    let scratch = std::env::temp_dir();
    println!("Doğrulanıyor: {}", file.display());
    let report = backup::verify_file(file, &keys, &scratch)
        .await
        .map_err(err)?;
    print_report(&report);
    if !report.ok {
        bail!("yedek doğrulanamadı");
    }
    Ok(())
}

/// Sunucu dinleme adresinde biri yanıt veriyorsa çalışıyordur.
fn server_running(config: &Config) -> bool {
    let mut address = config.server.listen;
    if address.ip().is_unspecified() {
        address.set_ip(std::net::Ipv4Addr::LOCALHOST.into());
    }
    std::net::TcpStream::connect_timeout(&address, std::time::Duration::from_millis(500)).is_ok()
}

fn confirm(prompt: &str) -> Result<bool> {
    let answer = read_line(&format!("{prompt} (evet/hayır) "))?;
    Ok(matches!(
        answer.trim().to_lowercase().as_str(),
        "evet" | "e" | "yes" | "y"
    ))
}

pub async fn restore(
    config: &Config,
    file: &Path,
    secret_key: Option<&Path>,
    yes: bool,
) -> Result<()> {
    if server_running(config) {
        bail!(
            "sunucu çalışıyor ({}); geri yüklemeden önce durdurun",
            config.server.listen
        );
    }
    let keys = keys_from(config, secret_key)?;
    let new_key = match secret_key {
        Some(path) => {
            let given = std::fs::read(path)?;
            let current = std::fs::read(&config.paths.secret_key).unwrap_or_default();
            (given != current).then_some(given)
        }
        None => None,
    };
    println!("Yedek: {}", file.display());
    println!("Mevcut veritabanı ve dosyalar silinmez, 'onceki-<zaman>' klasörüne taşınır.");
    if new_key.is_some() {
        println!(
            "Verilen anahtar dosyası bu sunucunun anahtarının yerine geçecek (eskisi de saklanır)."
        );
    }
    if !yes && !confirm("Devam edilsin mi?")? {
        bail!("vazgeçildi");
    }
    println!("Yedek doğrulanıp çıkarılıyor…");
    let restored = backup::restore_file(file, &keys, &config.database(), &config.files())
        .await
        .map_err(err)?;
    if let Some(key) = new_key {
        let old = restored.previous.join("secret.key");
        std::fs::copy(&config.paths.secret_key, &old).ok();
        let temp = config.paths.secret_key.with_extension("yeni");
        let _ = std::fs::remove_file(&temp);
        dosyapi_infra::crypto::write_private(&temp, &key).map_err(err)?;
        std::fs::rename(&temp, &config.paths.secret_key)?;
    }
    print_report(&restored.report);
    println!(
        "Geri yüklendi. Önceki veriler: {}",
        restored.previous.display()
    );
    println!("Sunucuyu başlatın; açık oturumlar yedekteki duruma döner.");
    Ok(())
}

/// Onay için yazılacak metin: sunucunun alan adı; yoksa şirket adı.
async fn reset_phrase(config: &Config, settings: &Settings) -> Result<String> {
    let dns: Option<DnsConfig> = settings.get_json(KEY_DNS).await.map_err(err)?;
    if let Some(domain) = dns.map(|d| d.domain).filter(|d| !d.is_empty()) {
        return Ok(domain);
    }
    let host = config
        .server
        .public_url
        .split("://")
        .nth(1)
        .unwrap_or_default()
        .split(['/', ':'])
        .next()
        .unwrap_or_default()
        .to_string();
    if !host.is_empty() && host != "localhost" && host.parse::<std::net::IpAddr>().is_err() {
        return Ok(host);
    }
    let company: Option<dosyapi_core::model::Company> =
        settings.get_json(KEY_COMPANY).await.map_err(err)?;
    company
        .map(|c| c.name)
        .filter(|n| !n.trim().is_empty())
        .ok_or_else(|| anyhow!("onay metni belirlenemedi"))
}

pub async fn factory_reset(config: &Config) -> Result<()> {
    if !std::io::stdin().is_terminal() {
        bail!("fabrika ayarlarına dönüş yalnızca etkileşimli bir terminalden yapılabilir");
    }
    let console = open(config).await?;
    let phrase = reset_phrase(config, &console.settings).await?;
    println!();
    println!(
        "DİKKAT: Bu işlem tüm projeleri, belgeleri, kullanıcıları, kayıtları ve ayarları siler."
    );
    println!("Sistem kurulum öncesi hâline döner. Denetim günlüğü korunur.");
    println!(
        "Silmeden önce otomatik bir tam yedek alınır: {}",
        config.backups().display()
    );
    println!();
    println!("Onaylamak için şunu aynen yazın: {phrase}");
    let typed = read_line("> ")?;
    if typed.trim() != phrase {
        bail!("onay metni eşleşmedi; hiçbir şey silinmedi");
    }
    let service = console.backups(config);
    println!("Tam yedek alınıyor…");
    let info = service.create("sifirlama-oncesi").await.map_err(err)?;
    let report = service.verify(&info.name).await.map_err(err)?;
    if !report.ok {
        bail!(
            "silme öncesi yedek doğrulanamadı ({}); hiçbir şey silinmedi",
            report.message
        );
    }
    println!("Yedek: {}", config.backups().join(&info.name).display());
    console
        .audit
        .master(&meta(), "system.factory_reset", "", "konsol")
        .await
        .map_err(err)?;
    SqliteEraser {
        pool: console.pool.clone(),
        files_root: config.files(),
    }
    .erase_all()
    .await
    .map_err(err)?;
    println!("Tüm veriler silindi.");
    Ok(())
}
