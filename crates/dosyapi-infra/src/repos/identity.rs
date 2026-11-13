use super::Db;
use crate::db::db_err;
use async_trait::async_trait;
use dosyapi_core::error::{AppError, AppResult};
use dosyapi_core::model::*;
use dosyapi_core::ports::*;
use sqlx::Row;
use sqlx::sqlite::SqliteRow;

fn ctx(field: &str, id: &str) -> String {
    format!("users.{field}:{id}")
}

impl Db {
    fn user_from(&self, r: &SqliteRow) -> AppResult<User> {
        let id: String = r.try_get("id").map_err(db_err)?;
        let phone: Option<Vec<u8>> = r.try_get("phone_enc").map_err(db_err)?;
        let totp: Option<Vec<u8>> = r.try_get("totp_secret_enc").map_err(db_err)?;
        let totp_secret = match totp {
            Some(blob) => Some(self.cipher.decrypt_text(&ctx("totp", &id), Some(&blob))?),
            None => None,
        };
        let status: String = r.try_get("status").map_err(db_err)?;
        Ok(User {
            name: r.try_get("name").map_err(db_err)?,
            email: r.try_get("email").map_err(db_err)?,
            phone: self
                .cipher
                .decrypt_text(&ctx("phone", &id), phone.as_deref())?,
            password_hash: r.try_get("password_hash").map_err(db_err)?,
            role_id: r.try_get("role_id").map_err(db_err)?,
            status: if status == "active" {
                UserStatus::Active
            } else {
                UserStatus::Pending
            },
            must_change_password: r.try_get("must_change_password").map_err(db_err)?,
            totp_secret,
            totp_enabled: r.try_get("totp_enabled").map_err(db_err)?,
            failed_logins: r.try_get("failed_logins").map_err(db_err)?,
            lock_reason: LockReason::parse(&r.try_get::<String, _>("lock_reason").map_err(db_err)?),
            locked_until: r.try_get("locked_until").map_err(db_err)?,
            notice_accepted_at: r.try_get("notice_accepted_at").map_err(db_err)?,
            created_at: r.try_get("created_at").map_err(db_err)?,
            id,
        })
    }
}

#[async_trait]
impl UserRepo for Db {
    async fn get(&self, id: &str) -> AppResult<Option<User>> {
        let row = sqlx::query("SELECT * FROM users WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_err)?;
        row.as_ref().map(|r| self.user_from(r)).transpose()
    }

    async fn by_email(&self, email: &str) -> AppResult<Option<User>> {
        let row = sqlx::query("SELECT * FROM users WHERE email = ?")
            .bind(email)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_err)?;
        row.as_ref().map(|r| self.user_from(r)).transpose()
    }

    async fn list(&self) -> AppResult<Vec<User>> {
        let rows = sqlx::query("SELECT * FROM users ORDER BY created_at")
            .fetch_all(&self.pool)
            .await
            .map_err(db_err)?;
        rows.iter().map(|r| self.user_from(r)).collect()
    }

    async fn insert(&self, user: &User) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO users (id, name, email, phone_enc, password_hash, role_id, status, must_change_password, notice_accepted_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&user.id)
        .bind(&user.name)
        .bind(&user.email)
        .bind(self.cipher.encrypt_text(&ctx("phone", &user.id), &user.phone)?)
        .bind(&user.password_hash)
        .bind(&user.role_id)
        .bind(user.status.as_str())
        .bind(user.must_change_password)
        .bind(user.notice_accepted_at)
        .bind(user.created_at)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn update_profile(
        &self,
        id: &str,
        name: &str,
        email: &str,
        phone: &str,
    ) -> AppResult<()> {
        sqlx::query("UPDATE users SET name = ?, email = ?, phone_enc = ? WHERE id = ?")
            .bind(name)
            .bind(email)
            .bind(self.cipher.encrypt_text(&ctx("phone", id), phone)?)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn set_role(&self, id: &str, role_id: Option<&str>, status: UserStatus) -> AppResult<()> {
        sqlx::query("UPDATE users SET role_id = ?, status = ? WHERE id = ?")
            .bind(role_id)
            .bind(status.as_str())
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn set_password(&self, id: &str, hash: &str, must_change: bool) -> AppResult<()> {
        sqlx::query("UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?")
            .bind(hash)
            .bind(must_change)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn set_login_state(
        &self,
        id: &str,
        failed: i64,
        reason: LockReason,
        locked_until: Option<Timestamp>,
    ) -> AppResult<()> {
        sqlx::query(
            "UPDATE users SET failed_logins = ?, lock_reason = ?, locked_until = ? WHERE id = ?",
        )
        .bind(failed)
        .bind(reason.as_str())
        .bind(if reason == LockReason::None {
            None
        } else {
            locked_until
        })
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn set_totp(&self, id: &str, secret: Option<&str>, enabled: bool) -> AppResult<()> {
        let blob = secret
            .map(|s| self.cipher.encrypt_text(&ctx("totp", id), s))
            .transpose()?;
        let mut tx = self.pool.begin().await.map_err(db_err)?;
        sqlx::query(
            "UPDATE users SET totp_secret_enc = ?, totp_enabled = ?,
             totp_last_step = CASE WHEN ? THEN totp_last_step ELSE 0 END WHERE id = ?",
        )
        .bind(blob)
        .bind(enabled)
        .bind(enabled)
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;
        if !enabled {
            sqlx::query("DELETE FROM totp_recovery WHERE user_id = ?")
                .bind(id)
                .execute(&mut *tx)
                .await
                .map_err(db_err)?;
        }
        tx.commit().await.map_err(db_err)?;
        Ok(())
    }

    async fn advance_totp_step(&self, id: &str, step: i64) -> AppResult<bool> {
        let done =
            sqlx::query("UPDATE users SET totp_last_step = ? WHERE id = ? AND totp_last_step < ?")
                .bind(step)
                .bind(id)
                .bind(step)
                .execute(&self.pool)
                .await
                .map_err(db_err)?;
        Ok(done.rows_affected() == 1)
    }

    async fn replace_recovery(&self, id: &str, hashes: &[String]) -> AppResult<()> {
        let mut tx = self.pool.begin().await.map_err(db_err)?;
        sqlx::query("DELETE FROM totp_recovery WHERE user_id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(db_err)?;
        for hash in hashes {
            sqlx::query("INSERT INTO totp_recovery (user_id, code_hash) VALUES (?, ?)")
                .bind(id)
                .bind(hash)
                .execute(&mut *tx)
                .await
                .map_err(db_err)?;
        }
        tx.commit().await.map_err(db_err)?;
        Ok(())
    }

    async fn consume_recovery(&self, id: &str, hash: &str) -> AppResult<bool> {
        let done = sqlx::query("DELETE FROM totp_recovery WHERE user_id = ? AND code_hash = ?")
            .bind(id)
            .bind(hash)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(done.rows_affected() == 1)
    }

    async fn count_recovery(&self, id: &str) -> AppResult<i64> {
        sqlx::query_scalar("SELECT COUNT(*) FROM totp_recovery WHERE user_id = ?")
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .map_err(db_err)
    }

    async fn delete(&self, id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM users WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn count_in_role(&self, role_id: &str) -> AppResult<i64> {
        sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE role_id = ?")
            .bind(role_id)
            .fetch_one(&self.pool)
            .await
            .map_err(db_err)
    }
}

fn role_from(r: &SqliteRow) -> AppResult<Role> {
    let perms: String = r.try_get("perms").map_err(db_err)?;
    Ok(Role {
        id: r.try_get("id").map_err(db_err)?,
        name: r.try_get("name").map_err(db_err)?,
        level: r.try_get("level").map_err(db_err)?,
        perms: serde_json::from_str(&perms).map_err(AppError::internal)?,
    })
}

#[async_trait]
impl RoleRepo for Db {
    async fn list(&self) -> AppResult<Vec<Role>> {
        let rows = sqlx::query("SELECT * FROM roles ORDER BY level, name")
            .fetch_all(&self.pool)
            .await
            .map_err(db_err)?;
        rows.iter().map(role_from).collect()
    }

    async fn get(&self, id: &str) -> AppResult<Option<Role>> {
        let row = sqlx::query("SELECT * FROM roles WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_err)?;
        row.as_ref().map(role_from).transpose()
    }

    async fn insert(&self, role: &Role) -> AppResult<()> {
        sqlx::query("INSERT INTO roles (id, name, level, perms) VALUES (?, ?, ?, ?)")
            .bind(&role.id)
            .bind(&role.name)
            .bind(role.level)
            .bind(serde_json::to_string(&role.perms).map_err(AppError::internal)?)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn update(&self, role: &Role) -> AppResult<()> {
        sqlx::query("UPDATE roles SET name = ?, level = ?, perms = ? WHERE id = ?")
            .bind(&role.name)
            .bind(role.level)
            .bind(serde_json::to_string(&role.perms).map_err(AppError::internal)?)
            .bind(&role.id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM roles WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }
}

#[async_trait]
impl SessionRepo for Db {
    async fn insert(&self, s: &Session) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO sessions (token_hash, kind, user_id, created_at, last_seen_at, expires_at, idle_seconds, persistent, ip, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&s.token_hash)
        .bind(s.kind.as_str())
        .bind(&s.user_id)
        .bind(s.created_at)
        .bind(s.last_seen_at)
        .bind(s.expires_at)
        .bind(s.idle_seconds)
        .bind(s.persistent)
        .bind(&s.ip)
        .bind(&s.user_agent)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn find(&self, token_hash: &[u8]) -> AppResult<Option<Session>> {
        let row = sqlx::query("SELECT * FROM sessions WHERE token_hash = ?")
            .bind(token_hash)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_err)?;
        row.map(|r| {
            let kind: String = r.try_get("kind").map_err(db_err)?;
            Ok(Session {
                token_hash: r.try_get("token_hash").map_err(db_err)?,
                kind: if kind == "master" {
                    SessionKind::Master
                } else {
                    SessionKind::User
                },
                user_id: r.try_get("user_id").map_err(db_err)?,
                created_at: r.try_get("created_at").map_err(db_err)?,
                last_seen_at: r.try_get("last_seen_at").map_err(db_err)?,
                expires_at: r.try_get("expires_at").map_err(db_err)?,
                idle_seconds: r.try_get("idle_seconds").map_err(db_err)?,
                persistent: r.try_get("persistent").map_err(db_err)?,
                ip: r.try_get("ip").map_err(db_err)?,
                user_agent: r.try_get("user_agent").map_err(db_err)?,
            })
        })
        .transpose()
    }

    async fn touch(&self, token_hash: &[u8], last_seen: Timestamp) -> AppResult<()> {
        sqlx::query("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?")
            .bind(last_seen)
            .bind(token_hash)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn delete(&self, token_hash: &[u8]) -> AppResult<()> {
        sqlx::query("DELETE FROM sessions WHERE token_hash = ?")
            .bind(token_hash)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn delete_for_user(&self, user_id: &str, except: Option<&[u8]>) -> AppResult<()> {
        sqlx::query("DELETE FROM sessions WHERE user_id = ? AND (? IS NULL OR token_hash <> ?)")
            .bind(user_id)
            .bind(except)
            .bind(except)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn delete_kind(&self, kind: SessionKind) -> AppResult<()> {
        sqlx::query("DELETE FROM sessions WHERE kind = ?")
            .bind(kind.as_str())
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn purge_expired(&self, now: Timestamp) -> AppResult<()> {
        sqlx::query("DELETE FROM sessions WHERE expires_at <= ?")
            .bind(now)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        sqlx::query("DELETE FROM auth_tokens WHERE expires_at <= ? OR used_at IS NOT NULL")
            .bind(now)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }
}

#[async_trait]
impl TokenRepo for Db {
    async fn replace(
        &self,
        token_hash: &[u8],
        purpose: &str,
        user_id: &str,
        expires_at: Timestamp,
    ) -> AppResult<()> {
        let mut tx = self.pool.begin().await.map_err(db_err)?;
        sqlx::query("DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?")
            .bind(user_id)
            .bind(purpose)
            .execute(&mut *tx)
            .await
            .map_err(db_err)?;
        sqlx::query("INSERT INTO auth_tokens (token_hash, purpose, user_id, expires_at) VALUES (?, ?, ?, ?)")
            .bind(token_hash)
            .bind(purpose)
            .bind(user_id)
            .bind(expires_at)
            .execute(&mut *tx)
            .await
            .map_err(db_err)?;
        tx.commit().await.map_err(db_err)
    }

    async fn consume(
        &self,
        token_hash: &[u8],
        purpose: &str,
        now: Timestamp,
    ) -> AppResult<Option<Id>> {
        sqlx::query_scalar(
            "UPDATE auth_tokens SET used_at = ?
             WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?
             RETURNING user_id",
        )
        .bind(now)
        .bind(token_hash)
        .bind(purpose)
        .bind(now)
        .fetch_optional(&self.pool)
        .await
        .map_err(db_err)
    }
}

#[async_trait]
impl SettingsRepo for Db {
    async fn get(&self, key: &str) -> AppResult<Option<String>> {
        sqlx::query_scalar("SELECT value FROM settings WHERE key = ?")
            .bind(key)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_err)
    }

    async fn set(&self, key: &str, value: &str) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO settings (key, value) VALUES (?, ?)
             ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()",
        )
        .bind(key)
        .bind(value)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn remove(&self, key: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM settings WHERE key = ?")
            .bind(key)
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }
}
