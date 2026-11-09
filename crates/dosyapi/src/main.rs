//! dosyapı sunucusu: tek ikili dosya. Kurulum, çalıştırma, yedek ve güncelleme komutları.

mod app;
mod assets;
mod config;
mod http;
mod release_keys;
mod tls;
mod updater;

use anyhow::{Context, Result, anyhow, bail};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use clap::{Parser, Subcommand};
use config::Config;
use dosyapi_core::ports::{BackupService, TokenService};
use dosyapi_core::services::dns::DnsConfig;
use dosyapi_core::services::settings::KEY_DNS;
use dosyapi_infra::crypto::{HmacTokens, Keyring};
use ed25519_dalek::{Signer, SigningKey};
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(
    name = "dosyapi",
    version,
    about = "dosyapı inşaat dosya yönetimi sunucusu"
)]
struct Cli {
    /// Yapılandırma dosyası
    #[arg(
        long,
        env = "DOSYAPI_CONFIG",
        default_value = "/etc/dosyapi/config.toml"
    )]
    config: PathBuf,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Yapılandırmayı, gizli anahtarı ve kurulum belirtecini oluşturur
    Init {
        #[arg(long, default_value = "/var/lib/dosyapi")]
        data_dir: PathBuf,
        #[arg(long, default_value = "/etc/dosyapi/secret.key")]
        secret_key: PathBuf,
        #[arg(long, default_value = "http://127.0.0.1:8080")]
        public_url: String,
        #[arg(long, default_value = "127.0.0.1:8080")]
        listen: SocketAddr,
    },
    /// Sunucuyu başlatır
    Serve,
    /// Veritabanı yedeği alır
    Backup,
    /// Yeni kurulum belirteci üretir (kurulum tamamlanmadıysa; sonra sunucuyu yeniden başlatın)
    SetupToken,
    /// Master şifreyi sunucu konsolundan sıfırlar; iki adımlı doğrulamayı ve kilidi kaldırır
    MasterReset,
    /// Yetkili güncelleyici (systemd tarafından çalıştırılır)
    UpdaterApply {
        #[arg(long, default_value = "/opt/dosyapi/bin/dosyapi")]
        binary: PathBuf,
        #[arg(long, default_value = "dosyapi")]
        service: String,
        #[arg(long, default_value = "http://127.0.0.1:8080/healthz")]
        health_url: String,
        /// Yeni sürümün sağlıklı açılması için beklenecek süre (saniye)
        #[arg(long, default_value_t = 90)]
        health_timeout: u64,
    },
    /// Sürüm imzalama anahtar çifti üretir (yalnızca yayıncı için)
    ReleaseKeygen {
        #[arg(long)]
        out: PathBuf,
    },
    /// Güncelleme bildirimini imzalar (yalnızca yayıncı için)
    ReleaseSign {
        #[arg(long)]
        key: PathBuf,
        #[arg(long)]
        manifest: PathBuf,
    },
}

fn init_tracing() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,sqlx=warn,hyper=warn"));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .init();
}

fn keyring(config: &Config, create: bool) -> Result<Keyring> {
    Keyring::load_or_create(&config.paths.secret_key, create).map_err(|e| anyhow!("{e:?}"))
}

/// Kurulum belirteci yalnızca sunucuya erişebilen kişide olur. Dosyada özet tutulur.
fn write_setup_token(config: &Config, keys: &Keyring) -> Result<String> {
    let tokens = HmacTokens::new(keys);
    let token = tokens.generate();
    let path = config.setup_token_file();
    let _ = std::fs::remove_file(&path);
    std::fs::create_dir_all(&config.paths.data_dir)?;
    dosyapi_infra::crypto::write_private(&path, hex::encode(tokens.hash(&token)).as_bytes())
        .map_err(|e| anyhow!("{e:?}"))?;
    Ok(token)
}

fn read_setup_hash(config: &Config) -> Vec<u8> {
    std::fs::read_to_string(config.setup_token_file())
        .ok()
        .and_then(|text| hex::decode(text.trim()).ok())
        .unwrap_or_default()
}

fn init(
    path: &Path,
    data_dir: PathBuf,
    secret_key: PathBuf,
    public_url: String,
    listen: SocketAddr,
) -> Result<()> {
    if path.exists() {
        bail!("{} zaten var; üzerine yazılmadı", path.display());
    }
    let config = Config::default_for(&data_dir, &secret_key, &public_url, listen);
    config.validate()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let keys = keyring(&config, true)?;
    std::fs::write(path, toml::to_string_pretty(&config)?)?;
    let token = write_setup_token(&config, &keys)?;
    println!("Yapılandırma: {}", path.display());
    println!(
        "Gizli anahtar: {} (yedekleyin, kaybolursa veriler açılamaz)",
        secret_key.display()
    );
    println!("Kurulum belirteci: {token}");
    println!("Tarayıcıdan {public_url} adresini açıp bu belirteçle kurulumu tamamlayın.");
    Ok(())
}

async fn serve(config: Config) -> Result<()> {
    let keys = keyring(&config, false)
        .context("gizli anahtar yüklenemedi; önce `dosyapi init` çalıştırın")?;
    // Hızlı özet yalnızca hata ayıklama derlemesinde vardır; sürüm ikilisinde bu yol yoktur.
    let fast =
        cfg!(debug_assertions) && std::env::var("DOSYAPI_INSECURE_FAST_HASH").as_deref() == Ok("1");
    if fast {
        tracing::warn!("Hızlı parola özeti açık: YALNIZCA test içindir");
    }
    let runtime = app::build(&config, read_setup_hash(&config), keys, fast).await?;
    let services = Arc::new(runtime.services.clone());
    services
        .updates
        .record_running_version()
        .await
        .context("kurulu sürüm kaydedilemedi")?;

    let sweeper = services.clone();
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(3600));
        loop {
            tick.tick().await;
            if let Err(error) = sweeper
                .session_repo
                .purge_expired(sweeper.clock.now())
                .await
            {
                tracing::warn!(?error, "oturum temizliği başarısız");
            }
        }
    });
    let backup = services.backups.clone();
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(24 * 3600));
        tick.tick().await;
        loop {
            tick.tick().await;
            if let Err(error) = backup.create("gunluk").await {
                tracing::warn!(?error, "günlük yedek alınamadı");
            }
        }
    });

    let state = http::AppState {
        services: services.clone(),
        public_url: runtime.public_url.clone(),
        trust_proxy: config.server.trust_proxy,
    };
    let router = http::router(state);

    let dns: Option<DnsConfig> = services.settings.get_json(KEY_DNS).await.unwrap_or(None);
    if let (Some(dns), Some(https)) = (dns.filter(|d| d.acme), config.server.https_listen) {
        tracing::info!(domain = %dns.domain, "yerleşik HTTPS açık");
        return tls::serve(&runtime, &config, &dns, https, router).await;
    }

    let listener = tokio::net::TcpListener::bind(config.server.listen)
        .await
        .context("adres dinlenemedi")?;
    tracing::info!(address = %config.server.listen, version = env!("CARGO_PKG_VERSION"), "dosyapı hazır");
    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;
    Ok(())
}

/// Sunucu konsoluna erişen kişi zaten veriye erişebilir; bu yüzden tek kurtarma yolu budur.
async fn master_reset(config: &Config) -> Result<()> {
    use dosyapi_core::password;
    use dosyapi_core::ports::{PasswordHasher, SettingsRepo};
    use dosyapi_core::services::settings::{KEY_MASTER_HASH, KEY_MASTER_LOCK, KEY_MASTER_TOTP};
    println!("Yeni master şifre (en az {} karakter):", password::MIN_LEN);
    let mut line = String::new();
    std::io::stdin().read_line(&mut line)?;
    let new_password = line.trim_end_matches(['\r', '\n']);
    password::check(new_password, &[]).map_err(|e| anyhow!("{e}"))?;
    let keys = keyring(config, false)?;
    let pool = dosyapi_infra::db::connect(&config.database())
        .await
        .map_err(|e| anyhow!("{e:?}"))?;
    let cipher = dosyapi_infra::crypto::FieldCipher::new(&keys.derive("field"))
        .map_err(|e| anyhow!("{e:?}"))?;
    let db = dosyapi_infra::repos::Db::new(pool, cipher);
    let hash = dosyapi_infra::crypto::ArgonHasher::new()
        .map_err(|e| anyhow!("{e:?}"))?
        .hash(new_password)
        .map_err(|e| anyhow!("{e:?}"))?;
    let stored = serde_json::to_string(&hash)?;
    db.set(KEY_MASTER_HASH, &stored)
        .await
        .map_err(|e| anyhow!("{e:?}"))?;
    db.remove(KEY_MASTER_TOTP)
        .await
        .map_err(|e| anyhow!("{e:?}"))?;
    db.remove(KEY_MASTER_LOCK)
        .await
        .map_err(|e| anyhow!("{e:?}"))?;
    println!("Master şifre güncellendi. Sistem paneline yeni şifreyle girin.");
    Ok(())
}

/// systemd SIGTERM gönderir; süren istekler tamamlanıp temiz kapanılır.
async fn shutdown_signal() {
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };
    tokio::select! {
        _ = tokio::signal::ctrl_c() => {}
        () = terminate => {}
    }
}

fn release_keygen(out: &Path) -> Result<()> {
    let seed = dosyapi_infra::crypto::random_bytes::<32>();
    let key = SigningKey::from_bytes(&seed);
    dosyapi_infra::crypto::write_private(out, hex::encode(seed).as_bytes())
        .map_err(|e| anyhow!("{e:?}"))?;
    println!("Gizli anahtar: {} (depoya koymayın)", out.display());
    println!(
        "Açık anahtar: {}",
        hex::encode(key.verifying_key().to_bytes())
    );
    Ok(())
}

fn release_sign(key: &Path, manifest: &Path) -> Result<()> {
    let seed: [u8; 32] = hex::decode(std::fs::read_to_string(key)?.trim())?
        .try_into()
        .map_err(|_| anyhow!("anahtar uzunluğu hatalı"))?;
    let body = std::fs::read(manifest)?;
    let _: dosyapi_core::ports::UpdateManifest =
        serde_json::from_slice(&body).context("bildirim geçersiz")?;
    let signature = SigningKey::from_bytes(&seed).sign(&body);
    let target = format!("{}.sig", manifest.display());
    std::fs::write(&target, STANDARD.encode(signature.to_bytes()))?;
    println!("İmza yazıldı: {target}");
    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Command::Init {
            data_dir,
            secret_key,
            public_url,
            listen,
        } => init(&cli.config, data_dir, secret_key, public_url, listen),
        Command::ReleaseKeygen { out } => release_keygen(&out),
        Command::ReleaseSign { key, manifest } => release_sign(&key, &manifest),
        Command::Serve => {
            init_tracing();
            serve(Config::load(&cli.config)?).await
        }
        Command::Backup => {
            let config = Config::load(&cli.config)?;
            let pool = dosyapi_infra::db::connect(&config.database())
                .await
                .map_err(|e| anyhow!("{e:?}"))?;
            let service = dosyapi_infra::backup::SqliteBackups {
                pool,
                dir: config.backups(),
            };
            let info = service.create("cli").await.map_err(|e| anyhow!("{e:?}"))?;
            println!("Yedek: {}", config.backups().join(info.name).display());
            Ok(())
        }
        Command::SetupToken => {
            let config = Config::load(&cli.config)?;
            let keys = keyring(&config, false)?;
            println!("Kurulum belirteci: {}", write_setup_token(&config, &keys)?);
            println!("Kurulum tamamlanmışsa bu belirteç işe yaramaz.");
            Ok(())
        }
        Command::MasterReset => master_reset(&Config::load(&cli.config)?).await,
        Command::UpdaterApply {
            binary,
            service,
            health_url,
            health_timeout,
        } => {
            init_tracing();
            let config = Config::load(&cli.config)?;
            updater::run(
                &config,
                updater::UpdaterArgs {
                    binary,
                    service,
                    health_url,
                    health_timeout: Duration::from_secs(health_timeout),
                },
            )
            .await
        }
    }
}
