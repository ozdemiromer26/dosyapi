//! Kullanıcılar arası birebir mesajlaşma. Her etkin kullanıcı diğer etkin kullanıcıya yazabilir;
//! konuşmayı yalnızca iki tarafı görür. Yöneticiler ve sistem paneli içeriğe erişemez.

use crate::error::{AppError, AppResult};
use crate::model::*;
use crate::ports::*;
use crate::validate;
use serde::Deserialize;
use std::sync::Arc;

/// Mesaj gövdesi üst sınırı (karakter).
pub const MAX_MESSAGE_CHARS: usize = 4000;
/// Tek istekte dönen en fazla mesaj.
pub const PAGE: i64 = 50;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SendInput {
    /// Alıcı kullanıcı; konuşma yoksa ilk mesajla oluşturulur.
    pub to: Id,
    pub body: String,
}

#[derive(Clone)]
pub struct MessageService {
    pub messages: Arc<dyn MessageRepo>,
    pub users: Arc<dyn UserRepo>,
    pub clock: Arc<dyn Clock>,
    pub limiter: Arc<dyn RateLimiter>,
}

impl MessageService {
    fn limit(&self, key: String, limit: u32, window: u64) -> AppResult<()> {
        self.limiter
            .hit(&key, limit, window)
            .map_err(|RetryAfter(secs)| AppError::RateLimited {
                retry_after_secs: secs,
            })
    }

    /// Üye olmayan için konuşma "yok" sayılır (varlığı da sızdırılmaz).
    async fn member_conversation(&self, actor: &Actor, id: &str) -> AppResult<Conversation> {
        self.messages
            .conversation(id)
            .await?
            .filter(|c| c.has(&actor.user_id))
            .ok_or(AppError::NotFound)
    }

    pub async fn list(&self, actor: &Actor) -> AppResult<Vec<ConversationView>> {
        self.messages.list_for(&actor.user_id).await
    }

    pub async fn unread(&self, actor: &Actor) -> AppResult<i64> {
        self.messages.unread_total(&actor.user_id).await
    }

    /// Konuşmanın son sayfasını ya da `before` öncesini döndürür; son sayfa okununca
    /// okundu işareti ilerletilir.
    pub async fn thread(
        &self,
        actor: &Actor,
        id: &str,
        before: Option<i64>,
    ) -> AppResult<(Conversation, Vec<Message>)> {
        let conversation = self.member_conversation(actor, id).await?;
        let list = self.messages.messages(id, before, PAGE).await?;
        if before.is_none()
            && let Some(last) = list.last()
        {
            self.messages
                .mark_read(id, &actor.user_id, last.seq)
                .await?;
        }
        Ok((conversation, list))
    }

    pub async fn send(&self, actor: &Actor, input: SendInput) -> AppResult<Message> {
        self.limit(format!("msg:{}", actor.user_id), 30, 60)?;
        let body = validate::multiline(&input.body, "Mesaj", MAX_MESSAGE_CHARS)?;
        if body.is_empty() {
            return Err(AppError::validation("Boş mesaj gönderilemez."));
        }
        let to = validate::uuid(&input.to)?;
        if to == actor.user_id {
            return Err(AppError::validation("Kendinize mesaj gönderemezsiniz."));
        }
        let recipient = self.users.get(&to).await?.ok_or(AppError::NotFound)?;
        if recipient.status != UserStatus::Active {
            return Err(AppError::NotFound);
        }
        let now = self.clock.now();
        let conversation = match self
            .messages
            .conversation_between(&actor.user_id, &to)
            .await?
        {
            Some(c) => c,
            None => {
                let (user_a, user_b) = if actor.user_id < to {
                    (actor.user_id.clone(), to.clone())
                } else {
                    (to.clone(), actor.user_id.clone())
                };
                self.messages
                    .create_conversation(&Conversation {
                        id: new_id(),
                        user_a,
                        user_b,
                        created_at: now,
                        a_read_seq: 0,
                        b_read_seq: 0,
                    })
                    .await?
            }
        };
        let mut message = Message {
            id: new_id(),
            seq: 0,
            conversation_id: conversation.id.clone(),
            sender_id: actor.user_id.clone(),
            body,
            created_at: now,
        };
        message.seq = self.messages.add_message(&message).await?;
        // Kendi gönderdiği mesaj gönderen için okunmuş sayılır.
        self.messages
            .mark_read(&conversation.id, &actor.user_id, message.seq)
            .await?;
        Ok(message)
    }
}
