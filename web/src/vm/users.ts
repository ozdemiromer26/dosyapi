// Görünüm modeli: users
import type { Ctx, Vals } from "./types";
import { ini } from "../domain/constants";
import { tx } from "../i18n";
/*IMPORTS*/

export function buildUsers(c: Ctx): () => Vals {
  const app = c.app;
  const { lvl, me, s, top } = c; /*TOP*/
    const assignable = app.manageableRoles();
    const manageUsers = s.users.filter(u => u.id !== (me && me.id)).map(u => {
      const r = app.roleOf(u);
      const tLvl = r ? r.level : 99;
      const editable = app.perm("users") && tLvl > lvl && (top || (app.myRole() && app.myRole().perms.manage.indexOf(u.roleId) > -1)) && tLvl !== 1;
      return {
        ...u, initials: ini(u.name),
        roleLabel: u.status === "pending" ? tx("Onay bekliyor") : (r ? tx("K") + r.level + " · " + r.name : tx("Rolsüz")),
        roleBadgeStyle: "flex:none;font-size:11px;font-weight:800;padding:4px 8px;border-radius:999px;" + (tLvl === 1 ? "background:var(--pri,#2a3180);color:#fff" : u.status === "pending" ? "background:var(--warn);color:var(--warntext)" : "background:var(--soft3);color:var(--muted)"),
        editable,
        locked: !editable,
        lockNote: tLvl === 1 ? tx("Üst yönetici hesapları yalnızca sistem panelinden yönetilir.") : tLvl <= lvl ? tx("Kendi kademenizde veya üstünde bir hesapta işlem yapamazsınız.") : tx("Bu rol sizin yönetim kapsamınızda değil."),
        roleId: u.roleId,
        onRole: (e) => { const rid = e.target.value; app.act(() => app.api.put("/users/" + u.id + "/role", { roleId: rid }), u.name + tx(" rolü güncellendi.")); },
        onDelete: () => app.setState({ sheet: { type: "confirm", action: "delete", entity: "user", obj: { ...u, name: u.name } } }),
      };
    });
    Object.assign(c, { assignable, manageUsers });
  return () => {
    /*LATE*/
    return {
      manageUsers,
      userMgmtNote: top ? tx("Üst yönetici olarak tüm alt kademeleri yönetebilirsiniz; kendi kademenizdeki hesaplar yalnızca sistem panelinden değiştirilir.") : tx("Yalnızca rolünüzün kapsadığı alt kademelerde işlem yapabilirsiniz."),

    };
  };
}
