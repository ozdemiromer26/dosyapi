// Görünüm modeli: projects
import type { Ctx, Vals } from "./types";
import { STATUSES, STATUS_LABEL } from "../domain/constants";
import { tx } from "../i18n";
/*IMPORTS*/

export function buildProjects(c: Ctx): () => Vals {
  const app = c.app;
  const { badge, canWriteProjects, s } = c; /*TOP*/
    const lockedProjectIds = new Set(s.pendings.filter(p => p.entity === "project").map(p => p.payload.id));
    const authorName = (id) => { const a = s.authors.find(x => x.id === id); return a ? a.first + " " + a.last : ""; };
    const docState = (p) => { const req = s.docTypes.filter(d => d.required); const have = req.filter(d => (p.docs || {})[d.id]).length; return have + "/" + req.length; };

    const statusOf = (p) => p.status || (p.done ? "iskan" : "uygulama");
    const missingDocs = (p) => s.docTypes.filter(d => d.required && !(p.docs || {})[d.id]);

    const decorate = (p) => ({
      ...p,
      status: statusOf(p),
      statusLabel: STATUS_LABEL(statusOf(p)),
      badgeStyle: badge(p.done),
      docLabel: docState(p),
      docMissing: missingDocs(p).length,
      hasDocWarn: missingDocs(p).length > 0,
      docWarn: missingDocs(p).length ? tx("Bekleyen belge: ") + missingDocs(p).map(d => d.name).join(", ") : "",
      locationLabel: [p.mahalle, p.street].filter(Boolean).join(" · ") || tx("Adres girilmedi"),
      locked: lockedProjectIds.has(p.id),
      canWrite: canWriteProjects,
      authorChips: (p.authorIds || []).map(id => { const a = s.authors.find(x => x.id === id); return a ? { id, label: a.first + " " + a.last, job: a.job } : null; }).filter(Boolean),
      noAuthors: !(p.authorIds || []).some(id => s.authors.some(x => x.id === id)),
      authorMiss: app.authorMiss(p).length ? tx("Eksik müellif: ") + app.authorMiss(p).join(", ") : "", hasAuthorMiss: app.authorMiss(p).length > 0,
      missingList: missingDocs(p).map(d => ({ id: d.id, name: d.name })),
      onOpen: () => app.setState({ tab: "detail", projectId: p.id }),
      onEdit: () => { app.fd = {}; app.setState({ sheet: { type: "project" }, draft: { ...p } }); },
      onDoc: () => app.openGen("project", { projectId: p.id }),
      onDelete: () => app.setState({ sheet: { type: "confirm", action: "delete", entity: "project", obj: p } }),
    });

    const q = s.q.trim().toLowerCase();
    const allProjects = s.projects.map(decorate);
    const inFilter = (p, f) => f === "all" ? true : f === "active" ? !p.done : f === "done" ? !!p.done : f === "missing" ? !p.done && p.docMissing > 0 : statusOf(p) === f;
    const selFilters = (s.filters && s.filters.length) ? s.filters : ["all"];
    const matchFilters = (p) => selFilters.indexOf("all") > -1 ? true : selFilters.some(f => inFilter(p, f));
    const visibleProjects = allProjects.filter(p => matchFilters(p) && (!q || p.name.toLowerCase().includes(q) || p.contractor.toLowerCase().includes(q) || (p.mahalle || "").toLowerCase().includes(q) || (p.street || "").toLowerCase().includes(q)));
    const filterDefs = [["all", tx("Tümü")]].concat(STATUSES);
    const filterOptions = filterDefs.map(f => {
      const on = selFilters.indexOf(f[0]) > -1;
      return {
        id: f[0], label: tx(f[1]), count: allProjects.filter(p => inFilter(p, f[0])).length,
        mark: on ? "✓" : "",
        boxStyle: "width:18px;height:18px;flex:none;border-radius:5px;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;" + (on ? "background:var(--pri,#2a3180);color:#fff;border:1px solid var(--pri,#2a3180)" : "background:var(--card);color:transparent;border:1px solid var(--line)"),
        rowStyle: "width:100%;display:flex;align-items:center;gap:9px;height:36px;padding:0 9px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;text-align:left;" + (on ? "background:var(--tint);color:var(--brandink)" : "background:transparent;color:var(--ink)"),
        onToggle: () => app.setState(st => {
          if (f[0] === "all") return { filters: ["all"] };
          const cur = (st.filters || []).filter(x => x !== "all");
          const next = cur.indexOf(f[0]) > -1 ? cur.filter(x => x !== f[0]) : [...cur, f[0]];
          return { filters: next.length ? next : ["all"] };
        }),
      };
    });
    const docPending = allProjects.filter(p => !p.done && p.docMissing > 0);

    const cur = s.projects.find(p => p.id === s.projectId) || null;
    const curD = cur ? decorate(cur) : {};
    Object.assign(c, { lockedProjectIds, authorName, docState, statusOf, missingDocs, decorate, q, allProjects, inFilter, selFilters, matchFilters, visibleProjects, filterDefs, filterOptions, docPending, cur, curD });
  return () => {
    const { canWriteRecords, chip, pm, s } = c; /*LATE*/
    return {
      visibleProjects, noProjects: visibleProjects.length === 0,
      canWriteProjects, canWriteRecords, canUploadFiles: app.perm("files"),
      filterOptions,
      statusOptions: STATUSES.map(x => ({ id: x[0], label: tx(x[1]) })),
      filterMenuOpen: s.filterMenuOpen,
      toggleFilterMenu: () => app.setState(st => ({ filterMenuOpen: !st.filterMenuOpen })),
      closeFilterMenu: () => app.setState({ filterMenuOpen: false }),
      activeFilterLabel: selFilters.indexOf("all") > -1 ? tx("Tüm durumlar") : selFilters.length === 1 ? tx((filterDefs.find(f => f[0] === selFilters[0]) || { active: ["", "Devam eden"], done: ["", "Tamamlanan"], missing: ["", "Eksik belgeli"] }[selFilters[0]] || ["", "Tümü"])[1]) : selFilters.length + tx(" durum seçili"),
      isCardView: s.projView === "card", isListView: s.projView === "list",
      cardViewStyle: chip(s.projView === "card").replace("height:32px", "height:42px"),
      listViewStyle: chip(s.projView === "list").replace("height:32px", "height:42px"),
      setCardView: () => app.setState({ projView: "card" }), setListView: () => app.setState({ projView: "list" }),
      docPendingList: docPending.slice(0, 4), hasDocPending: docPending.length > 0, noDocPending: docPending.length === 0,
      permNotice: pm === "approve" ? tx("Rolünüz onaylı düzenleme: eklediğiniz, değiştirdiğiniz ve sildiğiniz kayıtlar üst kademe onayına düşer.") : pm === "read" ? tx("Rolünüz salt okuma yetkisine sahip.") : "",
      newProject: () => { app.fd = {}; app.setState({ sheet: { type: "project" }, draft: { done: false } }); },

    };
  };
}
