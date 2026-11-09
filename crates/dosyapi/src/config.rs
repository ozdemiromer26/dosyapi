//! Sunucu yapılandırması (`config.toml`). Sırlar burada değil, ayrı anahtar dosyasında.

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub server: ServerConfig,
    pub paths: PathsConfig,
    #[serde(default)]
    pub update: UpdateConfig,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ServerConfig {
    /// Dinlenecek adres. Ters vekil arkasında `127.0.0.1:8080`.
    pub listen: SocketAddr,
    /// Dışarıdan görünen adres; bağlantılar ve köken denetimi bunu kullanır.
    pub public_url: String,
    /// Yalnızca güvenilir ters vekil arkasındaysa açın: `X-Forwarded-For` okunur.
    #[serde(default)]
    pub trust_proxy: bool,
    /// Yerleşik HTTPS dinleme adresi (Let's Encrypt). Boşsa TLS ters vekilde sonlanır.
    #[serde(default)]
    pub https_listen: Option<SocketAddr>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PathsConfig {
    pub data_dir: PathBuf,
    pub secret_key: PathBuf,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdateConfig {
    /// İmzalı bildirimlerin alındığı adres. Boşsa derlemedeki varsayılan kullanılır.
    #[serde(default)]
    pub base_url: String,
    /// `systemd`: yetkili güncelleyici kurulu. `none`: elle güncelleme (Docker vb.).
    #[serde(default = "UpdateConfig::default_installer")]
    pub installer: String,
    /// Yalnızca test: 127.0.0.1 üzerinde düz HTTP'ye izin verir.
    #[serde(default)]
    pub allow_insecure_localhost: bool,
}

impl UpdateConfig {
    fn default_installer() -> String {
        "none".into()
    }
}

impl Default for UpdateConfig {
    fn default() -> Self {
        Self {
            base_url: String::new(),
            installer: Self::default_installer(),
            allow_insecure_localhost: false,
        }
    }
}

impl Config {
    pub fn load(path: &Path) -> Result<Self> {
        let text = std::fs::read_to_string(path)
            .with_context(|| format!("{} okunamadı", path.display()))?;
        let config: Self =
            toml::from_str(&text).with_context(|| format!("{} geçersiz", path.display()))?;
        config.validate()?;
        Ok(config)
    }

    pub fn validate(&self) -> Result<()> {
        let url = &self.server.public_url;
        if !(url.starts_with("http://") || url.starts_with("https://")) {
            bail!("server.public_url http:// veya https:// ile başlamalı");
        }
        Ok(())
    }

    pub fn default_for(
        data_dir: &Path,
        secret_key: &Path,
        public_url: &str,
        listen: SocketAddr,
    ) -> Self {
        Self {
            server: ServerConfig {
                listen,
                public_url: public_url.to_string(),
                trust_proxy: false,
                https_listen: None,
            },
            paths: PathsConfig {
                data_dir: data_dir.to_path_buf(),
                secret_key: secret_key.to_path_buf(),
            },
            update: UpdateConfig::default(),
        }
    }

    pub fn database(&self) -> PathBuf {
        self.paths.data_dir.join("dosyapi.sqlite")
    }
    pub fn files(&self) -> PathBuf {
        self.paths.data_dir.join("files")
    }
    pub fn backups(&self) -> PathBuf {
        self.paths.data_dir.join("backups")
    }
    pub fn update_state(&self) -> PathBuf {
        self.paths.data_dir.join("update")
    }
    /// Yalnızca root'un yazabildiği, uygulamanın okuyabildiği klasör.
    pub fn update_status(&self) -> PathBuf {
        self.paths.data_dir.join("update-status")
    }
    pub fn acme_cache(&self) -> PathBuf {
        self.paths.data_dir.join("acme")
    }
    pub fn setup_token_file(&self) -> PathBuf {
        self.paths.data_dir.join("setup-token")
    }
}
