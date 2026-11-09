use super::Db;
use crate::db::db_err;
use async_trait::async_trait;
use dosyapi_core::error::AppResult;
use dosyapi_core::model::*;
use dosyapi_core::ports::*;
use sqlx::Row;
use sqlx::sqlite::SqliteRow;

/// Şifreleme bağlamı mesaj ve konuşma kimliğini içerir: gövde başka bir satıra
/// kopyalanırsa çözülemez.
fn body_ctx(message_id: &str, conversation_id: &str) -> String {
    format!("messages.body:{conversation_id}:{message_id}")
}

/// Konuşma listesinde gösterilen son mesaj önizlemesi (karakter).
const PREVIEW_CHARS: usize = 140;

fn conversation_from(r: &SqliteRow) -> AppResult<Conversation> {
    Ok(Conversation {
        id: r.try_get("id").map_err(db_err)?,
        user_a: r.try_get("user_a").map_err(db_err)?,
        user_b: r.try_get("user_b").map_err(db_err)?,
        created_at: r.try_get("created_at").map_err(db_err)?,
        a_read_seq: r.try_get("a_read_seq").map_err(db_err)?,
        b_read_seq: r.try_get("b_read_seq").map_err(db_err)?,
    })
}

impl Db {
    fn message_from(&self, r: &SqliteRow) -> AppResult<Message> {
        let id: String = r.try_get("id").map_err(db_err)?;
        let conversation_id: String = r.try_get("conversation_id").map_err(db_err)?;
        let blob: Vec<u8> = r.try_get("body_enc").map_err(db_err)?;
        Ok(Message {
            body: self
                .cipher
                .decrypt_text(&body_ctx(&id, &conversation_id), Some(&blob))?,
            seq: r.try_get("seq").map_err(db_err)?,
            sender_id: r.try_get("sender_id").map_err(db_err)?,
            created_at: r.try_get("created_at").map_err(db_err)?,
            id,
            conversation_id,
        })
    }
}

#[async_trait]
impl MessageRepo for Db {
    async fn conversation(&self, id: &str) -> AppResult<Option<Conversation>> {
        let row = sqlx::query("SELECT * FROM conversations WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_err)?;
        row.as_ref().map(conversation_from).transpose()
    }

    async fn conversation_between(&self, a: &str, b: &str) -> AppResult<Option<Conversation>> {
        let (lo, hi) = if a < b { (a, b) } else { (b, a) };
        let row = sqlx::query("SELECT * FROM conversations WHERE user_a = ? AND user_b = ?")
            .bind(lo)
            .bind(hi)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_err)?;
        row.as_ref().map(conversation_from).transpose()
    }

    async fn create_conversation(&self, c: &Conversation) -> AppResult<Conversation> {
        sqlx::query(
            "INSERT INTO conversations (id, user_a, user_b, created_at) VALUES (?, ?, ?, ?)
             ON CONFLICT (user_a, user_b) DO NOTHING",
        )
        .bind(&c.id)
        .bind(&c.user_a)
        .bind(&c.user_b)
        .bind(c.created_at)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        self.conversation_between(&c.user_a, &c.user_b)
            .await?
            .ok_or_else(|| dosyapi_core::error::AppError::internal("konuşma oluşturulamadı"))
    }

    async fn list_for(&self, user_id: &str) -> AppResult<Vec<ConversationView>> {
        let rows = sqlx::query(
            "SELECT c.id AS cid, c.user_a, c.user_b,
                    m.id, m.seq, m.conversation_id, m.sender_id, m.body_enc, m.created_at,
                    (SELECT COUNT(*) FROM messages x
                      WHERE x.conversation_id = c.id AND x.sender_id <> ?1
                        AND x.seq > CASE WHEN c.user_a = ?1 THEN c.a_read_seq ELSE c.b_read_seq END) AS unread
               FROM conversations c
               JOIN messages m ON m.seq = (SELECT MAX(seq) FROM messages WHERE conversation_id = c.id)
              WHERE c.user_a = ?1 OR c.user_b = ?1
              ORDER BY m.seq DESC",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(db_err)?;
        rows.iter()
            .map(|r| {
                let last = self.message_from(r)?;
                let a: String = r.try_get("user_a").map_err(db_err)?;
                let b: String = r.try_get("user_b").map_err(db_err)?;
                Ok(ConversationView {
                    id: r.try_get("cid").map_err(db_err)?,
                    other_id: if a == user_id { b } else { a },
                    last_at: last.created_at,
                    last_body: last.body.chars().take(PREVIEW_CHARS).collect(),
                    last_from_me: last.sender_id == user_id,
                    unread: r.try_get("unread").map_err(db_err)?,
                })
            })
            .collect()
    }

    async fn add_message(&self, m: &Message) -> AppResult<i64> {
        let blob = self
            .cipher
            .encrypt_text(&body_ctx(&m.id, &m.conversation_id), &m.body)?;
        let done = sqlx::query(
            "INSERT INTO messages (id, conversation_id, sender_id, body_enc, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&m.id)
        .bind(&m.conversation_id)
        .bind(&m.sender_id)
        .bind(blob)
        .bind(m.created_at)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(done.last_insert_rowid())
    }

    async fn messages(
        &self,
        conversation_id: &str,
        before: Option<i64>,
        limit: i64,
    ) -> AppResult<Vec<Message>> {
        let rows = sqlx::query(
            "SELECT * FROM (SELECT * FROM messages WHERE conversation_id = ? AND seq < ?
                             ORDER BY seq DESC LIMIT ?) ORDER BY seq ASC",
        )
        .bind(conversation_id)
        .bind(before.unwrap_or(i64::MAX))
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(db_err)?;
        rows.iter().map(|r| self.message_from(r)).collect()
    }

    async fn mark_read(&self, conversation_id: &str, user_id: &str, seq: i64) -> AppResult<()> {
        sqlx::query(
            "UPDATE conversations SET
                a_read_seq = CASE WHEN user_a = ?2 AND a_read_seq < ?3 THEN ?3 ELSE a_read_seq END,
                b_read_seq = CASE WHEN user_b = ?2 AND b_read_seq < ?3 THEN ?3 ELSE b_read_seq END
              WHERE id = ?1",
        )
        .bind(conversation_id)
        .bind(user_id)
        .bind(seq)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn unread_total(&self, user_id: &str) -> AppResult<i64> {
        sqlx::query_scalar(
            "SELECT COUNT(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id
              WHERE (c.user_a = ?1 OR c.user_b = ?1) AND m.sender_id <> ?1
                AND m.seq > CASE WHEN c.user_a = ?1 THEN c.a_read_seq ELSE c.b_read_seq END",
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(db_err)
    }
}
