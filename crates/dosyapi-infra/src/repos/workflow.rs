use super::Db;
use crate::db::db_err;
use async_trait::async_trait;
use dosyapi_core::error::{AppError, AppResult};
use dosyapi_core::model::*;
use dosyapi_core::ports::*;
use sqlx::Row;
use sqlx::sqlite::SqliteRow;

fn task_from(r: &SqliteRow) -> AppResult<Task> {
    Ok(Task {
        id: r.try_get("id").map_err(db_err)?,
        title: r.try_get("title").map_err(db_err)?,
        assignee: r.try_get("assignee").map_err(db_err)?,
        by: r.try_get("by_id").map_err(db_err)?,
        due: r.try_get("due").map_err(db_err)?,
        done: r.try_get("done").map_err(db_err)?,
        project_id: r
            .try_get::<Option<String>, _>("project_id")
            .map_err(db_err)?
            .unwrap_or_default(),
    })
}

#[async_trait]
impl TaskRepo for Db {
    async fn list(&self) -> AppResult<Vec<Task>> {
        let rows = sqlx::query("SELECT * FROM tasks ORDER BY created_at DESC")
            .fetch_all(&self.pool)
            .await
            .map_err(db_err)?;
        rows.iter().map(task_from).collect()
    }

    async fn get(&self, id: &str) -> AppResult<Option<Task>> {
        let row = sqlx::query("SELECT * FROM tasks WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_err)?;
        row.as_ref().map(task_from).transpose()
    }

    async fn insert(&self, t: &Task) -> AppResult<()> {
        sqlx::query("INSERT INTO tasks (id, title, assignee, by_id, due, done, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind(&t.id)
            .bind(&t.title)
            .bind(&t.assignee)
            .bind(&t.by)
            .bind(&t.due)
            .bind(t.done)
            .bind((!t.project_id.is_empty()).then_some(&t.project_id))
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn update(&self, t: &Task) -> AppResult<()> {
        sqlx::query(
            "UPDATE tasks SET title = ?, assignee = ?, due = ?, project_id = ? WHERE id = ?",
        )
        .bind(&t.title)
        .bind(&t.assignee)
        .bind(&t.due)
        .bind((!t.project_id.is_empty()).then_some(&t.project_id))
        .bind(&t.id)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn set_done(&self, id: &str, done: bool) -> AppResult<()> {
        sqlx::query("UPDATE tasks SET done = ? WHERE id = ?")
            .bind(done)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM tasks WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }
}

fn todo_from(r: &SqliteRow) -> AppResult<Todo> {
    Ok(Todo {
        id: r.try_get("id").map_err(db_err)?,
        user_id: r.try_get("user_id").map_err(db_err)?,
        text: r.try_get("text").map_err(db_err)?,
        done: r.try_get("done").map_err(db_err)?,
    })
}

#[async_trait]
impl TodoRepo for Db {
    async fn list_for(&self, user_id: &str) -> AppResult<Vec<Todo>> {
        let rows = sqlx::query("SELECT * FROM todos WHERE user_id = ? ORDER BY created_at, id")
            .bind(user_id)
            .fetch_all(&self.pool)
            .await
            .map_err(db_err)?;
        rows.iter().map(todo_from).collect()
    }

    async fn get(&self, id: &str) -> AppResult<Option<Todo>> {
        let row = sqlx::query("SELECT * FROM todos WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_err)?;
        row.as_ref().map(todo_from).transpose()
    }

    async fn insert(&self, t: &Todo) -> AppResult<()> {
        sqlx::query("INSERT INTO todos (id, user_id, text, done) VALUES (?, ?, ?, ?)")
            .bind(&t.id)
            .bind(&t.user_id)
            .bind(&t.text)
            .bind(t.done)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn set_done(&self, id: &str, done: bool) -> AppResult<()> {
        sqlx::query("UPDATE todos SET done = ? WHERE id = ?")
            .bind(done)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM todos WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }
}

/// Şifreleme bağlamı hem kullanıcıyı hem projeyi içerir: bir satırın gövdesi başka
/// bir (kullanıcı, proje) satırına kopyalanırsa çözülemez.
fn note_ctx(user_id: &str, project_id: &str) -> String {
    format!("project_notes.body:{user_id}:{project_id}")
}

#[async_trait]
impl NoteRepo for Db {
    async fn get(&self, user_id: &str, project_id: &str) -> AppResult<Option<ProjectNote>> {
        let row = sqlx::query(
            "SELECT body_enc, updated_at FROM project_notes WHERE user_id = ? AND project_id = ?",
        )
        .bind(user_id)
        .bind(project_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(db_err)?;
        let Some(r) = row else { return Ok(None) };
        let blob: Vec<u8> = r.try_get("body_enc").map_err(db_err)?;
        Ok(Some(ProjectNote {
            body: self
                .cipher
                .decrypt_text(&note_ctx(user_id, project_id), Some(&blob))?,
            updated_at: r.try_get("updated_at").map_err(db_err)?,
        }))
    }

    async fn put(&self, user_id: &str, project_id: &str, note: &ProjectNote) -> AppResult<()> {
        let blob = self
            .cipher
            .encrypt_text(&note_ctx(user_id, project_id), &note.body)?;
        sqlx::query(
            "INSERT INTO project_notes (user_id, project_id, body_enc, updated_at) VALUES (?, ?, ?, ?)
             ON CONFLICT (user_id, project_id) DO UPDATE SET body_enc = excluded.body_enc, updated_at = excluded.updated_at",
        )
        .bind(user_id)
        .bind(project_id)
        .bind(blob)
        .bind(note.updated_at)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn delete(&self, user_id: &str, project_id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM project_notes WHERE user_id = ? AND project_id = ?")
            .bind(user_id)
            .bind(project_id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }
}

fn doc_type_from(r: &SqliteRow) -> AppResult<DocType> {
    let accept: String = r.try_get("accept").map_err(db_err)?;
    Ok(DocType {
        id: r.try_get("id").map_err(db_err)?,
        name: r.try_get("name").map_err(db_err)?,
        required: r.try_get("required").map_err(db_err)?,
        accept: DocAccept::parse(&accept).unwrap_or(DocAccept::All),
        multi: r.try_get("multi").map_err(db_err)?,
    })
}

#[async_trait]
impl DocTypeRepo for Db {
    async fn list(&self) -> AppResult<Vec<DocType>> {
        let rows = sqlx::query("SELECT * FROM doc_types ORDER BY position, rowid")
            .fetch_all(&self.pool)
            .await
            .map_err(db_err)?;
        rows.iter().map(doc_type_from).collect()
    }

    async fn get(&self, id: &str) -> AppResult<Option<DocType>> {
        let row = sqlx::query("SELECT * FROM doc_types WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_err)?;
        row.as_ref().map(doc_type_from).transpose()
    }

    async fn insert(&self, d: &DocType) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO doc_types (id, name, required, accept, multi) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&d.id)
        .bind(&d.name)
        .bind(d.required)
        .bind(d.accept.as_str())
        .bind(d.multi)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn update(&self, d: &DocType) -> AppResult<()> {
        sqlx::query(
            "UPDATE doc_types SET name = ?, required = ?, accept = ?, multi = ? WHERE id = ?",
        )
        .bind(&d.name)
        .bind(d.required)
        .bind(d.accept.as_str())
        .bind(d.multi)
        .bind(&d.id)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM doc_types WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }
}

#[async_trait]
impl ProfessionRepo for Db {
    async fn list(&self) -> AppResult<Vec<Profession>> {
        let rows = sqlx::query("SELECT name, required FROM professions ORDER BY position, rowid")
            .fetch_all(&self.pool)
            .await
            .map_err(db_err)?;
        rows.iter()
            .map(|r| {
                Ok(Profession {
                    name: r.try_get("name").map_err(db_err)?,
                    required: r.try_get("required").map_err(db_err)?,
                })
            })
            .collect()
    }

    async fn upsert(&self, p: &Profession) -> AppResult<()> {
        sqlx::query("INSERT INTO professions (name, required) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET required = excluded.required")
            .bind(&p.name)
            .bind(p.required)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn delete(&self, name: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM professions WHERE name = ?")
            .bind(name)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }
}

fn file_from(r: &SqliteRow) -> AppResult<StoredFile> {
    let state: String = r.try_get("state").map_err(db_err)?;
    Ok(StoredFile {
        id: r.try_get("id").map_err(db_err)?,
        project_id: r.try_get("project_id").map_err(db_err)?,
        doc_type_id: r.try_get("doc_type_id").map_err(db_err)?,
        name: r.try_get("name").map_err(db_err)?,
        size: r.try_get("size").map_err(db_err)?,
        mime: r.try_get("mime").map_err(db_err)?,
        sha256: r.try_get("sha256").map_err(db_err)?,
        by: r.try_get("by_name").map_err(db_err)?,
        by_id: r.try_get("by_id").map_err(db_err)?,
        at: r.try_get("at").map_err(db_err)?,
        state: if state == "active" {
            FileState::Active
        } else {
            FileState::Pending
        },
    })
}

#[async_trait]
impl FileRepo for Db {
    async fn list(&self) -> AppResult<Vec<StoredFile>> {
        let rows = sqlx::query("SELECT * FROM files ORDER BY at")
            .fetch_all(&self.pool)
            .await
            .map_err(db_err)?;
        rows.iter().map(file_from).collect()
    }

    async fn get(&self, id: &str) -> AppResult<Option<StoredFile>> {
        let row = sqlx::query("SELECT * FROM files WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_err)?;
        row.as_ref().map(file_from).transpose()
    }

    async fn insert(&self, f: &StoredFile) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO files (id, project_id, doc_type_id, name, size, mime, sha256, by_name, by_id, at, state)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&f.id)
        .bind(&f.project_id)
        .bind(&f.doc_type_id)
        .bind(&f.name)
        .bind(f.size)
        .bind(&f.mime)
        .bind(&f.sha256)
        .bind(&f.by)
        .bind(&f.by_id)
        .bind(f.at)
        .bind(f.state.as_str())
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn set_state(&self, id: &str, state: FileState) -> AppResult<()> {
        sqlx::query("UPDATE files SET state = ? WHERE id = ?")
            .bind(state.as_str())
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM files WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn in_doc_slot(&self, project_id: &str, doc_type_id: &str) -> AppResult<Vec<StoredFile>> {
        let rows = sqlx::query("SELECT * FROM files WHERE project_id = ? AND doc_type_id = ?")
            .bind(project_id)
            .bind(doc_type_id)
            .fetch_all(&self.pool)
            .await
            .map_err(db_err)?;
        rows.iter().map(file_from).collect()
    }

    async fn in_project(&self, project_id: &str) -> AppResult<Vec<StoredFile>> {
        let rows = sqlx::query("SELECT * FROM files WHERE project_id = ?")
            .bind(project_id)
            .fetch_all(&self.pool)
            .await
            .map_err(db_err)?;
        rows.iter().map(file_from).collect()
    }
}

impl Db {
    fn pending_from(&self, r: &SqliteRow) -> AppResult<Pending> {
        let id: String = r.try_get("id").map_err(db_err)?;
        let blob: Vec<u8> = r.try_get("payload_enc").map_err(db_err)?;
        let plain = self
            .cipher
            .decrypt(&format!("pendings.payload:{id}"), &blob)?;
        let kind: String = r.try_get("kind").map_err(db_err)?;
        let entity: String = r.try_get("entity").map_err(db_err)?;
        Ok(Pending {
            kind: PendingKind::parse(&kind)
                .ok_or_else(|| AppError::internal("geçersiz talep türü"))?,
            entity: Entity::parse(&entity).ok_or_else(|| AppError::internal("geçersiz varlık"))?,
            payload: serde_json::from_slice(&plain).map_err(AppError::internal)?,
            title: r.try_get("title").map_err(db_err)?,
            detail: r.try_get("detail").map_err(db_err)?,
            by: r.try_get("by_name").map_err(db_err)?,
            by_id: r.try_get("by_id").map_err(db_err)?,
            when: r.try_get("at").map_err(db_err)?,
            min_level: r.try_get("min_level").map_err(db_err)?,
            target_level: r.try_get("target_level").map_err(db_err)?,
            doc_key: r.try_get("doc_key").map_err(db_err)?,
            file_name: r.try_get("file_name").map_err(db_err)?,
            id,
        })
    }
}

#[async_trait]
impl PendingRepo for Db {
    async fn list(&self) -> AppResult<Vec<Pending>> {
        let rows = sqlx::query("SELECT * FROM pendings ORDER BY at DESC")
            .fetch_all(&self.pool)
            .await
            .map_err(db_err)?;
        rows.iter().map(|r| self.pending_from(r)).collect()
    }

    async fn get(&self, id: &str) -> AppResult<Option<Pending>> {
        let row = sqlx::query("SELECT * FROM pendings WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_err)?;
        row.as_ref().map(|r| self.pending_from(r)).transpose()
    }

    async fn insert(&self, p: &Pending) -> AppResult<()> {
        let payload = serde_json::to_vec(&p.payload).map_err(AppError::internal)?;
        sqlx::query(
            "INSERT INTO pendings (id, kind, entity, payload_enc, title, detail, by_name, by_id, at, min_level, target_level, doc_key, file_name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&p.id)
        .bind(p.kind.as_str())
        .bind(p.entity.as_str())
        .bind(self.cipher.encrypt(&format!("pendings.payload:{}", p.id), &payload)?)
        .bind(&p.title)
        .bind(&p.detail)
        .bind(&p.by)
        .bind(&p.by_id)
        .bind(p.when)
        .bind(p.min_level)
        .bind(p.target_level)
        .bind(&p.doc_key)
        .bind(&p.file_name)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM pendings WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }
}

#[async_trait]
impl OutcomeRepo for Db {
    async fn insert(&self, o: &RequestOutcome) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO request_outcomes (id, by_id, kind, entity, title, detail, sent_at, decided_at, decider, approved)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&o.id)
        .bind(&o.by_id)
        .bind(o.kind.as_str())
        .bind(o.entity.as_str())
        .bind(&o.title)
        .bind(&o.detail)
        .bind(o.sent_at)
        .bind(o.decided_at)
        .bind(&o.decider)
        .bind(o.approved)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn list_for(&self, user_id: &str, limit: i64) -> AppResult<Vec<RequestOutcome>> {
        let rows = sqlx::query(
            "SELECT * FROM request_outcomes WHERE by_id = ? ORDER BY decided_at DESC, id LIMIT ?",
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(db_err)?;
        rows.iter()
            .map(|r| {
                let kind: String = r.try_get("kind").map_err(db_err)?;
                let entity: String = r.try_get("entity").map_err(db_err)?;
                Ok(RequestOutcome {
                    id: r.try_get("id").map_err(db_err)?,
                    by_id: r.try_get("by_id").map_err(db_err)?,
                    kind: PendingKind::parse(&kind)
                        .ok_or_else(|| AppError::internal("geçersiz talep türü"))?,
                    entity: Entity::parse(&entity)
                        .ok_or_else(|| AppError::internal("geçersiz varlık"))?,
                    title: r.try_get("title").map_err(db_err)?,
                    detail: r.try_get("detail").map_err(db_err)?,
                    sent_at: r.try_get("sent_at").map_err(db_err)?,
                    decided_at: r.try_get("decided_at").map_err(db_err)?,
                    decider: r.try_get("decider").map_err(db_err)?,
                    approved: r.try_get("approved").map_err(db_err)?,
                })
            })
            .collect()
    }
}

#[async_trait]
impl HistoryRepo for Db {
    async fn list(&self, limit: i64) -> AppResult<Vec<HistoryEntry>> {
        let rows = sqlx::query("SELECT * FROM history ORDER BY at DESC LIMIT ?")
            .bind(limit)
            .fetch_all(&self.pool)
            .await
            .map_err(db_err)?;
        rows.iter()
            .map(|r| {
                Ok(HistoryEntry {
                    id: r.try_get("id").map_err(db_err)?,
                    text: r.try_get("text").map_err(db_err)?,
                    when: r.try_get("at").map_err(db_err)?,
                    ok: r.try_get("ok").map_err(db_err)?,
                })
            })
            .collect()
    }

    async fn insert(&self, h: &HistoryEntry) -> AppResult<()> {
        sqlx::query("INSERT INTO history (id, text, at, ok) VALUES (?, ?, ?, ?)")
            .bind(&h.id)
            .bind(&h.text)
            .bind(h.when)
            .bind(h.ok)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }
}

fn template_from(r: &SqliteRow) -> AppResult<Template> {
    let data: String = r.try_get("data").map_err(db_err)?;
    serde_json::from_str(&data).map_err(AppError::internal)
}

#[async_trait]
impl TemplateRepo for Db {
    async fn list(&self) -> AppResult<Vec<Template>> {
        let rows = sqlx::query("SELECT data FROM templates ORDER BY name")
            .fetch_all(&self.pool)
            .await
            .map_err(db_err)?;
        rows.iter().map(template_from).collect()
    }

    async fn get(&self, id: &str) -> AppResult<Option<Template>> {
        let row = sqlx::query("SELECT data FROM templates WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_err)?;
        row.as_ref().map(template_from).transpose()
    }

    async fn upsert(&self, t: &Template) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO templates (id, name, data, updated) VALUES (?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET name = excluded.name, data = excluded.data, updated = excluded.updated",
        )
        .bind(&t.id)
        .bind(&t.name)
        .bind(serde_json::to_string(t).map_err(AppError::internal)?)
        .bind(t.updated)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM templates WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }
}
