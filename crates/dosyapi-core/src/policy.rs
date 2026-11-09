//! Yetki kuralları: saf fonksiyonlar, yan etki yok. Sunucunun tek yetki kaynağı.
//! İstemcideki gizleme yalnızca kullanım kolaylığıdır, güvenlik sınırı değildir.

use crate::model::{AccessMode, Actor, Entity, Pending, PendingKind, Role};

impl Actor {
    pub fn level(&self) -> i64 {
        self.role.level
    }
    pub fn is_top(&self) -> bool {
        self.role.level == 1
    }
    pub fn project_mode(&self) -> AccessMode {
        if self.is_top() {
            AccessMode::Edit
        } else {
            self.role.perms.projects
        }
    }
    pub fn record_mode(&self) -> AccessMode {
        if self.is_top() {
            AccessMode::Edit
        } else {
            self.role.perms.records
        }
    }
    fn flag(&self, value: bool) -> bool {
        self.is_top() || value
    }
    pub fn can_company(&self) -> bool {
        self.flag(self.role.perms.company)
    }
    pub fn can_users(&self) -> bool {
        self.flag(self.role.perms.users)
    }
    pub fn can_approve(&self) -> bool {
        self.flag(self.role.perms.approve)
    }
    pub fn can_tasks(&self) -> bool {
        self.flag(self.role.perms.tasks)
    }
    pub fn can_files(&self) -> bool {
        self.flag(self.role.perms.files)
    }
    pub fn can_templates(&self) -> bool {
        self.flag(self.role.perms.templates)
    }
    /// Kişisel veriyi (TC, telefon, adres) açık görebilir mi?
    pub fn sees_project_pii(&self) -> bool {
        self.project_mode().can_write()
    }
    pub fn sees_record_pii(&self) -> bool {
        self.record_mode().can_write()
    }
}

/// Aktörün atayabileceği roller: 1. kademe tüm alt rolleri, diğerleri `manage` listesini.
pub fn manageable_roles<'a>(actor: &Actor, roles: &'a [Role]) -> Vec<&'a Role> {
    if actor.is_top() {
        return roles.iter().filter(|r| r.level > 1).collect();
    }
    if !actor.role.perms.users {
        return vec![];
    }
    roles
        .iter()
        .filter(|r| r.level > actor.level() && actor.role.perms.manage.contains(&r.id))
        .collect()
}

/// Bir kullanıcı hesabı üzerinde işlem yapabilir mi?
/// Kendi kademesi ve üstü ile 1. kademe hesapları asla (onlar sistem panelinden yönetilir).
pub fn can_manage_user(actor: &Actor, target_role: Option<&Role>) -> bool {
    if !actor.can_users() {
        return false;
    }
    let Some(role) = target_role else {
        return true;
    };
    if role.level == 1 || role.level <= actor.level() {
        return false;
    }
    actor.is_top() || actor.role.perms.manage.contains(&role.id)
}

/// Görev atanabilecek kullanıcı: aktörden alt kademede olmalı.
pub fn can_assign_task_to(actor: &Actor, target_role: Option<&Role>) -> bool {
    actor.can_tasks() && target_role.is_some_and(|r| r.level > actor.level())
}

fn can_decide_entity(actor: &Actor, entity: Entity) -> bool {
    match entity {
        Entity::Project => actor.project_mode().is_direct(),
        Entity::Author | Entity::Contractor => actor.record_mode().is_direct(),
        Entity::User => actor.can_users(),
    }
}

pub fn can_view_pending(actor: &Actor, pending: &Pending) -> bool {
    let mine = pending.by_id == actor.user_id;
    match pending.kind {
        PendingKind::UserApprove => {
            actor.can_approve() && actor.level() <= pending.min_level.max(2)
        }
        PendingKind::UserDelete => {
            mine || (actor.can_users() && actor.level() < pending.target_level.unwrap_or(i64::MAX))
        }
        _ => {
            mine || (actor.level() <= pending.min_level && can_decide_entity(actor, pending.entity))
        }
    }
}

/// Karar verebilir mi? Kendi talebini onaylayamaz (görevler ayrılığı).
pub fn can_decide_pending(actor: &Actor, pending: &Pending) -> bool {
    if !can_view_pending(actor, pending) {
        return false;
    }
    let mine = pending.by_id == actor.user_id;
    match pending.kind {
        PendingKind::UserApprove => actor.can_approve(),
        PendingKind::UserDelete => actor.can_users() && !mine,
        _ => !mine && can_decide_entity(actor, pending.entity),
    }
}

/// Onay kuyruğundaki talebin en düşük onaylayıcı kademesi.
pub fn approver_level(actor: &Actor) -> i64 {
    (actor.level() - 1).max(1)
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use crate::model::*;

    fn role(id: &str, level: i64, perms: Permissions) -> Role {
        Role {
            id: id.into(),
            name: id.into(),
            level,
            perms,
        }
    }
    fn actor(role: Role) -> Actor {
        Actor {
            user_id: "me".into(),
            name: "me".into(),
            email: "me@x.com".into(),
            role,
            must_change_password: false,
            totp_enabled: false,
        }
    }
    fn pending(kind: PendingKind, entity: Entity, by: &str, min: i64) -> Pending {
        Pending {
            id: "p".into(),
            kind,
            entity,
            payload: PendingPayload::ProjectDelete { id: "x".into() },
            title: String::new(),
            detail: String::new(),
            by: String::new(),
            by_id: by.into(),
            when: 0,
            min_level: min,
            target_level: None,
            doc_key: None,
            file_name: None,
        }
    }

    #[test]
    fn top_has_all_but_is_not_editable_by_others() {
        let mut p = Permissions::minimal();
        p.users = true;
        p.manage = vec!["r1".into()];
        let a = actor(role("r2", 2, p));
        let top = role("r1", 1, Permissions::top());
        assert!(!can_manage_user(&a, Some(&top)), "1. kademe yönetilemez");
    }

    #[test]
    fn same_level_cannot_be_managed() {
        let mut p = Permissions::minimal();
        p.users = true;
        p.manage = vec!["r3".into()];
        let a = actor(role("r2", 2, p));
        assert!(!can_manage_user(
            &a,
            Some(&role("r2b", 2, Permissions::minimal()))
        ));
        assert!(can_manage_user(
            &a,
            Some(&role("r3", 3, Permissions::minimal()))
        ));
        assert!(
            !can_manage_user(&a, Some(&role("r4", 3, Permissions::minimal()))),
            "manage listesinde yok"
        );
    }

    #[test]
    fn cannot_approve_own_request() {
        let top = actor(role("r1", 1, Permissions::top()));
        let own = pending(PendingKind::Update, Entity::Project, "me", 1);
        assert!(!can_decide_pending(&top, &own));
        let other = pending(PendingKind::Update, Entity::Project, "you", 1);
        assert!(can_decide_pending(&top, &other));
    }

    #[test]
    fn low_level_cannot_decide_higher_requests() {
        let mut p = Permissions::minimal();
        p.projects = AccessMode::Edit;
        let a = actor(role("r3", 3, p));
        let req = pending(PendingKind::Update, Entity::Project, "you", 2);
        assert!(!can_decide_pending(&a, &req));
    }

    #[test]
    fn project_approver_needs_project_edit() {
        let mut p = Permissions::minimal();
        p.users = true;
        let a = actor(role("r2", 2, p));
        let req = pending(PendingKind::Update, Entity::Project, "you", 2);
        assert!(
            !can_decide_pending(&a, &req),
            "kullanıcı yetkisi proje onayı vermez"
        );
    }

    #[test]
    fn user_without_flag_has_no_rights() {
        let a = actor(role("r4", 4, Permissions::minimal()));
        assert!(!a.can_files() && !a.can_users() && !a.can_tasks() && !a.can_templates());
        assert_eq!(a.project_mode(), AccessMode::Read);
        assert!(!a.sees_project_pii());
    }
}
