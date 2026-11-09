use crate::error::{AppError, AppResult};
use crate::model::*;
use crate::ports::*;
use crate::services::audit::Auditor;
use crate::validate;
use serde::Deserialize;
use std::sync::Arc;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RoleInput {
    pub name: String,
    pub level: i64,
    pub perms: Permissions,
}

/// Rol yönetimi yalnızca sistem panelinden yapılır.
#[derive(Clone)]
pub struct RoleService {
    pub roles: Arc<dyn RoleRepo>,
    pub users: Arc<dyn UserRepo>,
    pub audit: Auditor,
}

impl RoleService {
    async fn check_manage(&self, level: i64, manage: &[Id]) -> AppResult<()> {
        let roles = self.roles.list().await?;
        for id in manage {
            let role = roles
                .iter()
                .find(|r| &r.id == id)
                .ok_or_else(|| AppError::validation("Geçersiz alt rol."))?;
            if role.level <= level {
                return Err(AppError::validation(
                    "Yalnızca daha alt kademedeki roller yönetilebilir.",
                ));
            }
        }
        Ok(())
    }

    pub async fn add(&self, input: RoleInput, meta: &RequestMeta) -> AppResult<Role> {
        if input.level < 2 || input.level > 99 {
            return Err(AppError::validation(
                "Rol adı ve 2 veya üzeri kademe girin.",
            ));
        }
        self.check_manage(input.level, &input.perms.manage).await?;
        let role = Role {
            id: new_id(),
            name: validate::required(&input.name, "Rol adı", 80)?,
            level: input.level,
            perms: input.perms,
        };
        self.roles.insert(&role).await?;
        self.audit.master(meta, "role.add", &role.id, "").await?;
        Ok(role)
    }

    /// 1. kademe rolün yalnızca adı değiştirilebilir; yetkileri kilitlidir.
    pub async fn update(&self, id: &str, input: RoleInput, meta: &RequestMeta) -> AppResult<()> {
        let mut role = self.roles.get(id).await?.ok_or(AppError::NotFound)?;
        role.name = validate::required(&input.name, "Rol adı", 80)?;
        if role.level != 1 {
            if input.level < 2 || input.level > 99 {
                return Err(AppError::validation("Kademe 2 veya üzeri olmalı."));
            }
            self.check_manage(input.level, &input.perms.manage).await?;
            role.level = input.level;
            role.perms = input.perms;
        }
        self.roles.update(&role).await?;
        self.audit.master(meta, "role.update", id, "").await
    }

    pub async fn delete(&self, id: &str, meta: &RequestMeta) -> AppResult<()> {
        let role = self.roles.get(id).await?.ok_or(AppError::NotFound)?;
        if role.level == 1 {
            return Err(AppError::conflict("Üst yönetici rolü silinemez."));
        }
        if self.users.count_in_role(id).await? > 0 {
            return Err(AppError::conflict(
                "Bu rolde kullanıcı var, önce rolleri değiştirin.",
            ));
        }
        self.roles.delete(id).await?;
        self.audit.master(meta, "role.delete", id, "").await
    }
}
