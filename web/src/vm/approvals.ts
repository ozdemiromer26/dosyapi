// Görünüm modeli: approvals
import type { Ctx, Vals } from "./types";
import { tx } from "../i18n";
/*IMPORTS*/

export function buildApprovals(c: Ctx): () => Vals {
  const app = c.app;
  const { me, s } = c; /*TOP*/
    const pendings = s.pendings
      .map(p => {
        const mine = p.byId === (me && me.id);
        const decide = !!p.canDecide;
        return {
          ...p,
          kindLabel: p.kind === "user-approve" ? tx("KAYIT ONAYI") : p.kind === "user-delete" ? tx("HESAP SİLME") : p.kind === "create" ? tx("YENİ KAYIT") : p.kind === "update" ? tx("DÜZENLEME") : tx("SİLME"),
          kindStyle: "font-size:11px;font-weight:800;letter-spacing:.5px;padding:4px 8px;border-radius:6px;" + (p.kind === "delete" || p.kind === "user-delete" ? "background:var(--err);color:var(--errtext)" : p.kind === "user-approve" ? "background:var(--ok);color:var(--oktext)" : p.kind === "create" ? "background:var(--tint);color:var(--brandink)" : "background:var(--soft3);color:var(--muted)"),
          needsRole: p.kind === "user-approve" && decide,
          canDecide: decide,
          waiting: !decide,
          waitLabel: mine ? tx("Üst kademe onayı bekleniyor") : tx("Bu talebi onaylama yetkiniz yok"),
          onRolePick: (e) => { const v = e.target.value; app.setState(st => ({ roleChoice: { ...(st.roleChoice || {}), [p.id]: v } })); },
          onApprove: () => {
            const opts = app.manageableRoles();
            const rid = p.kind === "user-approve" ? (s.roleChoice[p.id] || (opts[0] && opts[0].id)) : null;
            if (p.kind === "user-approve" && !rid) return app.toast(tx("Atanabilir rol yok."));
            app.act(() => app.api.post("/approvals/" + p.id + "/approve", { roleId: rid }), tx("Talep onaylandı."));
          },
          onReject: () => app.act(() => app.api.post("/approvals/" + p.id + "/reject", {}), tx("Talep reddedildi.")),
        };
      });
    Object.assign(c, { pendings });
  return () => {
    const { assignable, s } = c; /*LATE*/
    return {
      pendings, noPendings: pendings.length === 0,
      history: s.history, hasHistory: s.history.length > 0,
      assignableRoles: assignable,
      approvalsIntro: app.perm("approve") || app.perm("users") ? tx("Kayıt, düzenleme ve hesap taleplerini karara bağlayın.") : tx("Gönderdiğiniz talepler üst kademe onayı bekliyor."),

    };
  };
}
