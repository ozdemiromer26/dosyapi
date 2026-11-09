//! Oturum açan kullanıcının görmeye yetkili olduğu verinin tamamı.
//! Yetkisiz alan hiç gönderilmez; salt okuma rolleri kişisel veriyi maskeli görür.

use crate::error::AppResult;
use crate::model::*;
use crate::policy;
use crate::ports::*;
use crate::services::settings::Settings;
use serde::Serialize;
use std::collections::BTreeMap;
use std::sync::Arc;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserView {
    pub id: Id,
    pub name: String,
    pub email: String,
    pub role_id: Option<Id>,
    pub status: UserStatus,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileView {
    pub id: Id,
    pub name: String,
    pub size: i64,
    pub at: Timestamp,
    pub by: String,
    pub url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectView {
    #[serde(flatten)]
    pub project: Project,
    pub docs: BTreeMap<Id, Vec<FileView>>,
    pub files: Vec<FileView>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingTarget {
    pub id: Id,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingView {
    pub id: Id,
    pub kind: PendingKind,
    pub entity: Entity,
    pub payload: PendingTarget,
    pub title: String,
    pub detail: String,
    pub by: String,
    pub by_id: Id,
    pub when: Timestamp,
    pub min_level: i64,
    pub target_level: Option<i64>,
    pub doc_key: Option<Id>,
    pub file_name: Option<String>,
    pub can_decide: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeView {
    pub id: Id,
    pub name: String,
    pub email: String,
    pub role_id: Id,
    pub must_change_password: bool,
    pub totp_enabled: bool,
    /// Kalan kurtarma kodu sayısı (kodların kendisi asla geri gönderilmez).
    pub totp_recovery_left: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bootstrap {
    pub me: MeView,
    pub csrf: String,
    pub company: Company,
    pub palette: Palette,
    pub domains: Vec<String>,
    pub domain_lock: bool,
    pub roles: Vec<Role>,
    pub users: Vec<UserView>,
    pub doc_types: Vec<DocType>,
    pub professions: Vec<Profession>,
    pub projects: Vec<ProjectView>,
    pub authors: Vec<Author>,
    pub contractors: Vec<Contractor>,
    pub tasks: Vec<Task>,
    pub todos: Vec<Todo>,
    pub pendings: Vec<PendingView>,
    pub history: Vec<HistoryEntry>,
    pub templates: Vec<Template>,
    pub version: String,
}

/// Son iki haneyi bırakır: `45678901234` → `•••••••••34`.
pub fn mask(value: &str) -> String {
    let count = value.chars().count();
    if count == 0 {
        return String::new();
    }
    let visible = 2.min(count);
    let tail: String = value.chars().skip(count - visible).collect();
    format!("{}{}", "•".repeat(count - visible), tail)
}

fn mask_project(project: &mut Project) {
    for owner in &mut project.owners {
        owner.tc = mask(&owner.tc);
        owner.phone = mask(&owner.phone);
        owner.address = String::new();
    }
    project.proxy.tc = mask(&project.proxy.tc);
    project.proxy.phone = mask(&project.proxy.phone);
    project.proxy.address = String::new();
}

fn mask_author(author: &mut Author) {
    author.tc = mask(&author.tc);
    author.phone = mask(&author.phone);
    author.address = String::new();
}

pub fn file_view(file: &StoredFile) -> FileView {
    FileView {
        id: file.id.clone(),
        name: file.name.clone(),
        size: file.size,
        at: file.at,
        by: file.by.clone(),
        url: format!("/api/v1/files/{}", file.id),
    }
}

#[derive(Clone)]
pub struct BootstrapService {
    pub settings: Settings,
    pub roles: Arc<dyn RoleRepo>,
    pub users: Arc<dyn UserRepo>,
    pub doc_types: Arc<dyn DocTypeRepo>,
    pub professions: Arc<dyn ProfessionRepo>,
    pub projects: Arc<dyn ProjectRepo>,
    pub authors: Arc<dyn AuthorRepo>,
    pub contractors: Arc<dyn ContractorRepo>,
    pub tasks: Arc<dyn TaskRepo>,
    pub todos: Arc<dyn TodoRepo>,
    pub pendings: Arc<dyn PendingRepo>,
    pub history: Arc<dyn HistoryRepo>,
    pub templates: Arc<dyn TemplateRepo>,
    pub files: Arc<dyn FileRepo>,
    pub version: String,
}

fn target_id(payload: &PendingPayload) -> Id {
    use PendingPayload::*;
    match payload {
        ProjectCreate { id, .. }
        | ProjectUpdate { id, .. }
        | ProjectDelete { id }
        | AuthorCreate { id, .. }
        | AuthorUpdate { id, .. }
        | AuthorDelete { id }
        | ContractorCreate { id, .. }
        | ContractorUpdate { id, .. }
        | ContractorDelete { id }
        | FileAdd { id, .. }
        | FileRemove { id, .. }
        | ProjectAuthor { id, .. }
        | UserApprove { id }
        | UserDelete { id } => id.clone(),
    }
}

impl BootstrapService {
    async fn project_views(
        &self,
        actor: &Actor,
        doc_types: &[DocType],
    ) -> AppResult<Vec<ProjectView>> {
        if !actor.project_mode().can_read() {
            return Ok(vec![]);
        }
        let files = self.files.list().await?;
        let show_pii = actor.sees_project_pii();
        let mut views = Vec::new();
        for mut project in self.projects.list().await? {
            if !show_pii {
                mask_project(&mut project);
            }
            let mut docs: BTreeMap<Id, Vec<FileView>> = BTreeMap::new();
            let mut extras = Vec::new();
            for file in files
                .iter()
                .filter(|f| f.project_id == project.id && f.state == FileState::Active)
            {
                match &file.doc_type_id {
                    Some(slot) if doc_types.iter().any(|d| &d.id == slot) => {
                        docs.entry(slot.clone()).or_default().push(file_view(file));
                    }
                    _ => extras.push(file_view(file)),
                }
            }
            views.push(ProjectView {
                project,
                docs,
                files: extras,
            });
        }
        Ok(views)
    }

    pub async fn for_actor(&self, actor: &Actor, csrf: String) -> AppResult<Bootstrap> {
        let doc_types = self.doc_types.list().await?;
        let users = self.users.list().await?;
        let show_emails = actor.can_users() || actor.can_approve();
        let roles = self.roles.list().await?;

        let mut authors = if actor.record_mode().can_read() || actor.project_mode().can_read() {
            self.authors.list().await?
        } else {
            vec![]
        };
        if !actor.sees_record_pii() {
            authors.iter_mut().for_each(mask_author);
        }
        let contractors = if actor.record_mode().can_read() || actor.project_mode().can_read() {
            self.contractors.list().await?
        } else {
            vec![]
        };
        let pendings = self
            .pendings
            .list()
            .await?
            .into_iter()
            .filter(|p| policy::can_view_pending(actor, p))
            .map(|p| PendingView {
                can_decide: policy::can_decide_pending(actor, &p),
                payload: PendingTarget {
                    id: target_id(&p.payload),
                },
                id: p.id,
                kind: p.kind,
                entity: p.entity,
                title: p.title,
                detail: p.detail,
                by: p.by,
                by_id: p.by_id,
                when: p.when,
                min_level: p.min_level,
                target_level: p.target_level,
                doc_key: p.doc_key,
                file_name: p.file_name,
            })
            .collect();
        let tasks = self
            .tasks
            .list()
            .await?
            .into_iter()
            .filter(|t| t.assignee == actor.user_id || t.by == actor.user_id)
            .collect();

        Ok(Bootstrap {
            me: MeView {
                id: actor.user_id.clone(),
                name: actor.name.clone(),
                email: actor.email.clone(),
                role_id: actor.role.id.clone(),
                must_change_password: actor.must_change_password,
                totp_enabled: actor.totp_enabled,
                totp_recovery_left: if actor.totp_enabled {
                    self.users.count_recovery(&actor.user_id).await?
                } else {
                    0
                },
            },
            csrf,
            company: self.settings.company().await?,
            palette: self.settings.palette().await?,
            domains: self.settings.domains().await?,
            domain_lock: self.settings.domain_lock().await?,
            users: users
                .into_iter()
                .map(|u| UserView {
                    email: if show_emails || u.id == actor.user_id {
                        u.email
                    } else {
                        String::new()
                    },
                    id: u.id,
                    name: u.name,
                    role_id: u.role_id,
                    status: u.status,
                })
                .collect(),
            roles,
            professions: self.professions.list().await?,
            projects: self.project_views(actor, &doc_types).await?,
            doc_types,
            authors,
            contractors,
            tasks,
            todos: self.todos.list_for(&actor.user_id).await?,
            pendings,
            history: if actor.project_mode().can_read() {
                self.history.list(50).await?
            } else {
                vec![]
            },
            templates: self.templates.list().await?,
            version: self.version.clone(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::mask;

    #[test]
    fn mask_keeps_only_tail() {
        assert_eq!(mask("45678901234"), "•••••••••34");
        assert_eq!(mask("1"), "1");
        assert_eq!(mask(""), "");
    }
}
