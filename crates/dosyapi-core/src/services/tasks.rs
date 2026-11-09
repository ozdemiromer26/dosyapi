use crate::error::{AppError, AppResult};
use crate::model::*;
use crate::policy;
use crate::ports::*;
use crate::services::audit::Auditor;
use crate::validate;
use std::sync::Arc;

#[derive(Clone)]
pub struct TaskService {
    pub tasks: Arc<dyn TaskRepo>,
    pub todos: Arc<dyn TodoRepo>,
    pub users: Arc<dyn UserRepo>,
    pub roles: Arc<dyn RoleRepo>,
    pub projects: Arc<dyn ProjectRepo>,
    pub notes: Arc<dyn NoteRepo>,
    pub clock: Arc<dyn Clock>,
    pub audit: Auditor,
}

/// Kişisel proje notunun üst sınırı (karakter).
pub const MAX_NOTE_CHARS: usize = 20_000;

impl TaskService {
    /// Atama ve düzenlemede aynı kurallar: yetki, kademe, etkin hesap, var olan proje.
    /// Dönüş: (tanım, tarih, atanan kişi).
    async fn checked(&self, actor: &Actor, input: &TaskInput) -> AppResult<(String, String, Id)> {
        if !actor.can_tasks() {
            return Err(AppError::Forbidden);
        }
        let title = validate::required(&input.title, "Görev tanımı", 300)?;
        let due = validate::iso_date(&input.due)?;
        let target = self
            .users
            .get(&input.assignee)
            .await?
            .ok_or(AppError::NotFound)?;
        let role = match &target.role_id {
            Some(id) => self.roles.get(id).await?,
            None => None,
        };
        if target.status != UserStatus::Active || !policy::can_assign_task_to(actor, role.as_ref())
        {
            return Err(AppError::Forbidden);
        }
        if !input.project_id.is_empty() {
            if !actor.project_mode().can_read() {
                return Err(AppError::Forbidden);
            }
            self.projects
                .get(&input.project_id)
                .await?
                .ok_or(AppError::NotFound)?;
        }
        Ok((title, due, target.id))
    }

    pub async fn assign(&self, actor: &Actor, input: TaskInput) -> AppResult<Task> {
        let (title, due, assignee) = self.checked(actor, &input).await?;
        let task = Task {
            id: new_id(),
            title,
            assignee,
            by: actor.user_id.clone(),
            due,
            done: false,
            project_id: input.project_id,
        };
        self.tasks.insert(&task).await?;
        self.audit.user(actor, "task.assign", &task.id, "").await?;
        Ok(task)
    }

    /// Görevi yalnızca atayan düzenler; atanan kişi yalnızca tamamlandı işaretler.
    pub async fn update(&self, actor: &Actor, id: &str, input: TaskInput) -> AppResult<Task> {
        let current = self.tasks.get(id).await?.ok_or(AppError::NotFound)?;
        if current.by != actor.user_id {
            return Err(AppError::NotFound);
        }
        let (title, due, assignee) = self.checked(actor, &input).await?;
        let task = Task {
            title,
            assignee,
            due,
            project_id: input.project_id,
            ..current
        };
        self.tasks.update(&task).await?;
        self.audit.user(actor, "task.update", &task.id, "").await?;
        Ok(task)
    }

    /// Görevi yalnızca atanan ya da atayan kişi değiştirebilir (nesne düzeyinde yetki).
    pub async fn toggle(&self, actor: &Actor, id: &str) -> AppResult<()> {
        let task = self.tasks.get(id).await?.ok_or(AppError::NotFound)?;
        if task.assignee != actor.user_id && task.by != actor.user_id {
            return Err(AppError::NotFound);
        }
        self.tasks.set_done(id, !task.done).await
    }

    pub async fn delete(&self, actor: &Actor, id: &str) -> AppResult<()> {
        let task = self.tasks.get(id).await?.ok_or(AppError::NotFound)?;
        if task.by != actor.user_id && task.assignee != actor.user_id {
            return Err(AppError::NotFound);
        }
        if task.by != actor.user_id {
            return Err(AppError::Forbidden);
        }
        self.tasks.delete(id).await
    }

    pub async fn add_todo(&self, actor: &Actor, text: &str) -> AppResult<Todo> {
        let todo = Todo {
            id: new_id(),
            user_id: actor.user_id.clone(),
            text: validate::required(text, "Not", 500)?,
            done: false,
        };
        self.todos.insert(&todo).await?;
        Ok(todo)
    }

    async fn own_todo(&self, actor: &Actor, id: &str) -> AppResult<Todo> {
        let todo = self.todos.get(id).await?.ok_or(AppError::NotFound)?;
        if todo.user_id != actor.user_id {
            return Err(AppError::NotFound);
        }
        Ok(todo)
    }

    pub async fn toggle_todo(&self, actor: &Actor, id: &str) -> AppResult<()> {
        let todo = self.own_todo(actor, id).await?;
        self.todos.set_done(id, !todo.done).await
    }

    pub async fn delete_todo(&self, actor: &Actor, id: &str) -> AppResult<()> {
        self.own_todo(actor, id).await?;
        self.todos.delete(id).await
    }

    /// Not yalnızca projeyi görebilen kullanıcıya ve yalnızca kendi satırı için açılır.
    async fn note_project(&self, actor: &Actor, project_id: &str) -> AppResult<()> {
        if !actor.project_mode().can_read() {
            return Err(AppError::Forbidden);
        }
        self.projects
            .get(project_id)
            .await?
            .map(|_| ())
            .ok_or(AppError::NotFound)
    }

    pub async fn note(&self, actor: &Actor, project_id: &str) -> AppResult<ProjectNote> {
        self.note_project(actor, project_id).await?;
        Ok(self
            .notes
            .get(&actor.user_id, project_id)
            .await?
            .unwrap_or_default())
    }

    /// Boş not satırı siler; böylece veritabanında boş şifreli kayıt birikmez.
    pub async fn save_note(
        &self,
        actor: &Actor,
        project_id: &str,
        body: &str,
    ) -> AppResult<ProjectNote> {
        self.note_project(actor, project_id).await?;
        let body = validate::multiline(body, "Not", MAX_NOTE_CHARS)?;
        if body.is_empty() {
            self.notes.delete(&actor.user_id, project_id).await?;
            return Ok(ProjectNote::default());
        }
        let note = ProjectNote {
            body,
            updated_at: self.clock.now(),
        };
        self.notes.put(&actor.user_id, project_id, &note).await?;
        Ok(note)
    }
}
