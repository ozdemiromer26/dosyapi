// Görünüm modeli: approvals
import type { Ctx, Vals } from "./types";
import { tx } from "../i18n";
/*IMPORTS*/

export function buildApprovals(c: Ctx): () => Vals {
  const app = c.app;
  const { me, s } = c; /*TOP*/
    const kindLabel = (k) => k === "user-approve" ? tx("KAYIT ONAYI") : k === "user-delete" ? tx("HESAP SİLME") : k === "create" ? tx("YENİ KAYIT") : k === "update" ? tx("DÜZENLEME") : tx("SİLME");
    const kindStyle = (k) => "font-size:11px;font-weight:800;letter-spacing:.5px;padding:4px 8px;border-radius:6px;" + (k === "delete" || k === "user-delete" ? "background:var(--err);color:var(--errtext)" : k === "user-approve" ? "background:var(--ok);color:var(--oktext)" : k === "create" ? "background:var(--tint);color:var(--brandink)" : "background:var(--soft3);color:var(--muted)");
    const statePill = (st) => "flex:none;font-size:11px;font-weight:800;padding:4px 9px;border-radius:999px;white-space:nowrap;" + (st === "ok" ? "background:var(--ok);color:var(--oktext)" : st === "wait" ? "background:var(--warn);color:var(--warntext)" : "background:var(--err);color:var(--errtext)");
    const pendings = s.pendings
      .map(p => {
        const mine = p.byId === (me && me.id);
        const decide = !!p.canDecide;
        return {
          ...p, mine,
          kindLabel: kindLabel(p.kind), kindStyle: kindStyle(p.kind),
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
    // Alınan: başkalarının talepleri. Gönderilen: benim bekleyen taleplerim + sonuçlananlar.
    const inbox = pendings.filter(p => !p.mine);
    const sent = pendings.filter(p => p.mine).map(p => ({
      id: p.id, kindLabel: p.kindLabel, kindStyle: p.kindStyle, when: p.when, title: p.title, detail: p.detail,
      stateLabel: tx("Onay bekleniyor"), stateStyle: statePill("wait"), waiting: true, who: "",
      onWithdraw: () => app.setState({ sheet: { type: "confirm", action: "withdraw", obj: p } }),
    })).concat((s.sentOutcomes || []).map(o => ({
      id: o.id, kindLabel: kindLabel(o.kind), kindStyle: kindStyle(o.kind), when: o.when, title: o.title, detail: o.detail,
      stateLabel: o.approved ? tx("Onaylandı") : tx("Reddedildi"), stateStyle: statePill(o.approved ? "ok" : "no"), waiting: false,
      who: o.decider + " · " + (o.approved ? tx("onayladı") : tx("reddetti")), onWithdraw: null,
    })));
    Object.assign(c, { pendings, inbox, sent });
  return () => {
    const { assignable, s, tabStyle, chip } = c; /*LATE*/
    const tab = s.apTab === "out" ? "out" : "in";
    const view = s.apView === "list" ? "list" : "card";
    const tabBadge = (on) => "min-width:18px;height:18px;padding:0 5px;border-radius:999px;font-size:11px;font-weight:800;line-height:18px;" + (on ? "background:var(--pri,#2a3180);color:#fff" : "background:var(--card);color:var(--muted)");
    return {
      pendings: inbox, noPendings: inbox.length === 0,
      sentList: sent, noSent: sent.length === 0,
      history: s.history, hasHistory: s.history.length > 0,
      assignableRoles: assignable,
      apIn: tab === "in", apOut: tab === "out",
      apTabs: [["in", tx("Alınan onaylar"), inbox.length], ["out", tx("Gönderilen onaylar"), sent.filter(x => x.waiting).length]].map(t => ({
        id: t[0], label: t[1], count: t[2], on: tab === t[0],
        style: tabStyle(tab === t[0]) + ";display:flex;align-items:center;gap:7px;justify-content:center", badgeStyle: tabBadge(tab === t[0]),
        onClick: () => app.setState({ apTab: t[0] }),
      })),
      apIsCard: view === "card", apIsList: view === "list", apNarrow: (c.contentW || 0) < 640,
      apCardStyle: chip(view === "card").replace("height:32px", "height:40px"),
      apListStyle: chip(view === "list").replace("height:32px", "height:40px"),
      apSetCard: () => app.setState({ apView: "card" }), apSetList: () => app.setState({ apView: "list" }),
      approvalsIntro: tab === "out"
        ? tx("Başlattığınız ve üst kademe onayına düşen talepler. Bekleyen bir talebi onaylanmadan geri çekebilirsiniz.")
        : tx("Rolünüzün onaylayabileceği talepler. Onay verdiğinizde değişiklik kayda işlenir; reddederseniz talep eden bilgilendirilir."),
    };
  };
}
