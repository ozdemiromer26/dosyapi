// Görünüm modeli: shell
import type { Ctx, Vals } from "./types";
import { TPL } from "../i18n/strings";
import { LOC, tx } from "../i18n";
import { DMARK, DMARK_LIGHT, ICONS, L, MOON, SUN, el, ic } from "../ui/icons";
import { ini } from "../domain/constants";
/*IMPORTS*/

export function buildShell(c: Ctx): () => Vals {
  const app = c.app;
  const { me, navStyle, pendings, pm, rm, s } = c; /*TOP*/
    const sh = s.sheet || {};
    const sheetTitles = { people: tx("Arsa sahipleri & vekiller"), project: s.draft && s.draft.id ? tx("Projeyi Düzenle") : tx("Yeni Proje"), author: s.draft && s.draft.id ? tx("Müellifi Düzenle") : tx("Yeni Müellif"), contractor: s.draft && s.draft.id ? tx("Müteahhidi Düzenle") : tx("Yeni Müteahhit"), doc: sh.title, confirm: tx("Onay gerekiyor"), menu: tx("Menü"), mail: tx("Tek kullanımlık bağlantı"), notice: tx("Aydınlatma metni"), tplLeave: tx("Kaydedilmemiş değişiklikler") };

    const isDesktop = s.vw >= 880;
    const contentW = Math.min(s.vw - (isDesktop ? 240 : 0), 1440) - 32;
    const cardCols = Math.max(1, Math.min(4, Math.floor((contentW + 13) / 293)));
    const listWide = contentW >= 860;
    // Başlık ve satırlar aynı ızgarayı paylaşır (subgrid); sütunlar içerikten bağımsız hizalı kalır.
    const LIST_COLS = listWide
      ? "grid-template-columns:minmax(0,2.1fr) minmax(84px,.7fr) minmax(150px,1fr) minmax(0,1.5fr) minmax(0,1.3fr) auto;column-gap:16px;"
      : "grid-template-columns:minmax(0,1fr) auto;column-gap:12px;";
    const LIST_ROW = "display:grid;grid-template-columns:subgrid;grid-column:1 / -1;";
    const domains = s.domains || [];
    const domOf = (e) => ((e || "").split("@")[1] || "").toLowerCase();
    const domainConflicts = domains.length ? s.users.filter(u => domains.indexOf(domOf(u.email)) === -1).map(u => ({ id: u.id, name: u.name, email: u.email })) : [];
    const domainsTxt = domains.map(d => "@" + d).join(", ");
    const decidable = pendings.filter(p => p.canDecide).length;
    const navDefs: any[] = [
      ["home", tx("Özet"), true], ["projects", tx("Projeler"), pm !== "none"], ["tasks", tx("Görevler"), true], ["messages", tx("Mesajlar"), true],
      ["records", tx("Kayıtlar"), rm !== "none"], ["approvals", tx("Onaylar"), true], ["profile", tx("Profil"), true],
      ["templates", tx("Belge Şablonları"), app.perm("templates")],
      ["company", tx("Şirket Ayarları"), app.perm("company")],
      ["about", tx("Hakkında"), true],
    ];
    const sideStyle = (on) => "width:100%;display:flex;align-items:center;gap:10px;height:40px;padding:0 11px;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;text-align:left;border:1px solid transparent;" + (on ? "background:var(--tint);color:var(--brandink);border:1px solid var(--tintline)" : "background:transparent;color:var(--muted)");
    const botStyle = (on) => "flex:1;min-width:0;height:54px;border:none;background:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;padding:0;color:" + (on ? "var(--brandink)" : "var(--muted)");
    const mkNav = (n: any): any => {
      const on = s.tab === n[0] || (n[0] === "projects" && s.tab === "detail");
      const unread = s.unreadMessages || 0;
      const badgeTxt = n[0] === "approvals" && decidable ? String(decidable) : n[0] === "messages" && unread ? String(unread) : "";
      return {
        id: n[0], label: n[1], icon: ICONS[n[0]](), hasBadge: !!badgeTxt, badgeText: badgeTxt,
        badgeStyle: "margin-left:auto;font-size:11px;font-weight:800;padding:2px 7px;border-radius:999px;background:var(--pri,#2a3180);color:#fff",
        style: navStyle(on), sideStyle: sideStyle(on), botStyle: botStyle(on),
        onClick: () => app.setState({ tab: n[0], notifOpen: false, sheet: null }),
      };
    };
    const navItems = navDefs.filter(n => n[2]).map(mkNav);
    const navNoProf = navItems.filter(n => n.id !== "profile"), profOn = s.tab === "profile";
    // Alt çubukta 4 sekme + Profil. "Daha fazla" kalktı: Profil, profil önizlemesi ve
    // kalan sayfaları (Kayıtlar, Onaylar…) içeren menüyü açar; rozeti bu sayfaların toplamıdır.
    const BOTTOM = 4;
    const moreBadge = navNoProf.slice(BOTTOM).reduce((n, x) => n + (Number(x.badgeText) || 0), 0);
    const moreOn = profOn || navNoProf.slice(BOTTOM).some(n => n.id === s.tab);
    const bottomNav = navNoProf.slice(0, BOTTOM).concat(<any>[{
      id: "profile", label: tx("Profil"), botStyle: botStyle(moreOn), hasBadge: moreBadge > 0, badgeText: String(moreBadge),
      icon: el("span", { style: { width: 24, height: 24, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, background: moreOn ? "var(--pri,#2a3180)" : "var(--soft3)", color: moreOn ? "#fff" : "var(--brandink)" } }, me ? ini(me.name) : ""),
      onClick: () => app.setState({ sheet: { type: "menu" }, notifOpen: false, profileMenuOpen: false }),
    }]);
    const menuItems = navNoProf.slice(BOTTOM);

    const goList = (filters) => () => app.setState({ tab: "projects", filters, notifOpen: false });
    // accent: "pri" dolu marka rengi; "alert" açık kırmızı zemin + kırmızı yazı.
    // Uyarı kartı dolu değil: şirket rengi kırmızı olsa da birbirine karışmaz.
    const statCard = (label, value, onClick, accent?: "pri" | "alert") => ({
      label, value, onClick,
      cardStyle: "width:100%;text-align:left;cursor:pointer;border-radius:13px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.05);" + (accent === "pri" ? "background:var(--pri,#2a3180);border:1px solid var(--pri,#2a3180)" : accent === "alert" ? "background:var(--err);border:1px solid var(--errtext)" : "background:var(--card);border:1px solid var(--line)"),
      labelStyle: "font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:" + (accent === "pri" ? "rgba(255,255,255,.82)" : accent === "alert" ? "var(--errtext)" : "var(--muted)"),
      valueStyle: "font-size:26px;font-weight:800;line-height:1;margin-top:6px;color:" + (accent === "pri" ? "#fff" : accent === "alert" ? "var(--errtext)" : "var(--ink)"),
    });
    Object.assign(c, { sh, sheetTitles, isDesktop, contentW, cardCols, listWide, LIST_COLS, domains, domOf, domainConflicts, domainsTxt, decidable, navDefs, sideStyle, botStyle, mkNav, navItems, navNoProf, profOn, bottomNav, menuItems, statCard });
  return () => {
    const { allProjects, assignedOverdue, check, docPending, lvl, me, myTasks, pendings, s, top } = c; /*LATE*/
    const openMine = myTasks.filter(t => !t.done);
    // Süresi geçenler önce ve ayrı bölümde; atadığım görevlerin gecikenleri de bildirilir.
    const lateTasks = openMine.filter(t => t.isOverdue).concat(assignedOverdue);
    const notifCount = decidable + openMine.length + assignedOverdue.length + docPending.length;
    return {
      companyName: s.company.name, companyDesc: s.company.desc, companyMonogram: ini(s.company.name),
      screenTitle: { home: tx("Özet"), projects: tx("Projeler"), detail: tx("Proje detayı"), tasks: tx("Görevler ve yapılacaklar"), messages: tx("Mesajlar"), records: tx("Kayıtlar"), approvals: tx("Onay kuyruğu"), profile: tx("Profil"), company: tx("Şirket ayarları"), templates: tx("Belge şablonları"), about: tx("Hakkında") }[s.tab],
      meName: me ? me.name : "", meEmail: me ? me.email : "", meInitials: me ? ini(me.name) : "",
      meFirstName: me ? me.name.split(" ")[0] : "",
      meRoleLabel: app.myRole() ? app.myRole().name : tx("Rolsüz"),
      meLevel: lvl,
      meRoleBadgeStyle: "display:inline-block;margin-top:7px;font-size:11px;font-weight:800;padding:4px 8px;border-radius:999px;" + (top ? "background:var(--pri,#2a3180);color:#fff" : "background:var(--soft3);color:var(--muted)"),
      todayLabel: new Date().toLocaleDateString(LOC(), { day: "numeric", month: "long", year: "numeric" }),
      badgeCount: notifCount || "",
      navItems, bottomNav, menuItems,
      isDesktop, isMobile: !isDesktop,
      T: Object.keys(TPL).reduce((o, k) => (o[k] = tx(TPL[k]), o), {}),
      lang: s.lang, langLabel: s.lang === "en" ? "EN" : "TR",
      toggleLang: () => app.setState({ lang: app.state.lang === "en" ? "tr" : "en" }),
      langBtnStyle: "height:36px;min-width:40px;padding:0 10px;flex:none;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--muted);font-size:12px;font-weight:800;letter-spacing:.6px;cursor:pointer",
      langBtnStyleM: "height:36px;min-width:40px;padding:0 10px;flex:none;border-radius:9px;border:1px solid var(--mline2);background:var(--mbtn);color:var(--mtext);font-size:12px;font-weight:800;letter-spacing:.6px;cursor:pointer",
      themeIcon: s.theme === "dark" ? SUN() : MOON(),
      brandMarkXs: DMARK(16), brandMarkLight: DMARK_LIGHT(24), brandMarkAbout: DMARK_LIGHT(46),
      brandTap: () => { const now = Date.now(); app._bt = (app._bt || []).filter(t => now - t < 2000).concat(now); if (app._bt.length >= 5) { app._bt = []; app.fd = {}; app.setState({ mode: "master", masterError: "" }); } },
      bellIcon: ICONS.bell(), profileIcon: ICONS.profile(),
      logoutIcon: ic(["path", { d: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" }], ["path", { d: "M10 16l-4-4 4-4" }], L(6, 12, 16, 12)),
      themeIconBtnStyle: "width:36px;height:36px;flex:none;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer",
      themeIconBtnStyleM: "width:36px;height:36px;flex:none;border-radius:9px;border:1px solid var(--mline2);background:var(--mbtn);color:var(--mtext);display:flex;align-items:center;justify-content:center;cursor:pointer",
      theme: s.theme, rootRef: app.rootRef(), vwDebug: String(s.vw),
      toggleTheme: () => app.setState(st => ({ theme: st.theme === "dark" ? "light" : "dark" })),
      remember: s.remember,
      rememberMark: s.remember ? "✓" : "",
      rememberCheckStyle: check(s.remember).replace("width:24px;height:24px", "width:20px;height:20px"),
      toggleRemember: () => app.setState(st => ({ remember: !st.remember })),
      profileMenuOpen: s.profileMenuOpen,
      toggleProfileMenu: () => app.setState(st => ({ profileMenuOpen: !st.profileMenuOpen, notifOpen: false })),
      myOpenTaskLabel: myTasks.filter(t => !t.done).length + tx(" açık görev"),
      appShellStyle: isDesktop ? "flex:1;display:flex;align-items:flex-start" : "flex:1;display:flex;flex-direction:column",
      // Mesajlar ekranı tam yükseklik kullanır: alt boşluk masaüstünde 16px, mobilde alt çubuğun hemen üstü.
      contentStyle: "flex:1;width:100%;margin:0 auto;padding:20px 16px " + (s.tab === "messages" ? (isDesktop ? "16px" : "80px") : (isDesktop ? "70px" : "96px")) + ";max-width:1440px",
      cardGridStyle: "display:grid;grid-template-columns:repeat(" + cardCols + ",minmax(0,1fr));gap:13px;align-items:stretch",
      listWide, listNarrow: !listWide,
      listBoxStyle: "display:grid;" + LIST_COLS + "background:var(--card);border:1px solid var(--line);border-radius:13px;overflow:hidden",
      listHeadStyle: LIST_ROW + "padding:10px 16px;background:var(--soft2);border-bottom:1px solid var(--line2);font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.4px",
      listRowStyle: LIST_ROW + "align-items:start;row-gap:12px;padding:14px 16px;border-bottom:1px solid var(--line2)",
      listMoreStyle: "grid-column:1 / -1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px",
      listActStyle: listWide ? "display:flex;gap:6px;justify-content:flex-end" : "grid-column:1 / -1;display:flex;gap:6px",
      hasLogo: !!s.company.logoUrl, noLogo: !s.company.logoUrl, logoUrl: s.company.logoUrl || "",
      notifOpen: s.notifOpen,
      toggleNotif: () => app.setState(st => ({ notifOpen: !st.notifOpen, profileMenuOpen: false })),
      closeNotif: () => app.setState({ notifOpen: false }),
      notifApprovals: pendings.filter(p => p.canDecide).slice(0, 4).map(p => ({ id: p.id, title: p.title, meta: p.kindLabel + " · " + p.when })),
      notifLate: lateTasks.slice(0, 4).map(t => ({ id: t.id, title: t.title, meta: tx("Termin ") + t.dueDateLabel + (t.assignee !== (me && me.id) ? " · " + tx("atanan ") + t.assigneeLabel : "") })),
      hasNotifLate: lateTasks.length > 0,
      notifTasks: openMine.filter(t => !t.isOverdue).slice(0, 4).map(t => ({ id: t.id, title: t.title, meta: tx("Termin ") + t.dueLabel })),
      notifDocs: docPending.slice(0, 4).map(p => ({ id: p.id, title: p.name, meta: p.docMissing + tx(" zorunlu belge bekliyor"), onOpen: () => app.setState({ tab: "detail", projectId: p.id, notifOpen: false }) })),
      hasNotifApprovals: decidable > 0,
      hasNotifTasks: openMine.some(t => !t.isOverdue),
      hasNotifDocs: docPending.length > 0,
      noNotif: notifCount === 0,
      isHome: s.tab === "home", isProjects: s.tab === "projects", isDetail: s.tab === "detail",
      isTasks: s.tab === "tasks", isRecords: s.tab === "records", isApprovals: s.tab === "approvals",
      isProfile: s.tab === "profile", isCompany: s.tab === "company", isAbout: s.tab === "about", isMessages: s.tab === "messages",
      msg: {
        meId: me && me.id,
        wide: (c.contentW || 0) >= 720,
        // Masaüstü dışında altta sabit gezinme çubuğu var; yükseklik ondan düşülür.
        bottomBar: !isDesktop,
        users: s.users.filter(u => u.status === "active" && u.id !== (me && me.id)).map(u => ({ id: u.id, name: u.name, role: (app.roleOf(u) || {}).name || "" })),
        nameOf: (id) => (s.users.find(u => u.id === id) || {}).name || tx("Silinmiş kullanıcı"),
        list: () => app.api.get("/messages"),
        thread: (id, before) => app.api.get("/messages/" + id + (before ? "?before=" + before : "")),
        send: (to, body) => app.api.post("/messages", { to, body }),
        refreshUnread: () => app.refreshUnread(),
        fail: (e) => app.fail(e),
      },
      goProjects: () => app.setState({ tab: "projects" }),
      goTasks: () => app.setState({ tab: "tasks", notifOpen: false }), goApprovals: () => app.setState({ tab: "approvals" }),
      goProfile: () => app.setState({ tab: "profile", profileMenuOpen: false }),

      stats: (() => {
        const missing = s.projects.filter(p => !p.done).reduce((n, p) => n + s.docTypes.filter(d => d.required && !(p.docs || {})[d.id]).length, 0);
        return [
          statCard(tx("Bekleyen onay"), pendings.length, () => app.setState({ tab: "approvals" }), "pri"),
          // Eksik belge yoksa kırmızı alarm vermez, sıradan kart olur.
          statCard(tx("Eksik zorunlu belge"), missing, goList(["missing"]), missing > 0 ? "alert" : undefined),
          statCard(tx("Toplam proje"), s.projects.length, goList(["all"])),
          statCard(tx("Devam eden"), s.projects.filter(p => !p.done).length, goList(["active"])),
          statCard(tx("Tamamlanan"), s.projects.filter(p => p.done).length, goList(["done"])),
          statCard(tx("Açık görev"), s.tasks.filter(t => !t.done).length, () => app.setState({ tab: "tasks" })),
        ];
      })(),
      recentProjects: allProjects.slice(0, 3),
      // Süresi geçenler önizlemede başta.
      myTasksPreview: openMine.slice().sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue)).slice(0, 3),
      noMyTasks: myTasks.length === 0,

    };
  };
}
