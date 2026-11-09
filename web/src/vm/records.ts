// Görünüm modeli: records
import type { Ctx, Vals } from "./types";
import { ini } from "../domain/constants";
import { tx } from "../i18n";
/*IMPORTS*/

export function buildRecords(c: Ctx): () => Vals {
  const app = c.app;
  const { canWriteRecords, check, s } = c; /*TOP*/
    const projAuthorIds = s.projFilter ? ((s.projects.find(p => p.id === s.projFilter) || {}).authorIds || []) : null;
    const filteredAuthors = s.authors.filter(a => !projAuthorIds || projAuthorIds.indexOf(a.id) > -1);
    const lockedRecords = new Set(s.pendings.filter(p => (p.kind === "update" || p.kind === "delete") && (p.entity === "author" || p.entity === "contractor")).map(p => p.payload.id));
    const authorsList = filteredAuthors.map(a => {
      const on = s.selAuthors.indexOf(a.id) > -1;
      const pr = s.projects.filter(p => (p.authorIds || []).indexOf(a.id) > -1);
      return {
        ...a, fullName: a.first + " " + a.last, initials: ini(a.first + " " + a.last),
        canWrite: canWriteRecords && !lockedRecords.has(a.id),
        projectLabel: pr.length ? pr.length + tx(" projede") : tx("projesiz"),
        cardStyle: "background:var(--card);border-radius:13px;padding:14px;border:1px solid " + (on ? "var(--pri,#2a3180)" : "var(--line)"),
        checkStyle: check(on), checkMark: on ? "✓" : "",
        onSelect: () => app.setState(st => ({ selAuthors: on ? st.selAuthors.filter(x => x !== a.id) : [...st.selAuthors, a.id] })),
        sicilLabel: a.sicil ? tx("Sicil") + " " + a.sicil : "",
        onDoc: () => app.openGen("authors", { ids: [a.id], projectId: "" }, "tp3"),
        onEdit: () => { app.fd = {}; app.setState({ sheet: { type: "author" }, draft: { ...a } }); },
        onDelete: () => app.setState({ sheet: { type: "confirm", action: "delete", entity: "author", obj: a } }),
      };
    });

    const contractorsList = s.contractors.map(c => ({
      ...c, initials: ini(c.title), canWrite: canWriteRecords && !lockedRecords.has(c.id),
      onDoc: () => app.openGen("contractor", { contractorId: c.id }),
      onEdit: () => { app.fd = {}; app.setState({ sheet: { type: "contractor" }, draft: { ...c } }); },
      onDelete: () => app.setState({ sheet: { type: "confirm", action: "delete", entity: "contractor", obj: c } }),
    }));
    Object.assign(c, { projAuthorIds, filteredAuthors, authorsList, contractorsList });
  return () => {
    const { s, tabStyle } = c; /*LATE*/
    return {
      isAuthorsTab: s.recTab === "authors", isContractorsTab: s.recTab === "contractors",
      recAuthStyle: tabStyle(s.recTab === "authors"), recContStyle: tabStyle(s.recTab === "contractors"),
      recAuthors: () => app.setState({ recTab: "authors" }), recContractors: () => app.setState({ recTab: "contractors" }),
      authorsList, contractorsList,
      selCount: s.selAuthors.length,
      selectAllLabel: s.selAuthors.length === filteredAuthors.length && filteredAuthors.length > 0 ? tx("Seçimi temizle") : tx("Tümünü seç"),
      selectAllAuthors: () => app.setState(st => ({ selAuthors: st.selAuthors.length === filteredAuthors.length ? [] : filteredAuthors.map(a => a.id) })),
      printAuthors: () => {
        const ids = s.authors.filter(a => s.selAuthors.indexOf(a.id) > -1).map(a => a.id);
        if (!ids.length) return app.toast(tx("Belge için müellif seçin."));
        app.openGen("authors", { ids, projectId: s.projFilter || "" }, "tp2");
      },
      newAuthor: () => { app.fd = {}; app.setState({ sheet: { type: "author" }, draft: {} }); },
      newContractor: () => { app.fd = {}; app.setState({ sheet: { type: "contractor" }, draft: {} }); },
      professionOptions: s.professions.map(p => ({ name: p })),
      contractorOptions: s.contractors.map(c => ({ id: c.id, title: c.title })),

    };
  };
}
