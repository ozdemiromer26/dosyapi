//! Alan modeli. `*Input` türleri dış dünyadan gelen veridir ve
//! `deny_unknown_fields` ile toplu atama (mass assignment) saldırılarını keser.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub type Id = String;
/// Unix zamanı (saniye).
pub type Timestamp = i64;

pub fn new_id() -> Id {
    uuid::Uuid::new_v4().to_string()
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AccessMode {
    Edit,
    Approve,
    Read,
    None,
}

impl AccessMode {
    pub fn can_read(self) -> bool {
        self != Self::None
    }
    pub fn can_write(self) -> bool {
        matches!(self, Self::Edit | Self::Approve)
    }
    pub fn is_direct(self) -> bool {
        self == Self::Edit
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Permissions {
    pub projects: AccessMode,
    pub records: AccessMode,
    pub company: bool,
    pub users: bool,
    pub approve: bool,
    pub tasks: bool,
    pub files: bool,
    #[serde(default)]
    pub templates: bool,
    /// Bu rolün yönetebileceği alt rollerin kimlikleri.
    #[serde(default)]
    pub manage: Vec<Id>,
}

impl Permissions {
    pub fn top() -> Self {
        Self {
            projects: AccessMode::Edit,
            records: AccessMode::Edit,
            company: true,
            users: true,
            approve: true,
            tasks: true,
            files: true,
            templates: true,
            manage: vec![],
        }
    }
    pub fn minimal() -> Self {
        Self {
            projects: AccessMode::Read,
            records: AccessMode::None,
            company: false,
            users: false,
            approve: false,
            tasks: false,
            files: false,
            templates: false,
            manage: vec![],
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Role {
    pub id: Id,
    pub name: String,
    pub level: i64,
    pub perms: Permissions,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UserStatus {
    Pending,
    Active,
}

impl UserStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Active => "active",
        }
    }
}

#[derive(Clone, Debug)]
pub struct User {
    pub id: Id,
    pub name: String,
    pub email: String,
    pub phone: String,
    pub password_hash: String,
    pub role_id: Option<Id>,
    pub status: UserStatus,
    pub must_change_password: bool,
    pub totp_secret: Option<String>,
    pub totp_enabled: bool,
    pub failed_logins: i64,
    pub locked_until: Option<Timestamp>,
    pub notice_accepted_at: Option<Timestamp>,
    pub created_at: Timestamp,
}

/// Kimliği doğrulanmış kullanıcı ve o anki rolü. Yetki kararlarının tek girdisi.
#[derive(Clone, Debug)]
pub struct Actor {
    pub user_id: Id,
    pub name: String,
    pub email: String,
    pub role: Role,
    pub must_change_password: bool,
    pub totp_enabled: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionKind {
    User,
    Master,
}

impl SessionKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::User => "user",
            Self::Master => "master",
        }
    }
}

#[derive(Clone, Debug)]
pub struct Session {
    pub token_hash: Vec<u8>,
    pub kind: SessionKind,
    pub user_id: Option<Id>,
    pub created_at: Timestamp,
    pub last_seen_at: Timestamp,
    pub expires_at: Timestamp,
    pub idle_seconds: i64,
    pub persistent: bool,
    pub ip: String,
    pub user_agent: String,
}

/// İstek bağlamı: denetim kaydı ve hız sınırı için.
#[derive(Clone, Debug, Default)]
pub struct RequestMeta {
    pub ip: String,
    pub user_agent: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProjectStatus {
    Etut,
    Uygulama,
    Denetim,
    Belediye,
    Mimari,
    Tumproje,
    Ruhsat,
    Iskan,
}

impl ProjectStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Etut => "etut",
            Self::Uygulama => "uygulama",
            Self::Denetim => "denetim",
            Self::Belediye => "belediye",
            Self::Mimari => "mimari",
            Self::Tumproje => "tumproje",
            Self::Ruhsat => "ruhsat",
            Self::Iskan => "iskan",
        }
    }
    pub fn parse(value: &str) -> Option<Self> {
        Some(match value {
            "etut" => Self::Etut,
            "uygulama" => Self::Uygulama,
            "denetim" => Self::Denetim,
            "belediye" => Self::Belediye,
            "mimari" => Self::Mimari,
            "tumproje" => Self::Tumproje,
            "ruhsat" => Self::Ruhsat,
            "iskan" => Self::Iskan,
            _ => return None,
        })
    }
    pub fn is_done(self) -> bool {
        self == Self::Iskan
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Owner {
    #[serde(default)]
    pub id: Id,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub tc: String,
    #[serde(default)]
    pub phone: String,
    #[serde(default)]
    pub address: String,
    #[serde(default)]
    pub share: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Proxy {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub tc: String,
    #[serde(default)]
    pub phone: String,
    #[serde(default)]
    pub address: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: Id,
    pub name: String,
    pub contractor_id: Id,
    /// Görüntüleme için müteahhidin güncel unvanı (kayıttan okunur, saklanmaz).
    pub contractor: String,
    pub ada: String,
    pub parsel: String,
    pub pafta: String,
    pub mahalle: String,
    pub street: String,
    pub status: ProjectStatus,
    pub done: bool,
    pub note: String,
    /// Fotoğrafın yüklendiği an; 0 ise fotoğraf yok. İstemci adresi buna göre tazeler.
    pub photo_at: Timestamp,
    #[serde(skip)]
    pub photo_mime: String,
    pub author_ids: Vec<Id>,
    pub owners: Vec<Owner>,
    pub proxy: Proxy,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectInput {
    pub name: String,
    pub contractor_id: Id,
    pub ada: String,
    pub parsel: String,
    #[serde(default)]
    pub pafta: String,
    pub mahalle: String,
    pub street: String,
    pub status: ProjectStatus,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub owners: Vec<Owner>,
    #[serde(default)]
    pub proxy: Proxy,
}

impl Project {
    pub fn input(&self) -> ProjectInput {
        ProjectInput {
            name: self.name.clone(),
            contractor_id: self.contractor_id.clone(),
            ada: self.ada.clone(),
            parsel: self.parsel.clone(),
            pafta: self.pafta.clone(),
            mahalle: self.mahalle.clone(),
            street: self.street.clone(),
            status: self.status,
            note: self.note.clone(),
            owners: self.owners.clone(),
            proxy: self.proxy.clone(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Author {
    pub id: Id,
    pub tc: String,
    pub first: String,
    pub last: String,
    pub phone: String,
    pub company: String,
    pub job: String,
    pub sicil: String,
    pub address: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AuthorInput {
    #[serde(default)]
    pub tc: String,
    pub first: String,
    #[serde(default)]
    pub last: String,
    #[serde(default)]
    pub phone: String,
    #[serde(default)]
    pub company: String,
    pub job: String,
    #[serde(default)]
    pub sicil: String,
    #[serde(default)]
    pub address: String,
}

impl Author {
    pub fn input(&self) -> AuthorInput {
        AuthorInput {
            tc: self.tc.clone(),
            first: self.first.clone(),
            last: self.last.clone(),
            phone: self.phone.clone(),
            company: self.company.clone(),
            job: self.job.clone(),
            sicil: self.sicil.clone(),
            address: self.address.clone(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Contractor {
    pub id: Id,
    pub title: String,
    pub owner: String,
    pub licence: String,
    pub rank: String,
    pub address: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ContractorInput {
    pub title: String,
    #[serde(default)]
    pub owner: String,
    #[serde(default)]
    pub licence: String,
    #[serde(default)]
    pub rank: String,
    #[serde(default)]
    pub address: String,
}

impl Contractor {
    pub fn input(&self) -> ContractorInput {
        ContractorInput {
            title: self.title.clone(),
            owner: self.owner.clone(),
            licence: self.licence.clone(),
            rank: self.rank.clone(),
            address: self.address.clone(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: Id,
    pub title: String,
    pub assignee: Id,
    pub by: Id,
    pub due: String,
    pub done: bool,
    pub project_id: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TaskInput {
    pub title: String,
    pub assignee: Id,
    #[serde(default)]
    pub due: String,
    #[serde(default)]
    pub project_id: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: Id,
    pub user_id: Id,
    pub text: String,
    pub done: bool,
}

/// Kullanıcının bir projeye düştüğü kişisel not. Yalnızca sahibi okur ve yazar.
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectNote {
    pub body: String,
    pub updated_at: Timestamp,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DocAccept {
    All,
    Pdf,
    Pdfimg,
    Image,
    Cad,
    Office,
}

impl DocAccept {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::All => "all",
            Self::Pdf => "pdf",
            Self::Pdfimg => "pdfimg",
            Self::Image => "image",
            Self::Cad => "cad",
            Self::Office => "office",
        }
    }
    pub fn parse(value: &str) -> Option<Self> {
        Some(match value {
            "all" => Self::All,
            "pdf" => Self::Pdf,
            "pdfimg" => Self::Pdfimg,
            "image" => Self::Image,
            "cad" => Self::Cad,
            "office" => Self::Office,
            _ => return None,
        })
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocType {
    pub id: Id,
    pub name: String,
    pub required: bool,
    pub accept: DocAccept,
    pub multi: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DocTypeInput {
    pub name: String,
    #[serde(default)]
    pub required: bool,
    #[serde(default = "DocTypeInput::default_accept")]
    pub accept: DocAccept,
    #[serde(default)]
    pub multi: bool,
}

impl DocTypeInput {
    fn default_accept() -> DocAccept {
        DocAccept::All
    }
}

/// Meslek. `required` kapalıysa proje için müellif ataması zorunlu değildir.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profession {
    pub name: String,
    pub required: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileState {
    Active,
    Pending,
}

impl FileState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Pending => "pending",
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredFile {
    pub id: Id,
    pub project_id: Id,
    pub doc_type_id: Option<Id>,
    pub name: String,
    pub size: i64,
    pub mime: String,
    pub sha256: String,
    pub by: String,
    pub by_id: Id,
    pub at: Timestamp,
    pub state: FileState,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PendingKind {
    Create,
    Update,
    Delete,
    UserApprove,
    UserDelete,
}

impl PendingKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Create => "create",
            Self::Update => "update",
            Self::Delete => "delete",
            Self::UserApprove => "user-approve",
            Self::UserDelete => "user-delete",
        }
    }
    pub fn parse(value: &str) -> Option<Self> {
        Some(match value {
            "create" => Self::Create,
            "update" => Self::Update,
            "delete" => Self::Delete,
            "user-approve" => Self::UserApprove,
            "user-delete" => Self::UserDelete,
            _ => return None,
        })
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Entity {
    Project,
    Author,
    Contractor,
    User,
}

impl Entity {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Project => "project",
            Self::Author => "author",
            Self::Contractor => "contractor",
            Self::User => "user",
        }
    }
    pub fn parse(value: &str) -> Option<Self> {
        Some(match value {
            "project" => Self::Project,
            "author" => Self::Author,
            "contractor" => Self::Contractor,
            "user" => Self::User,
            _ => return None,
        })
    }
}

/// Onay bekleyen düzenlemede yalnızca değişen alanlar uygulanır. `base`, bu alanların
/// talep açıldığı andaki özetidir: onay anında kayıt farklıysa talep çakışma verir.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldPatch {
    pub fields: Vec<String>,
    pub base: String,
}

/// Onay bekleyen değişikliğin içeriği. Onaylandığında yeniden doğrulanarak uygulanır.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum PendingPayload {
    ProjectCreate {
        id: Id,
        input: ProjectInput,
    },
    ProjectUpdate {
        id: Id,
        input: ProjectInput,
        patch: FieldPatch,
    },
    ProjectDelete {
        id: Id,
    },
    AuthorCreate {
        id: Id,
        input: AuthorInput,
    },
    AuthorUpdate {
        id: Id,
        input: AuthorInput,
        patch: FieldPatch,
    },
    AuthorDelete {
        id: Id,
    },
    ContractorCreate {
        id: Id,
        input: ContractorInput,
    },
    ContractorUpdate {
        id: Id,
        input: ContractorInput,
        patch: FieldPatch,
    },
    ContractorDelete {
        id: Id,
    },
    FileAdd {
        id: Id,
        file_id: Id,
        replace: bool,
    },
    FileRemove {
        id: Id,
        file_id: Id,
    },
    ProjectAuthor {
        id: Id,
        job: String,
        author_id: String,
    },
    UserApprove {
        id: Id,
    },
    UserDelete {
        id: Id,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pending {
    pub id: Id,
    pub kind: PendingKind,
    pub entity: Entity,
    pub payload: PendingPayload,
    pub title: String,
    pub detail: String,
    pub by: String,
    pub by_id: Id,
    pub when: Timestamp,
    pub min_level: i64,
    pub target_level: Option<i64>,
    pub doc_key: Option<Id>,
    pub file_name: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: Id,
    pub text: String,
    pub when: Timestamp,
    pub ok: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Margins {
    pub t: f64,
    pub r: f64,
    pub b: f64,
    pub l: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Template {
    #[serde(default)]
    pub id: Id,
    pub name: String,
    pub contexts: Vec<String>,
    pub size: String,
    pub orient: String,
    pub margins: Margins,
    pub font: String,
    pub font_size: f64,
    pub page_no: bool,
    pub page_no_pos: String,
    #[serde(default)]
    pub header: String,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub footer: String,
    #[serde(default)]
    pub updated: Timestamp,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Company {
    pub name: String,
    pub desc: String,
    pub has_logo: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Palette {
    pub pri: String,
    pub acc: String,
}

impl Default for Palette {
    fn default() -> Self {
        Self {
            pri: "#1E4FD8".into(),
            acc: "#163CA8".into(),
        }
    }
}

/// `docs` alanının istemcideki biçimi: belge türü kimliği → dosya listesi.
pub type ProjectDocs = BTreeMap<Id, Vec<StoredFile>>;

/// Denetim kaydı. Hassas içerik yazılmaz; yalnızca kimlik ve eylem.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEvent {
    pub actor_kind: String,
    pub actor_id: String,
    pub action: String,
    pub target: String,
    pub ip: String,
    pub detail: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditRecord {
    pub seq: i64,
    pub at: Timestamp,
    pub actor_kind: String,
    pub actor_id: String,
    pub action: String,
    pub target: String,
    pub ip: String,
    pub detail: String,
    pub hash: String,
}
