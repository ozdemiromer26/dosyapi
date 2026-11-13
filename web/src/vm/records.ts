// Görünüm modeli: records
import type { Ctx, Vals } from "./types";
import { ini } from "../domain/constants";
import { tx } from "../i18n";
import { ADD_OPTION } from "../domain/constants";
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

    // Müteahhitler müelliflerle aynı düzende: seçim, tümünü seç, seçililerle belge.
    const projContractorId = s.projFilter ? ((s.projects.find(p => p.id === s.projFilter) || {}).contractorId || "") : null;
    const filteredContractors = s.contractors.filter(x => projContractorId === null || x.id === projContractorId);
    const contractorsList = filteredContractors.map(x => {
      const on = (s.selContractors || []).indexOf(x.id) > -1;
      return {
        ...x, initials: ini(x.title), canWrite: canWriteRecords && !lockedRecords.has(x.id), on,
        checkStyle: check(on), checkMark: on ? "✓" : "",
        onSelect: () => app.setState(st => ({ selContractors: on ? (st.selContractors || []).filter(i => i !== x.id) : [...(st.selContractors || []), x.id] })),
        onDoc: () => app.openGen("contractor", { ids: [x.id] }),
        onEdit: () => { app.fd = {}; app.setState({ sheet: { type: "contractor" }, draft: { ...x } }); },
        onDelete: () => app.setState({ sheet: { type: "confirm", action: "delete", entity: "contractor", obj: x } }),
      };
    });
    Object.assign(c, { projAuthorIds, filteredAuthors, authorsList, filteredContractors, contractorsList });
  return () => {
    const { s, tabStyle, chip } = c; /*LATE*/
    const A = s.recTab !== "contractors";
    const narrow = (c.contentW || 0) < 640;
    const view = s.recView === "list" ? "list" : "card";
    // +90 öneki: telefon 0 ile başlıyorsa uluslararası biçimde gösterilir.
    const tel = (p) => String(p || "").replace(/^0/, "+90 ");
    const rows = A
      ? authorsList.map(a => ({
          id: a.id, title: a.fullName, sub: [(a.jobs || []).join(", "), a.company].filter(Boolean).join(" · "), on: s.selAuthors.indexOf(a.id) > -1,
          k1: tx("TC"), v1: a.tc || "—", k2: tx("Telefon"), k2s: tx("Tel"), v2: tel(a.phone) || "—",
          checkStyle: a.checkStyle, checkMark: a.checkMark, onSelect: a.onSelect, onDoc: a.onDoc, onEdit: a.onEdit, onDelete: a.onDelete, canWrite: a.canWrite,
        }))
      : contractorsList.map(x => ({
          id: x.id, title: x.title, sub: [x.owner, x.rank ? tx("Sınıf") + " " + x.rank : ""].filter(Boolean).join(" · "), on: x.on,
          k1: tx("Yetki No"), v1: x.licence || "—", k2: tx("Adres"), k2s: tx("Adres"), v2: x.address || "—",
          checkStyle: x.checkStyle, checkMark: x.checkMark, onSelect: x.onSelect, onDoc: x.onDoc, onEdit: x.onEdit, onDelete: x.onDelete, canWrite: x.canWrite,
        }));
    const selIds = A ? s.selAuthors : (s.selContractors || []);
    const pool = A ? filteredAuthors : filteredContractors;
    const allOn = pool.length > 0 && pool.every(x => selIds.indexOf(x.id) > -1);
    return {
      isContractorsTab: !A,
      recAuthStyle: tabStyle(A), recContStyle: tabStyle(!A),
      recAuthors: () => app.setState({ recTab: "authors" }), recContractors: () => app.setState({ recTab: "contractors" }),
      recRows: rows, recNoRows: rows.length === 0, projFilterValue: s.projFilter || "",
      recNarrow: narrow, recIsCard: view === "card", recIsList: view === "list",
      recCardStyle: chip(view === "card").replace("height:32px", "height:40px"),
      recListStyle: chip(view === "list").replace("height:32px", "height:40px"),
      recSetCard: () => app.setState({ recView: "card" }), recSetList: () => app.setState({ recView: "list" }),
      recFilterAll: A ? tx("Tüm müellifler") : tx("Tüm müteahhitler"),
      recCols: "28px minmax(0,1.6fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1.3fr) auto",
      recHeads: A ? [tx("AD SOYAD"), tx("MESLEK · ŞİRKET"), tx("TC"), tx("TELEFON")] : [tx("FİRMA"), tx("YETKİLİ · SINIF"), tx("YETKİ NO"), tx("ADRES")],
      recDocLabel: (A ? tx("Seçili müelliflerle belge oluştur") : tx("Seçili müteahhitlerle belge oluştur")) + " (" + selIds.length + ")",
      recAddLabel: A ? tx("+ Müellif Ekle") : tx("+ Müteahhit Ekle"),
      selectAllLabel: allOn ? tx("Seçimi temizle") : tx("Tümünü seç"),
      selectAll: () => A
        ? app.setState({ selAuthors: allOn ? [] : filteredAuthors.map(a => a.id) })
        : app.setState({ selContractors: allOn ? [] : filteredContractors.map(x => x.id) }),
      printSelected: () => {
        if (A) {
          const ids = s.authors.filter(a => s.selAuthors.indexOf(a.id) > -1).map(a => a.id);
          if (!ids.length) return app.toast(tx("Belge için müellif seçin."));
          return app.openGen("authors", { ids, projectId: s.projFilter || "" }, "tp2");
        }
        const ids = s.contractors.filter(x => (s.selContractors || []).indexOf(x.id) > -1).map(x => x.id);
        if (!ids.length) return app.toast(tx("Belge için müteahhit seçin."));
        app.openGen("contractor", { ids });
      },
      addRecord: () => { app.fd = {}; app.setState({ sheet: { type: A ? "author" : "contractor" }, draft: {} }); },
      professionOptions: s.professions.map(p => ({ name: p })),
      contractorOptions: s.contractors.map(x => ({ id: x.id, title: x.title })),
      canAddContractor: canWriteRecords,
      onPrContractor: (e) => { if (e.target.value === ADD_OPTION) { e.target.value = ""; app.goAddRecord("contractor"); } else app.fd[e.target.name] = e.target.value; },
    };
  };
}
