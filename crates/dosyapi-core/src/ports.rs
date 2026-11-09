//! Çekirdeğin dış dünyadan beklediği arayüzler. Her arayüz dar tutulur
//! (arayüz ayrımı); servisler yalnızca ihtiyaç duyduklarını alır.

use crate::error::AppResult;
use crate::model::*;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

pub trait Clock: Send + Sync {
    fn now(&self) -> Timestamp;
}

#[async_trait]
pub trait SettingsRepo: Send + Sync {
    async fn get(&self, key: &str) -> AppResult<Option<String>>;
    async fn set(&self, key: &str, value: &str) -> AppResult<()>;
    async fn remove(&self, key: &str) -> AppResult<()>;
}

#[async_trait]
pub trait UserRepo: Send + Sync {
    async fn get(&self, id: &str) -> AppResult<Option<User>>;
    async fn by_email(&self, email: &str) -> AppResult<Option<User>>;
    async fn list(&self) -> AppResult<Vec<User>>;
    async fn insert(&self, user: &User) -> AppResult<()>;
    async fn update_profile(&self, id: &str, name: &str, email: &str, phone: &str)
    -> AppResult<()>;
    async fn set_role(&self, id: &str, role_id: Option<&str>, status: UserStatus) -> AppResult<()>;
    async fn set_password(&self, id: &str, hash: &str, must_change: bool) -> AppResult<()>;
    async fn set_login_state(
        &self,
        id: &str,
        failed: i64,
        locked_until: Option<Timestamp>,
    ) -> AppResult<()>;
    /// Kapatılırken (`enabled = false`) son adım sıfırlanır ve kurtarma kodları silinir.
    async fn set_totp(&self, id: &str, secret: Option<&str>, enabled: bool) -> AppResult<()>;
    /// Adım yalnızca ileri gidebilir; eşzamanlı iki girişte yalnızca biri `true` alır.
    async fn advance_totp_step(&self, id: &str, step: i64) -> AppResult<bool>;
    async fn replace_recovery(&self, id: &str, hashes: &[String]) -> AppResult<()>;
    /// Kodu tek seferde siler; silinen satır yoksa kod geçersiz ya da kullanılmıştır.
    async fn consume_recovery(&self, id: &str, hash: &str) -> AppResult<bool>;
    async fn count_recovery(&self, id: &str) -> AppResult<i64>;
    async fn delete(&self, id: &str) -> AppResult<()>;
    async fn count_in_role(&self, role_id: &str) -> AppResult<i64>;
}

#[async_trait]
pub trait RoleRepo: Send + Sync {
    async fn list(&self) -> AppResult<Vec<Role>>;
    async fn get(&self, id: &str) -> AppResult<Option<Role>>;
    async fn insert(&self, role: &Role) -> AppResult<()>;
    async fn update(&self, role: &Role) -> AppResult<()>;
    async fn delete(&self, id: &str) -> AppResult<()>;
}

#[async_trait]
pub trait SessionRepo: Send + Sync {
    async fn insert(&self, session: &Session) -> AppResult<()>;
    async fn find(&self, token_hash: &[u8]) -> AppResult<Option<Session>>;
    async fn touch(&self, token_hash: &[u8], last_seen: Timestamp) -> AppResult<()>;
    async fn delete(&self, token_hash: &[u8]) -> AppResult<()>;
    async fn delete_for_user(&self, user_id: &str, except: Option<&[u8]>) -> AppResult<()>;
    async fn delete_kind(&self, kind: SessionKind) -> AppResult<()>;
    async fn purge_expired(&self, now: Timestamp) -> AppResult<()>;
}

#[async_trait]
pub trait TokenRepo: Send + Sync {
    /// Kullanıcının aynı amaçlı eski belirteçlerini geçersiz kılar ve yenisini yazar.
    async fn replace(
        &self,
        token_hash: &[u8],
        purpose: &str,
        user_id: &str,
        expires_at: Timestamp,
    ) -> AppResult<()>;
    /// Belirteci atomik olarak tüketir; yalnızca bir kez başarılı olur.
    async fn consume(
        &self,
        token_hash: &[u8],
        purpose: &str,
        now: Timestamp,
    ) -> AppResult<Option<Id>>;
}

#[async_trait]
pub trait ProjectRepo: Send + Sync {
    async fn list(&self) -> AppResult<Vec<Project>>;
    async fn get(&self, id: &str) -> AppResult<Option<Project>>;
    async fn insert(&self, project: &Project) -> AppResult<()>;
    async fn update(&self, project: &Project) -> AppResult<()>;
    async fn delete(&self, id: &str) -> AppResult<()>;
    async fn set_authors(&self, id: &str, author_ids: &[Id]) -> AppResult<()>;
    async fn uses_contractor(&self, contractor_id: &str) -> AppResult<bool>;
    /// Fotoğraf türünü ve zamanını yazar; boş tür fotoğrafın kaldırıldığını belirtir.
    async fn set_photo(&self, id: &str, mime: &str, at: Timestamp) -> AppResult<()>;
}

#[async_trait]
pub trait AuthorRepo: Send + Sync {
    async fn list(&self) -> AppResult<Vec<Author>>;
    async fn get(&self, id: &str) -> AppResult<Option<Author>>;
    async fn insert(&self, author: &Author) -> AppResult<()>;
    async fn update(&self, author: &Author) -> AppResult<()>;
    async fn delete(&self, id: &str) -> AppResult<()>;
}

#[async_trait]
pub trait ContractorRepo: Send + Sync {
    async fn list(&self) -> AppResult<Vec<Contractor>>;
    async fn get(&self, id: &str) -> AppResult<Option<Contractor>>;
    async fn insert(&self, contractor: &Contractor) -> AppResult<()>;
    async fn update(&self, contractor: &Contractor) -> AppResult<()>;
    async fn delete(&self, id: &str) -> AppResult<()>;
}

#[async_trait]
pub trait TaskRepo: Send + Sync {
    async fn list(&self) -> AppResult<Vec<Task>>;
    async fn get(&self, id: &str) -> AppResult<Option<Task>>;
    async fn insert(&self, task: &Task) -> AppResult<()>;
    async fn update(&self, task: &Task) -> AppResult<()>;
    async fn set_done(&self, id: &str, done: bool) -> AppResult<()>;
    async fn delete(&self, id: &str) -> AppResult<()>;
}

#[async_trait]
pub trait TodoRepo: Send + Sync {
    async fn list_for(&self, user_id: &str) -> AppResult<Vec<Todo>>;
    async fn get(&self, id: &str) -> AppResult<Option<Todo>>;
    async fn insert(&self, todo: &Todo) -> AppResult<()>;
    async fn set_done(&self, id: &str, done: bool) -> AppResult<()>;
    async fn delete(&self, id: &str) -> AppResult<()>;
}

/// Birebir mesajlaşma. Üyelik denetimi serviste yapılır; depo yalnızca saklar.
#[async_trait]
pub trait MessageRepo: Send + Sync {
    async fn conversation(&self, id: &str) -> AppResult<Option<Conversation>>;
    async fn conversation_between(&self, a: &str, b: &str) -> AppResult<Option<Conversation>>;
    /// Aynı çift için eşzamanlı oluşturmada mevcut konuşmayı döndürür.
    async fn create_conversation(&self, c: &Conversation) -> AppResult<Conversation>;
    async fn list_for(&self, user_id: &str) -> AppResult<Vec<ConversationView>>;
    async fn add_message(&self, m: &Message) -> AppResult<i64>;
    /// `before` verilirse o sıradan önceki en fazla `limit` mesaj (eskiden yeniye sıralı).
    async fn messages(
        &self,
        conversation_id: &str,
        before: Option<i64>,
        limit: i64,
    ) -> AppResult<Vec<Message>>;
    /// Okundu işaretini yalnızca ileri taşır.
    async fn mark_read(&self, conversation_id: &str, user_id: &str, seq: i64) -> AppResult<()>;
    async fn unread_total(&self, user_id: &str) -> AppResult<i64>;
}

/// Kişisel proje notları; anahtar her zaman (kullanıcı, proje) çiftidir.
#[async_trait]
pub trait NoteRepo: Send + Sync {
    async fn get(&self, user_id: &str, project_id: &str) -> AppResult<Option<ProjectNote>>;
    async fn put(&self, user_id: &str, project_id: &str, note: &ProjectNote) -> AppResult<()>;
    async fn delete(&self, user_id: &str, project_id: &str) -> AppResult<()>;
}

#[async_trait]
pub trait DocTypeRepo: Send + Sync {
    async fn list(&self) -> AppResult<Vec<DocType>>;
    async fn get(&self, id: &str) -> AppResult<Option<DocType>>;
    async fn insert(&self, doc_type: &DocType) -> AppResult<()>;
    async fn update(&self, doc_type: &DocType) -> AppResult<()>;
    async fn delete(&self, id: &str) -> AppResult<()>;
}

#[async_trait]
pub trait ProfessionRepo: Send + Sync {
    async fn list(&self) -> AppResult<Vec<Profession>>;
    async fn upsert(&self, profession: &Profession) -> AppResult<()>;
    async fn delete(&self, name: &str) -> AppResult<()>;
}

#[async_trait]
pub trait FileRepo: Send + Sync {
    async fn list(&self) -> AppResult<Vec<StoredFile>>;
    async fn get(&self, id: &str) -> AppResult<Option<StoredFile>>;
    async fn insert(&self, file: &StoredFile) -> AppResult<()>;
    async fn set_state(&self, id: &str, state: FileState) -> AppResult<()>;
    async fn delete(&self, id: &str) -> AppResult<()>;
    async fn in_doc_slot(&self, project_id: &str, doc_type_id: &str) -> AppResult<Vec<StoredFile>>;
    async fn in_project(&self, project_id: &str) -> AppResult<Vec<StoredFile>>;
}

#[async_trait]
pub trait PendingRepo: Send + Sync {
    async fn list(&self) -> AppResult<Vec<Pending>>;
    async fn get(&self, id: &str) -> AppResult<Option<Pending>>;
    async fn insert(&self, pending: &Pending) -> AppResult<()>;
    async fn delete(&self, id: &str) -> AppResult<()>;
}

#[async_trait]
pub trait HistoryRepo: Send + Sync {
    async fn list(&self, limit: i64) -> AppResult<Vec<HistoryEntry>>;
    async fn insert(&self, entry: &HistoryEntry) -> AppResult<()>;
}

#[async_trait]
pub trait TemplateRepo: Send + Sync {
    async fn list(&self) -> AppResult<Vec<Template>>;
    async fn get(&self, id: &str) -> AppResult<Option<Template>>;
    async fn upsert(&self, template: &Template) -> AppResult<()>;
    async fn delete(&self, id: &str) -> AppResult<()>;
}

/// Değiştirilemez, hash zincirli denetim günlüğü.
#[async_trait]
pub trait AuditRepo: Send + Sync {
    async fn append(&self, event: AuditEvent, at: Timestamp) -> AppResult<()>;
    async fn list(&self, limit: i64, before: Option<i64>) -> AppResult<Vec<AuditRecord>>;
    /// Zincir bozulduysa ilk bozuk kaydın sıra numarasını döner.
    async fn verify(&self) -> AppResult<Option<i64>>;
}

pub trait PasswordHasher: Send + Sync {
    fn hash(&self, password: &str) -> AppResult<String>;
    fn verify(&self, hash: &str, password: &str) -> bool;
    /// Hesap yokken de aynı süre harcanır; kullanıcı numaralandırmayı engeller.
    fn burn(&self, password: &str);
}

pub trait TokenService: Send + Sync {
    fn generate(&self) -> String;
    fn hash(&self, token: &str) -> Vec<u8>;
    fn csrf_token(&self, token_hash: &[u8]) -> String;
    fn csrf_valid(&self, token_hash: &[u8], candidate: &str) -> bool;
    /// Sabit zamanlı bayt karşılaştırması.
    fn csrf_valid_raw(&self, left: &[u8], right: &[u8]) -> bool;
}

/// Ayar değerleri gibi küçük sırları şifreli saklamak için.
pub trait SecretBox: Send + Sync {
    fn seal(&self, context: &str, plaintext: &str) -> AppResult<String>;
    fn open(&self, context: &str, sealed: &str) -> AppResult<String>;
}

pub trait Totp: Send + Sync {
    fn new_secret(&self) -> String;
    fn provisioning_uri(&self, secret: &str, account: &str, issuer: &str) -> AppResult<String>;
    /// Kod geçerliyse eşleşen zaman adımını döndürür; tekrar kullanım denetimi buna dayanır.
    fn verify(&self, secret: &str, code: &str, now: Timestamp) -> Option<i64>;
    /// Kriptografik rastgele, okunaklı kurtarma kodları (xxxx-xxxx-xxxx).
    fn recovery_codes(&self, count: usize) -> Vec<String>;
}

pub trait HtmlSanitizer: Send + Sync {
    fn sanitize(&self, html: &str) -> String;
}

pub trait QrRenderer: Send + Sync {
    fn svg(&self, text: &str) -> AppResult<String>;
}

#[derive(Debug, Clone, Copy)]
pub struct RetryAfter(pub u64);

pub trait RateLimiter: Send + Sync {
    fn hit(&self, key: &str, limit: u32, window_secs: u64) -> Result<(), RetryAfter>;
    fn reset(&self, key: &str);
}

#[derive(Clone, Debug, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    /// Boş gönderilirse mevcut parola korunur; istemciye asla geri dönmez.
    #[serde(default)]
    pub password: String,
    pub from: String,
    #[serde(default = "SmtpConfig::default_tls")]
    pub tls: String,
}

impl SmtpConfig {
    fn default_tls() -> String {
        "starttls".into()
    }
}

#[derive(Clone, Debug)]
pub struct Mail {
    pub to: String,
    pub subject: String,
    pub body: String,
}

#[async_trait]
pub trait Mailer: Send + Sync {
    async fn send(&self, config: &SmtpConfig, mail: Mail) -> AppResult<()>;
}

#[async_trait]
pub trait FileSink: Send {
    async fn write(&mut self, chunk: &[u8]) -> AppResult<()>;
    async fn finish(self: Box<Self>) -> AppResult<()>;
    async fn abort(self: Box<Self>);
}

#[async_trait]
pub trait FileSource: Send {
    async fn next_chunk(&mut self) -> AppResult<Option<Vec<u8>>>;
}

/// Kullanıcı dosyası deposu. Uygulama adı diske hiç yazılmaz; anahtar yalnızca kimliktir.
#[async_trait]
pub trait FileStore: Send + Sync {
    async fn create(&self, id: &str) -> AppResult<Box<dyn FileSink>>;
    async fn open(&self, id: &str) -> AppResult<Box<dyn FileSource>>;
    async fn delete(&self, id: &str) -> AppResult<()>;
    /// Tek parça küçük varlıklar (logo) için.
    async fn put_small(&self, id: &str, bytes: &[u8]) -> AppResult<()>;
    async fn get_small(&self, id: &str) -> AppResult<Option<Vec<u8>>>;
}

/// HTTP gövdesinin parça parça okunması; core tarafı akış türünü bilmez.
#[async_trait]
pub trait ChunkReader: Send {
    async fn next_chunk(&mut self) -> AppResult<Option<Vec<u8>>>;
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum RecordType {
    A,
    Aaaa,
    Cname,
    Txt,
    Mx,
    Caa,
}

impl RecordType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::A => "A",
            Self::Aaaa => "AAAA",
            Self::Cname => "CNAME",
            Self::Txt => "TXT",
            Self::Mx => "MX",
            Self::Caa => "CAA",
        }
    }
}

#[async_trait]
pub trait DnsResolver: Send + Sync {
    async fn lookup(&self, name: &str, record: &RecordType) -> AppResult<Vec<String>>;
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DnsRecord {
    pub record_type: RecordType,
    pub name: String,
    pub value: String,
}

/// DNS sağlayıcısına kayıt yazan adaptör. Yeni sağlayıcı eklemek için yalnızca
/// bu arayüz uygulanır; servis değişmez (açık/kapalı ilkesi).
#[async_trait]
pub trait DnsProvider: Send + Sync {
    fn id(&self) -> &'static str;
    async fn upsert(&self, api_token: &str, zone: &str, record: &DnsRecord) -> AppResult<()>;
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateArtifact {
    pub os: String,
    pub arch: String,
    pub url: String,
    pub sha256: String,
    pub size: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateManifest {
    pub product: String,
    pub channel: String,
    pub version: String,
    pub released_at: String,
    pub notes: String,
    /// Bu sürüme geçebilmek için gereken en düşük kurulu sürüm.
    pub min_version: String,
    pub artifacts: Vec<UpdateArtifact>,
}

/// İmzası doğrulanmış bildirim. Ham bayt ve imza saklanır: yetkili güncelleyici
/// uygulama sürecine güvenmeden imzayı kendisi yeniden doğrular.
#[derive(Clone, Debug)]
pub struct SignedManifest {
    pub manifest: UpdateManifest,
    pub raw: Vec<u8>,
    pub signature: String,
}

/// İmzası doğrulanmış bildirimi getirir; imza geçersizse hata döner.
#[async_trait]
pub trait UpdateSource: Send + Sync {
    async fn fetch_manifest(&self, channel: &str) -> AppResult<SignedManifest>;
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateJobStatus {
    pub state: String,
    pub version: String,
    pub message: String,
    pub at: Timestamp,
}

/// Paketi indirip doğrular ve yetkili güncelleyiciye iş bırakır.
#[async_trait]
pub trait UpdateInstaller: Send + Sync {
    fn supported(&self) -> bool;
    async fn stage_and_request(
        &self,
        signed: &SignedManifest,
        artifact: &UpdateArtifact,
    ) -> AppResult<()>;
    async fn status(&self) -> AppResult<Option<UpdateJobStatus>>;
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub name: String,
    pub size: u64,
    pub at: Timestamp,
}

#[async_trait]
pub trait BackupService: Send + Sync {
    async fn create(&self, label: &str) -> AppResult<BackupInfo>;
    async fn list(&self) -> AppResult<Vec<BackupInfo>>;
}

/// Tüm veriyi silip kurulum öncesi hâle döndürür.
#[async_trait]
pub trait DataEraser: Send + Sync {
    async fn erase_all(&self) -> AppResult<()>;
}
