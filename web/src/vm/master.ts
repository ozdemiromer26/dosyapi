// Görünüm modeli: master
import type { Ctx, Vals } from "./types";
import { tx } from "../i18n";
import { FLAGS, MSECTIONS, PROJ_OPTS, ini } from "../domain/constants";
/*IMPORTS*/

export function buildMaster(c: Ctx): () => Vals {
  const app = c.app;
  const { s } = c; /*TOP*/
    const ddRow = (on, label, fn) => ({
      label, mark: on ? "✓" : "", onToggle: fn,
      boxStyle: "width:18px;height:18px;flex:none;border-radius:5px;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;" + (on ? "background:var(--pri,#2a3180);color:#fff;border:1px solid var(--pri,#2a3180)" : "background:var(--minput);color:transparent;border:1px solid var(--mline2)"),
      rowStyle: "width:100%;display:flex;align-items:center;gap:9px;height:36px;padding:0 9px;border:none;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer;text-align:left;" + (on ? "background:var(--tint);color:var(--brandink)" : "background:transparent;color:var(--mink)"),
    });
    const mRoles = s.roles.slice().sort((a, b) => a.level - b.level).map(r => ({
      ...r,
      isTop: r.level === 1, editable: r.level !== 1, deletable: r.level !== 1,
      lvlStyle: "flex:none;font-size:11px;font-weight:800;padding:5px 8px;border-radius:6px;" + (r.level === 1 ? "background:#0E1B3D;color:#fff" : "background:var(--mchip);color:var(--mchiptext)"),
      onName: (e) => app.saveRole(r, { name: e.target.value }),
      onDelete: () => {
        if (s.users.some(u => u.roleId === r.id)) return app.toast(tx("Bu rolde kullanıcı var, önce rolleri değiştirin."));
        app.act(() => app.api.del("/master/roles/" + r.id), tx("Rol silindi."));
      },
      projVal: r.perms.projects, recVal: r.perms.records,
      onProj: (e) => app.saveRole(r, { perms: { ...r.perms, projects: e.target.value } }),
      onRec: (e) => app.saveRole(r, { perms: { ...r.perms, records: e.target.value } }),
      flagsOpen: s.dd === r.id + ":flags",
      onFlagsToggle: () => app.setState(st => ({ dd: st.dd === r.id + ":flags" ? null : r.id + ":flags" })),
      flagsSummary: FLAGS.filter(f => r.perms[f[0]]).map(f => tx(f[1])).join(", ") || tx("Seçim yok"),
      flags: FLAGS.map(f => ddRow(!!r.perms[f[0]], tx(f[1]), () => app.saveRole(r, { perms: { ...r.perms, [f[0]]: !r.perms[f[0]] } }))),
      manageOpen: s.dd === r.id + ":manage",
      onManageToggle: () => { if (!s.roles.some(x => x.level > r.level)) return; app.setState(st => ({ dd: st.dd === r.id + ":manage" ? null : r.id + ":manage" })); },
      manageSummary: !s.roles.some(x => x.level > r.level) ? tx("Alt rol yok") : (s.roles.filter(x => r.perms.manage.indexOf(x.id) > -1).sort((a, b) => a.level - b.level).map(x => tx("K") + x.level + " " + x.name).join(", ") || tx("Seçim yok")),
      manageOpts: s.roles.filter(x => x.level > r.level).sort((a, b) => a.level - b.level).map(x => ddRow(r.perms.manage.indexOf(x.id) > -1, tx("K") + x.level + " " + x.name,
        () => app.saveRole(r, { perms: { ...r.perms, manage: r.perms.manage.indexOf(x.id) > -1 ? r.perms.manage.filter(z => z !== x.id) : [...r.perms.manage, x.id] } }))),
    }));

    const mUsers = s.users.map(u => {
      const r = app.roleOf(u);
      const pickRoleId = (s.roleChoice || {})[u.id] || u.roleId || ((s.roles.slice().sort((a, b) => a.level - b.level).filter(x => x.level > 1)[0] || s.roles[0] || {}).id) || "";
      return {
        ...u, initials: ini(u.name), roleId: u.roleId, pickRoleId,
        statusLabel: u.status === "pending" ? tx("Onay bekliyor") : (r ? tx("K") + r.level : tx("Rolsüz")),
        statusStyle: "flex:none;font-size:11px;font-weight:800;padding:4px 8px;border-radius:999px;" + (u.status === "pending" ? "background:var(--mwarn);color:var(--mwarntext)" : "background:var(--mchip);color:var(--mchiptext)"),
        onRole: (e) => {
          const v = e.target.value;
          if (u.status === "pending") return app.setState(st => ({ roleChoice: { ...(st.roleChoice || {}), [u.id]: v } }));
          app.act(() => app.api.put("/master/users/" + u.id + "/role", { roleId: v }), tx("Rol güncellendi."));
        },
        isPending: u.status === "pending",
        onApprove: () => app.act(() => app.api.put("/master/users/" + u.id + "/role", { roleId: pickRoleId }), u.name + tx(" onaylandı ve hesabı etkinleştirildi.")),
        onSendLink: () => app.issueLink(u),
        delLabel: s.mConfirm === "del:" + u.id ? tx("Emin misiniz? Sil") : tx("Sil"),
        onDelete: () => {
          if (s.mConfirm !== "del:" + u.id) { clearTimeout(app._mct); app._mct = setTimeout(() => app.setState({ mConfirm: null }), 4000); return app.setState({ mConfirm: "del:" + u.id }); }
          app.setState({ mConfirm: null });
          app.act(() => app.api.del("/master/users/" + u.id), u.name + tx(" silindi."));
        },
      };
    });
    Object.assign(c, { ddRow, mRoles, mUsers });
  return () => {
    const { domains, domainsTxt, fxAllKeys, fxRows, isDesktop, s } = c; /*LATE*/
    return {
      domainList: domains.map(d => ({ name: d, onDelete: () => app.act(() => app.api.del("/master/domains/" + encodeURIComponent(d))) })),
      noDomains: !domains.length,
      refDomName: app.mkRef("domName"),
      addDomain: () => {
        const v = (app.fd.domName || "").trim().toLowerCase().replace(/^@+/, "");
        app.clearFields("domName");
        app.act(() => app.api.post("/master/domains", { domain: v }), "@" + v + tx(" eklendi."));
      },
      toggleDomainLock: () => {
        const on = !s.domainLock;
        app.act(() => app.api.put("/master/domain-lock", { on }), on ? tx("Alan adı kısıtlaması açıldı.") : tx("Alan adı kısıtlaması kapatıldı."));
      },
      domainTrackStyle: "width:44px;height:24px;flex:none;border-radius:999px;padding:3px;display:flex;align-items:center;transition:background .18s ease;" + (s.domainLock ? "justify-content:flex-end;background:var(--pri,#2a3180);border:1px solid var(--pri,#2a3180)" : "justify-content:flex-start;background:var(--mchip);border:1px solid var(--mline2)"),
      domainKnobStyle: "width:18px;height:18px;border-radius:50%;display:block;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.28)",
      hasDomainConflicts: !s.domainLock && (s.domainConflicts || []).length > 0,
      domainConflicts: s.domainConflicts || [],
      domainConflictTitle: (s.domainConflicts || []).length + tx(" hesap listede olmayan alan adı kullanıyor — kısıtlama açılamaz."),
      domainActiveNote: s.domainLock && domains.length ? tx("Kısıtlama açık: yalnızca şu alan adlarıyla kayıt olunabilir: ") + domainsTxt : "",
      domainHint: s.domainLock && domains.length ? tx("Yalnızca şu uzantılı e-postalarla kayıt olunabilir: ") + domainsTxt : "",
      closeMaster: () => app.closeMaster(),
      masterLocked: !s.masterAuthed, masterAuthed: s.masterAuthed, masterError: s.masterError,
      masterLogin: () => app.masterLogin(),
      saveMasterPass: () => {
        if (!app.fd.mNew || app.fd.mNew !== app.fd.mNew2) return app.toast(tx("Yeni şifre ile onayı aynı değil."));
        const body = { oldPassword: app.fd.mOld || "", newPassword: app.fd.mNew };
        app.clearFields("mOld", "mNew", "mNew2");
        app.api.post("/master/password", body).then(() => { app.toast(tx("Master şifre güncellendi.")); app.closeMaster(); }, (e) => app.fail(e));
      },
      saveCompanyMaster: () => app.act(() => app.api.put("/master/identity", { name: app.fd.cName ?? s.company.name, desc: app.fd.cDesc ?? s.company.desc, pri: s.palette.pri }), tx("Şirket kimliği güncellendi.")),
      onPriColor: (e) => { const v = e.target.value; app.setState(st => ({ palette: { ...st.palette, pri: v } })); },
      onLogoFile: (e) => {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        app.act(() => app.api.raw("PUT", "/master/logo", f), tx("Logo yüklendi: ") + f.name);
      },
      logoLabel: s.company.logoUrl ? tx("Logoyu değiştir") : tx("Logo yükle (PNG/JPEG/WEBP)"),
      mRoles, mUsers,
      addRole: () => {
        const name = (app.fd.rName || "").trim(), level = parseInt(app.fd.rLevel, 10);
        if (!name || !level || level < 2) return app.toast(tx("Rol adı ve 2 veya üzeri kademe girin."));
        app.clearFields("rName", "rLevel");
        app.act(() => app.api.post("/master/roles", { name, level, perms: { projects: "read", records: "none", company: false, users: false, approve: false, tasks: false, files: false, templates: false, manage: [] } }), tx("Rol eklendi."));
      },
      addUserMaster: () => {
        const name = (app.fd.nuName || "").trim(), email = (app.fd.nuEmail || "").trim().toLowerCase();
        if (!name || !email) return app.toast(tx("Ad ve e-posta zorunlu."));
        const roleId = app.fd.nuRole || (s.roles[0] && s.roles[0].id);
        app.clearFields("nuName", "nuEmail");
        app.addUser({ name, email, roleId });
      },
      onServerSearch: (e) => app.setState({ fileQ: e.target.value }),
      fxRows, noServerFiles: fxRows.length === 0, closeDD: () => app.setState({ dd: null }),
      projOptList: PROJ_OPTS.map(o => ({ id: o[0], label: tx(o[1]) })),
      fxExpandAll: () => app.setState({ fxOpen: fxAllKeys.reduce((o, k) => (o[k] = true, o), {}) }),
      fxCollapseAll: () => app.setState({ fxOpen: fxAllKeys.reduce((o, k) => (o[k] = false, o), {}) }),
      checkUpdate: () => app.checkUpdate(),
      factoryReset: () => app.setState({ sheet: { type: "factoryReset" } }),

      masterMenu: MSECTIONS.map(m => ({
        label: tx(m[1]), onClick: () => { app.setState({ mSection: m[0] }); app.loadSection(m[0]); },
        style: (isDesktop ? "width:100%;" : "flex:none;") + "display:flex;align-items:center;height:40px;padding:0 12px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;text-align:left;" + (s.mSection === m[0] ? "background:var(--pri,#2a3180);color:#fff;border:1px solid var(--pri,#2a3180)" : "background:var(--mbtn);color:var(--mmuted);border:1px solid var(--mline2)"),
      })),
      masterLayoutStyle: "max-width:1180px;margin:0 auto;padding:22px 16px;display:flex;gap:18px;align-items:flex-start;" + (isDesktop ? "" : "flex-direction:column;align-items:stretch"),
      masterMenuStyle: isDesktop ? "width:212px;flex:none;display:flex;flex-direction:column;gap:5px;position:sticky;top:86px" : "width:100%;display:flex;gap:6px;overflow-x:auto;padding-bottom:2px",
      mIsKimlik: s.mSection === "kimlik", mIsRoller: s.mSection === "roller", mIsKullanicilar: s.mSection === "kullanicilar",
      mIsProjeler: s.mSection === "projeler", mIsSistem: s.mSection === "sistem", mIsDns: s.mSection === "dns", mIsEposta: s.mSection === "eposta", mIsGuvenlik: s.mSection === "guvenlik", mIsHakkinda: s.mSection === "hakkinda",

    };
  };
}
