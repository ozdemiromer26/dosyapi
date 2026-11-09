//! Bileşim kökü: somut adaptörler burada servislere bağlanır. Bağımlılıkların
//! nereden geldiğini bilen tek yer burasıdır.

use crate::config::Config;
use crate::release_keys;
use anyhow::{Context, Result};
use dosyapi_core::model::Template;
use dosyapi_core::ports::*;
use dosyapi_core::services::approvals::ApprovalService;
use dosyapi_core::services::audit::Auditor;
use dosyapi_core::services::auth::AuthService;
use dosyapi_core::services::bootstrap::BootstrapService;
use dosyapi_core::services::changes::{ChangeApplier, ChangeGate};
use dosyapi_core::services::company::CompanyService;
use dosyapi_core::services::dns::DnsService;
use dosyapi_core::services::files::FileService;
use dosyapi_core::services::mail::MailService;
use dosyapi_core::services::master::MasterService;
use dosyapi_core::services::projects::ProjectService;
use dosyapi_core::services::records::RecordService;
use dosyapi_core::services::roles::RoleService;
use dosyapi_core::services::settings::Settings;
use dosyapi_core::services::setup::{SeedData, SetupService};
use dosyapi_core::services::tasks::TaskService;
use dosyapi_core::services::templates::TemplateService;
use dosyapi_core::services::updates::UpdateService;
use dosyapi_core::services::users::UserService;
use dosyapi_infra::backup::{SqliteBackups, SqliteEraser};
use dosyapi_infra::clock::SystemClock;
use dosyapi_infra::crypto::{ArgonHasher, FieldCipher, HmacTokens, Keyring};
use dosyapi_infra::db;
use dosyapi_infra::dns::{CloudflareProvider, PublicDnsResolver};
use dosyapi_infra::mail::SmtpMailer;
use dosyapi_infra::qr::SvgQr;
use dosyapi_infra::ratelimit::MemoryRateLimiter;
use dosyapi_infra::repos::{Db, SqliteAudit};
use dosyapi_infra::sanitize::AmmoniaSanitizer;
use dosyapi_infra::store::EncryptedFileStore;
use dosyapi_infra::totp::RfcTotp;
use dosyapi_infra::update::{HttpUpdateSource, StagedInstaller, parse_public_key};
use std::sync::{Arc, RwLock};

const SEED_TEMPLATES: &str = include_str!("../seed/templates.json");

/// Çalışma sırasında değişebilen, dışarıdan görünen adres (DNS ayarından gelir).
#[derive(Clone)]
pub struct PublicUrl(Arc<RwLock<String>>);

impl PublicUrl {
    pub fn new(value: String) -> Self {
        Self(Arc::new(RwLock::new(value)))
    }
    pub fn get(&self) -> String {
        self.0.read().map(|v| v.clone()).unwrap_or_default()
    }
    pub fn set(&self, value: String) {
        if let Ok(mut slot) = self.0.write() {
            *slot = value;
        }
    }
}

#[derive(Clone)]
pub struct Services {
    pub auth: AuthService,
    pub master: MasterService,
    pub setup: SetupService,
    pub users: UserService,
    pub roles: RoleService,
    pub company: CompanyService,
    pub projects: ProjectService,
    pub records: RecordService,
    pub approvals: ApprovalService,
    pub files: FileService,
    pub tasks: TaskService,
    pub templates: TemplateService,
    pub bootstrap: BootstrapService,
    pub dns: DnsService,
    pub updates: UpdateService,
    pub mail: MailService,
    pub settings: Settings,
    pub backups: Arc<dyn BackupService>,
    pub eraser: Arc<dyn DataEraser>,
    pub audit_repo: Arc<dyn AuditRepo>,
    pub audit: Auditor,
    pub limiter: Arc<dyn RateLimiter>,
    pub user_repo: Arc<dyn UserRepo>,
    pub role_repo: Arc<dyn RoleRepo>,
    pub session_repo: Arc<dyn SessionRepo>,
    pub project_repo: Arc<dyn ProjectRepo>,
    pub doc_type_repo: Arc<dyn DocTypeRepo>,
    pub clock: Arc<dyn Clock>,
}

pub struct Runtime {
    pub services: Services,
    pub public_url: PublicUrl,
}

fn update_source(config: &Config) -> Result<Arc<dyn UpdateSource>> {
    let keys = release_keys::trusted_keys()
        .into_iter()
        .map(parse_public_key)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| anyhow::anyhow!("{e}"))?;
    let base = if config.update.base_url.is_empty() {
        release_keys::default_update_url()
    } else {
        &config.update.base_url
    };
    let base = if base.is_empty() {
        "https://guncelleme.invalid"
    } else {
        base
    };
    let source = HttpUpdateSource::new(base, keys, config.update.allow_insecure_localhost)
        .map_err(|e| anyhow::anyhow!("{e}"))?;
    Ok(Arc::new(source))
}

pub async fn build(
    config: &Config,
    setup_token_hash: Vec<u8>,
    keyring: Keyring,
    fast_hash: bool,
) -> Result<Runtime> {
    std::fs::create_dir_all(&config.paths.data_dir).context("veri klasörü oluşturulamadı")?;
    let pool = db::connect(&config.database())
        .await
        .map_err(|e| anyhow::anyhow!("{e}"))?;
    db::migrate(&pool)
        .await
        .map_err(|e| anyhow::anyhow!("veritabanı güncellenemedi: {e}"))?;

    let err = |e: dosyapi_core::AppError| anyhow::anyhow!("{e:?}");
    let field_cipher = FieldCipher::new(&keyring.derive("field")).map_err(err)?;
    let settings_cipher = FieldCipher::new(&keyring.derive("settings")).map_err(err)?;
    let file_cipher = FieldCipher::new(&keyring.derive("file-wrap")).map_err(err)?;
    let db = Arc::new(Db::new(pool.clone(), field_cipher));
    let audit_repo: Arc<dyn AuditRepo> = Arc::new(SqliteAudit::new(pool.clone(), &keyring));
    let clock: Arc<dyn Clock> = Arc::new(SystemClock);
    let audit = Auditor::new(audit_repo.clone(), clock.clone());
    let hasher: Arc<dyn PasswordHasher> = Arc::new(
        if fast_hash {
            ArgonHasher::fast_for_tests()
        } else {
            ArgonHasher::new()
        }
        .map_err(err)?,
    );
    let tokens: Arc<dyn TokenService> = Arc::new(HmacTokens::new(&keyring));
    let totp: Arc<dyn Totp> = Arc::new(RfcTotp);
    let limiter: Arc<dyn RateLimiter> = Arc::new(MemoryRateLimiter::default());
    let store: Arc<dyn FileStore> = Arc::new(
        EncryptedFileStore::new(&config.files(), file_cipher)
            .await
            .map_err(err)?,
    );
    let settings = Settings::new(db.clone(), Arc::new(settings_cipher));
    let mail = MailService::new(Arc::new(SmtpMailer), settings.clone());

    let public_url = PublicUrl::new(config.server.public_url.clone());
    let url_reader = public_url.clone();
    let auth = AuthService {
        users: db.clone(),
        roles: db.clone(),
        sessions: db.clone(),
        tokens: db.clone(),
        pendings: db.clone(),
        hasher: hasher.clone(),
        token_service: tokens.clone(),
        totp: totp.clone(),
        limiter: limiter.clone(),
        clock: clock.clone(),
        audit: audit.clone(),
        mail: mail.clone(),
        settings: settings.clone(),
        public_url: Arc::new(move || url_reader.get()),
    };
    let applier = ChangeApplier {
        projects: db.clone(),
        authors: db.clone(),
        contractors: db.clone(),
        files: db.clone(),
        store: store.clone(),
        clock: clock.clone(),
    };
    let gate = ChangeGate {
        applier: applier.clone(),
        pendings: db.clone(),
        clock: clock.clone(),
        audit: audit.clone(),
    };
    let templates = TemplateService {
        templates: db.clone(),
        sanitizer: Arc::new(AmmoniaSanitizer::default()),
        clock: clock.clone(),
        audit: audit.clone(),
    };
    let seed: Vec<Template> =
        serde_json::from_str(SEED_TEMPLATES).context("başlangıç şablonları okunamadı")?;
    let installer_enabled = config.update.installer == "systemd";

    let services = Services {
        master: MasterService {
            settings: settings.clone(),
            sessions: db.clone(),
            hasher: hasher.clone(),
            tokens: tokens.clone(),
            totp: totp.clone(),
            limiter: limiter.clone(),
            clock: clock.clone(),
            audit: audit.clone(),
        },
        setup: SetupService {
            settings: settings.clone(),
            roles: db.clone(),
            users: db.clone(),
            doc_types: db.clone(),
            professions: db.clone(),
            templates: db.clone(),
            template_service: templates.clone(),
            hasher: hasher.clone(),
            tokens: tokens.clone(),
            limiter: limiter.clone(),
            clock: clock.clone(),
            audit: audit.clone(),
            seed: SeedData { templates: seed },
            setup_token_hash,
        },
        users: UserService {
            users: db.clone(),
            roles: db.clone(),
            pendings: db.clone(),
            sessions: db.clone(),
            hasher: hasher.clone(),
            tokens: tokens.clone(),
            settings: settings.clone(),
            mail: mail.clone(),
            auth: auth.clone(),
            clock: clock.clone(),
            audit: audit.clone(),
        },
        roles: RoleService {
            roles: db.clone(),
            users: db.clone(),
            audit: audit.clone(),
        },
        company: CompanyService {
            settings: settings.clone(),
            doc_types: db.clone(),
            professions: db.clone(),
            users: db.clone(),
            store: store.clone(),
            audit: audit.clone(),
        },
        projects: ProjectService {
            gate: gate.clone(),
            projects: db.clone(),
            pendings: db.clone(),
            authors: db.clone(),
            contractors: db.clone(),
            qr: Arc::new(SvgQr),
        },
        records: RecordService {
            gate: gate.clone(),
            authors: db.clone(),
            contractors: db.clone(),
            projects: db.clone(),
            professions: db.clone(),
            pendings: db.clone(),
        },
        approvals: ApprovalService {
            pendings: db.clone(),
            history: db.clone(),
            users: db.clone(),
            roles: db.clone(),
            sessions: db.clone(),
            files: db.clone(),
            store: store.clone(),
            applier,
            clock: clock.clone(),
            audit: audit.clone(),
        },
        files: FileService {
            files: db.clone(),
            store,
            projects: db.clone(),
            doc_types: db.clone(),
            gate,
            clock: clock.clone(),
            audit: audit.clone(),
        },
        tasks: TaskService {
            tasks: db.clone(),
            todos: db.clone(),
            users: db.clone(),
            roles: db.clone(),
            projects: db.clone(),
            notes: db.clone(),
            clock: clock.clone(),
            audit: audit.clone(),
        },
        templates,
        bootstrap: BootstrapService {
            settings: settings.clone(),
            roles: db.clone(),
            users: db.clone(),
            doc_types: db.clone(),
            professions: db.clone(),
            projects: db.clone(),
            authors: db.clone(),
            contractors: db.clone(),
            tasks: db.clone(),
            todos: db.clone(),
            pendings: db.clone(),
            history: db.clone(),
            templates: db.clone(),
            files: db.clone(),
            version: env!("CARGO_PKG_VERSION").into(),
        },
        dns: DnsService {
            settings: settings.clone(),
            resolver: Arc::new(PublicDnsResolver::new().map_err(err)?),
            providers: vec![Arc::new(CloudflareProvider::new().map_err(err)?)],
            audit: audit.clone(),
        },
        updates: UpdateService {
            source: update_source(config)?,
            installer: Arc::new(
                StagedInstaller::new(
                    config.update_state(),
                    config.update_status(),
                    installer_enabled,
                    config.update.allow_insecure_localhost,
                )
                .map_err(err)?,
            ),
            settings: settings.clone(),
            clock: clock.clone(),
            audit: audit.clone(),
            current_version: env!("CARGO_PKG_VERSION").into(),
            os: std::env::consts::OS.into(),
            arch: std::env::consts::ARCH.into(),
        },
        mail,
        settings,
        backups: Arc::new(SqliteBackups {
            pool: pool.clone(),
            dir: config.backups(),
        }),
        eraser: Arc::new(SqliteEraser {
            pool: pool.clone(),
            files_root: config.files(),
        }),
        audit_repo,
        audit,
        limiter,
        user_repo: db.clone(),
        role_repo: db.clone(),
        session_repo: db.clone(),
        project_repo: db.clone(),
        doc_type_repo: db.clone(),
        clock,
        auth,
    };
    Ok(Runtime {
        services,
        public_url,
    })
}
