use super::Db;
use crate::db::db_err;
use async_trait::async_trait;
use dosyapi_core::error::{AppError, AppResult};
use dosyapi_core::model::*;
use dosyapi_core::ports::*;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use sqlx::sqlite::SqliteRow;

/// Arsa sahibi ve vekil bilgileri tek şifreli blob olarak tutulur.
#[derive(Serialize, Deserialize, Default)]
struct People {
    owners: Vec<Owner>,
    proxy: Proxy,
}

const PROJECT_SELECT_ALL: &str = "SELECT p.*, c.title AS contractor_title FROM projects p
     JOIN contractors c ON c.id = p.contractor_id ORDER BY p.created_at DESC";
const PROJECT_SELECT_ONE: &str = "SELECT p.*, c.title AS contractor_title FROM projects p
     JOIN contractors c ON c.id = p.contractor_id WHERE p.id = ?";

fn people_ctx(id: &str) -> String {
    format!("projects.people:{id}")
}

fn author_ctx(field: &str, id: &str) -> String {
    format!("authors.{field}:{id}")
}

impl Db {
    fn project_from(&self, r: &SqliteRow, author_ids: Vec<Id>) -> AppResult<Project> {
        let id: String = r.try_get("id").map_err(db_err)?;
        let blob: Vec<u8> = r.try_get("people_enc").map_err(db_err)?;
        let plain = self.cipher.decrypt(&people_ctx(&id), &blob)?;
        let people: People = serde_json::from_slice(&plain).map_err(AppError::internal)?;
        let status: String = r.try_get("status").map_err(db_err)?;
        Ok(Project {
            name: r.try_get("name").map_err(db_err)?,
            contractor_id: r.try_get("contractor_id").map_err(db_err)?,
            contractor: r.try_get("contractor_title").map_err(db_err)?,
            ada: r.try_get("ada").map_err(db_err)?,
            parsel: r.try_get("parsel").map_err(db_err)?,
            pafta: r.try_get("pafta").map_err(db_err)?,
            mahalle: r.try_get("mahalle").map_err(db_err)?,
            street: r.try_get("street").map_err(db_err)?,
            status: ProjectStatus::parse(&status)
                .ok_or_else(|| AppError::internal("geçersiz proje durumu"))?,
            done: r.try_get("done").map_err(db_err)?,
            note: r.try_get("note").map_err(db_err)?,
            photo_at: r.try_get("photo_at").map_err(db_err)?,
            photo_mime: r.try_get("photo_mime").map_err(db_err)?,
            author_ids,
            owners: people.owners,
            proxy: people.proxy,
            created_at: r.try_get("created_at").map_err(db_err)?,
            updated_at: r.try_get("updated_at").map_err(db_err)?,
            id,
        })
    }

    fn seal_people(&self, project: &Project) -> AppResult<Vec<u8>> {
        let people = serde_json::to_vec(&People {
            owners: project.owners.clone(),
            proxy: project.proxy.clone(),
        })
        .map_err(AppError::internal)?;
        self.cipher.encrypt(&people_ctx(&project.id), &people)
    }

    async fn author_ids(&self, project_id: &str) -> AppResult<Vec<Id>> {
        sqlx::query_scalar(
            "SELECT author_id FROM project_authors WHERE project_id = ? ORDER BY position",
        )
        .bind(project_id)
        .fetch_all(&self.pool)
        .await
        .map_err(db_err)
    }

    fn author_from(&self, r: &SqliteRow) -> AppResult<Author> {
        let id: String = r.try_get("id").map_err(db_err)?;
        let tc: Option<Vec<u8>> = r.try_get("tc_enc").map_err(db_err)?;
        let phone: Option<Vec<u8>> = r.try_get("phone_enc").map_err(db_err)?;
        let address: Option<Vec<u8>> = r.try_get("address_enc").map_err(db_err)?;
        Ok(Author {
            tc: self
                .cipher
                .decrypt_text(&author_ctx("tc", &id), tc.as_deref())?,
            first: r.try_get("first").map_err(db_err)?,
            last: r.try_get("last").map_err(db_err)?,
            phone: self
                .cipher
                .decrypt_text(&author_ctx("phone", &id), phone.as_deref())?,
            company: r.try_get("company").map_err(db_err)?,
            job: r.try_get("job").map_err(db_err)?,
            sicil: r.try_get("sicil").map_err(db_err)?,
            address: self
                .cipher
                .decrypt_text(&author_ctx("address", &id), address.as_deref())?,
            id,
        })
    }
}

#[async_trait]
impl ProjectRepo for Db {
    async fn list(&self) -> AppResult<Vec<Project>> {
        let rows = sqlx::query(PROJECT_SELECT_ALL)
            .fetch_all(&self.pool)
            .await
            .map_err(db_err)?;
        let links =
            sqlx::query("SELECT project_id, author_id FROM project_authors ORDER BY position")
                .fetch_all(&self.pool)
                .await
                .map_err(db_err)?;
        let mut out = Vec::with_capacity(rows.len());
        for row in &rows {
            let id: String = row.try_get("id").map_err(db_err)?;
            let ids = links
                .iter()
                .filter(|l| l.try_get::<String, _>("project_id").is_ok_and(|p| p == id))
                .filter_map(|l| l.try_get("author_id").ok())
                .collect();
            out.push(self.project_from(row, ids)?);
        }
        Ok(out)
    }

    async fn get(&self, id: &str) -> AppResult<Option<Project>> {
        let row = sqlx::query(PROJECT_SELECT_ONE)
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_err)?;
        match row {
            Some(r) => {
                let ids = self.author_ids(id).await?;
                Ok(Some(self.project_from(&r, ids)?))
            }
            None => Ok(None),
        }
    }

    async fn insert(&self, p: &Project) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO projects (id, name, contractor_id, ada, parsel, pafta, mahalle, street, status, done, note, people_enc, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&p.id)
        .bind(&p.name)
        .bind(&p.contractor_id)
        .bind(&p.ada)
        .bind(&p.parsel)
        .bind(&p.pafta)
        .bind(&p.mahalle)
        .bind(&p.street)
        .bind(p.status.as_str())
        .bind(p.done)
        .bind(&p.note)
        .bind(self.seal_people(p)?)
        .bind(p.created_at)
        .bind(p.updated_at)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn update(&self, p: &Project) -> AppResult<()> {
        sqlx::query(
            "UPDATE projects SET name = ?, contractor_id = ?, ada = ?, parsel = ?, pafta = ?, mahalle = ?, street = ?, status = ?,
             done = ?, note = ?, people_enc = ?, updated_at = ? WHERE id = ?",
        )
        .bind(&p.name)
        .bind(&p.contractor_id)
        .bind(&p.ada)
        .bind(&p.parsel)
        .bind(&p.pafta)
        .bind(&p.mahalle)
        .bind(&p.street)
        .bind(p.status.as_str())
        .bind(p.done)
        .bind(&p.note)
        .bind(self.seal_people(p)?)
        .bind(p.updated_at)
        .bind(&p.id)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn set_photo(&self, id: &str, mime: &str, at: Timestamp) -> AppResult<()> {
        sqlx::query("UPDATE projects SET photo_mime = ?, photo_at = ? WHERE id = ?")
            .bind(mime)
            .bind(at)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM projects WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn set_authors(&self, id: &str, author_ids: &[Id]) -> AppResult<()> {
        let mut tx = self.pool.begin().await.map_err(db_err)?;
        sqlx::query("DELETE FROM project_authors WHERE project_id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(db_err)?;
        for (position, author) in author_ids.iter().enumerate() {
            sqlx::query(
                "INSERT INTO project_authors (project_id, author_id, position) VALUES (?, ?, ?)",
            )
            .bind(id)
            .bind(author)
            .bind(position as i64)
            .execute(&mut *tx)
            .await
            .map_err(db_err)?;
        }
        tx.commit().await.map_err(db_err)
    }

    async fn uses_contractor(&self, contractor_id: &str) -> AppResult<bool> {
        let count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM projects WHERE contractor_id = ?")
                .bind(contractor_id)
                .fetch_one(&self.pool)
                .await
                .map_err(db_err)?;
        Ok(count > 0)
    }
}

#[async_trait]
impl AuthorRepo for Db {
    async fn list(&self) -> AppResult<Vec<Author>> {
        let rows = sqlx::query("SELECT * FROM authors ORDER BY first, last")
            .fetch_all(&self.pool)
            .await
            .map_err(db_err)?;
        rows.iter().map(|r| self.author_from(r)).collect()
    }

    async fn get(&self, id: &str) -> AppResult<Option<Author>> {
        let row = sqlx::query("SELECT * FROM authors WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_err)?;
        row.as_ref().map(|r| self.author_from(r)).transpose()
    }

    async fn insert(&self, a: &Author) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO authors (id, tc_enc, first, last, phone_enc, company, job, sicil, address_enc)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&a.id)
        .bind(self.cipher.encrypt_text(&author_ctx("tc", &a.id), &a.tc)?)
        .bind(&a.first)
        .bind(&a.last)
        .bind(self.cipher.encrypt_text(&author_ctx("phone", &a.id), &a.phone)?)
        .bind(&a.company)
        .bind(&a.job)
        .bind(&a.sicil)
        .bind(self.cipher.encrypt_text(&author_ctx("address", &a.id), &a.address)?)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn update(&self, a: &Author) -> AppResult<()> {
        sqlx::query(
            "UPDATE authors SET tc_enc = ?, first = ?, last = ?, phone_enc = ?, company = ?, job = ?, sicil = ?, address_enc = ?
             WHERE id = ?",
        )
        .bind(self.cipher.encrypt_text(&author_ctx("tc", &a.id), &a.tc)?)
        .bind(&a.first)
        .bind(&a.last)
        .bind(self.cipher.encrypt_text(&author_ctx("phone", &a.id), &a.phone)?)
        .bind(&a.company)
        .bind(&a.job)
        .bind(&a.sicil)
        .bind(self.cipher.encrypt_text(&author_ctx("address", &a.id), &a.address)?)
        .bind(&a.id)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM authors WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }
}

fn contractor_from(r: &SqliteRow) -> AppResult<Contractor> {
    Ok(Contractor {
        id: r.try_get("id").map_err(db_err)?,
        title: r.try_get("title").map_err(db_err)?,
        owner: r.try_get("owner").map_err(db_err)?,
        licence: r.try_get("licence").map_err(db_err)?,
        rank: r.try_get("rank").map_err(db_err)?,
        address: r.try_get("address").map_err(db_err)?,
    })
}

#[async_trait]
impl ContractorRepo for Db {
    async fn list(&self) -> AppResult<Vec<Contractor>> {
        let rows = sqlx::query("SELECT * FROM contractors ORDER BY title")
            .fetch_all(&self.pool)
            .await
            .map_err(db_err)?;
        rows.iter().map(contractor_from).collect()
    }

    async fn get(&self, id: &str) -> AppResult<Option<Contractor>> {
        let row = sqlx::query("SELECT * FROM contractors WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_err)?;
        row.as_ref().map(contractor_from).transpose()
    }

    async fn insert(&self, c: &Contractor) -> AppResult<()> {
        sqlx::query("INSERT INTO contractors (id, title, owner, licence, rank, address) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(&c.id)
            .bind(&c.title)
            .bind(&c.owner)
            .bind(&c.licence)
            .bind(&c.rank)
            .bind(&c.address)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn update(&self, c: &Contractor) -> AppResult<()> {
        sqlx::query("UPDATE contractors SET title = ?, owner = ?, licence = ?, rank = ?, address = ? WHERE id = ?")
            .bind(&c.title)
            .bind(&c.owner)
            .bind(&c.licence)
            .bind(&c.rank)
            .bind(&c.address)
            .bind(&c.id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM contractors WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }
}
