// Görünüm modeli: detail
import type { Ctx, Vals } from "./types";
import { tx } from "../i18n";
import { ACCEPT_ATTR, FMT_LABEL, STATUSES, uid } from "../domain/constants";
import { parseShare, shareTotal } from "../domain/shares";
import { ic } from "../ui/icons";
/*IMPORTS*/

export function buildDetail(c: Ctx): () => Vals {
  const app = c.app;
  const { canWriteProjects, cur, pendings, s } = c; /*TOP*/
    const projPendings = pendings.filter(p => p.entity === "project" && p.payload && p.payload.id === (cur && cur.id));
    const docPendingFor = (id) => projPendings.find(p => p.docKey === id);
    const docOpenMap = s.docOpen || {};
    const isDocOpen = (k) => docOpenMap[k] === undefined ? true : !!docOpenMap[k];
    const toggleDoc = (k) => () => app.setState(st => { const o = { ...(st.docOpen || {}) }; o[k] = !(o[k] === undefined ? true : o[k]); return { docOpen: o }; });
    const fmtBytes = (n) => !n ? "" : n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
    const docFiles = (h) => h ? (Array.isArray(h.files) && h.files.length ? h.files : [h]) : [];
    const pill = (kind) => "flex:none;font-size:11px;font-weight:800;padding:4px 8px;border-radius:999px;white-space:nowrap;" + (kind === "ok" ? "background:var(--tint);color:var(--brandink)" : kind === "err" ? "background:var(--err);color:var(--errtext)" : kind === "warn" ? "background:var(--warn);color:var(--warntext)" : "background:var(--soft3);color:var(--muted)");
    const iconBox = (kind) => "width:26px;height:26px;flex:none;border-radius:7px;display:flex;align-items:center;justify-content:center;" + (kind === "ok" ? "background:var(--tint);color:var(--brandink)" : kind === "err" ? "background:var(--err);color:var(--errtext)" : "background:var(--soft3);color:var(--muted)");
    const docNode = (d) => {
      const files = docFiles((cur.docs || {})[d.id]), pend = docPendingFor(d.id), k = "d:" + d.id, open = isDocOpen(k);
      const st = files.length ? "ok" : pend ? "warn" : d.required ? "err" : "none";
      return {
        name: d.name, open, caret: open ? "▾" : "▸", onToggle: toggleDoc(k),
        desc: [d.required ? tx("Zorunlu") : tx("Seçmeli"), d.multi ? tx("Çoklu dosya") : tx("Tek dosya"), FMT_LABEL(d.accept)].join(" · "),
        statusLabel: files.length ? (files.length > 1 ? files.length + tx(" dosya") : tx("Yüklendi")) : pend ? tx("Onayda") : d.required ? tx("Eksik") : tx("Yüklenmedi"),
        statusStyle: pill(st), iconStyle: iconBox(st === "warn" ? "none" : st),
        files: files.map((f, i) => ({
          name: f.name, ext: ((f.name || "").split(".").pop() || "").toUpperCase().slice(0, 4),
          meta: [f.size, f.at, f.by].filter(Boolean).join(" · "),
          onDownload: () => app.download(f.name, f.url),
          canDelete: app.perm("files"), delTitle: tx("Dosyayı kaldır"),
          onDelete: () => app.removeFile(f.id, f.name),
        })),
        noFiles: !files.length,
        emptyLabel: d.required ? tx("Henüz dosya yüklenmedi — bu belge zorunlu.") : tx("Henüz dosya yüklenmedi."),
        emptyStyle: "font-size:12px;font-weight:700;padding:4px 2px;color:" + (d.required ? "var(--errtext)" : "var(--muted)"),
        pendingLabel: pend ? tx("Onay bekliyor: ") + pend.fileName : "",
        canUpload: app.perm("files"), acceptAttr: ACCEPT_ATTR[d.accept || "all"], multi: !!d.multi,
        uploadLabel: d.multi ? (files.length ? tx("Dosya ekle") : tx("Dosya yükle")) : (files.length ? tx("Dosyayı değiştir") : tx("Dosya yükle")),
        onUpload: (e) => {
          const fl = Array.prototype.slice.call(e.target.files || []); if (!fl.length) return;
          try { e.target.value = ""; } catch (er) {}
          app.uploadFiles(cur.id, d.id, d.multi ? fl : fl.slice(0, 1));
        },
      };
    };
    const docGrp = (key, label, hint, list) => {
      const nodes = list.map(docNode), done = nodes.filter(n => !n.noFiles).length, k = "g:" + key, open = isDocOpen(k);
      const kind = key === "req" ? (done === list.length ? "ok" : "err") : (done ? "ok" : "none");
      return { label, hint, nodes, open, caret: open ? "▾" : "▸", onToggle: toggleDoc(k), count: done + "/" + list.length, countStyle: pill(kind), iconStyle: iconBox(kind), empty: !list.length };
    };
    const reqDocTypes = s.docTypes.filter(d => d.required), optDocTypes = s.docTypes.filter(d => !d.required);
    const extFiles = cur ? (cur.files || []) : [];
    const extKey = "g:ext", extNodeKey = "d:ext", extOpen = isDocOpen(extKey), extNodeOpen = isDocOpen(extNodeKey);
    const extNode = {
      name: tx("Diğer dosyalar"), open: extNodeOpen, caret: extNodeOpen ? "▾" : "▸", onToggle: toggleDoc(extNodeKey),
      desc: tx("Seçmeli") + " · " + tx("Çoklu dosya") + " · " + tx("Tüm dosya tipleri"),
      statusLabel: extFiles.length ? extFiles.length + tx(" dosya") : tx("Yüklenmedi"), statusStyle: pill(extFiles.length ? "ok" : "none"), iconStyle: iconBox(extFiles.length ? "ok" : "none"),
      files: extFiles.map(f => ({
        name: f.name, ext: ((f.name || "").split(".").pop() || "").toUpperCase().slice(0, 4), meta: [f.size, f.at, f.by].filter(Boolean).join(" · "),
        onDownload: () => app.download(f.name, f.url), canDelete: app.perm("files"), delTitle: tx("Dosyayı kaldır"), onDelete: () => app.removeFile(f.id, f.name),
      })),
      noFiles: !extFiles.length, emptyLabel: tx("Henüz dosya yüklenmedi."), emptyStyle: "font-size:12px;font-weight:700;padding:4px 2px;color:var(--muted)",
      pendingLabel: "", canUpload: app.perm("files"), acceptAttr: "*/*", multi: true, uploadLabel: extFiles.length ? tx("Dosya ekle") : tx("Dosya yükle"),
      onUpload: (e) => { const fl = Array.prototype.slice.call(e.target.files || []); if (!fl.length) return; try { e.target.value = ""; } catch (er) {} app.uploadFiles(cur.id, null, fl); },
    };
    const extGroup = { label: tx("Ek dosyalar"), hint: tx("Belge türlerine girmeyen fotoğraf, rapor ve diğer dosyalar."), nodes: [extNode], open: extOpen, caret: extOpen ? "▾" : "▸", onToggle: toggleDoc(extKey), count: String(extFiles.length), countStyle: pill(extFiles.length ? "ok" : "none"), iconStyle: iconBox(extFiles.length ? "ok" : "none"), empty: false };
    const docGroups = cur ? [
      docGrp("req", tx("Zorunlu belgeler"), tx("Proje dosyasının tamamlanması için yüklenmesi gereken belgeler."), reqDocTypes),
      docGrp("opt", tx("Seçmeli belgeler"), tx("İsteğe bağlı; varsa projeye eklenecek belgeler."), optDocTypes),
    extGroup,
    ].filter(g => !g.empty) : [];
    const reqDone = cur ? reqDocTypes.filter(d => (cur.docs || {})[d.id]).length : 0;
    const optDone = cur ? optDocTypes.filter(d => (cur.docs || {})[d.id]).length : 0;
    const fileTotal = cur ? s.docTypes.reduce((n, d) => n + docFiles((cur.docs || {})[d.id]).length, extFiles.length) : 0;
    const docSummary = tx("Zorunlu: ") + reqDone + "/" + reqDocTypes.length + tx(" tamam") + " · " + tx("Seçmeli: ") + optDone + "/" + optDocTypes.length + " · " + tx("Toplam ") + fileTotal + tx(" dosya");
    const docPct = reqDocTypes.length ? Math.round(reqDone * 100 / reqDocTypes.length) : 100;
    const docProgStyle = "height:100%;border-radius:999px;transition:width .25s ease;width:" + docPct + "%;background:" + (docPct === 100 ? "var(--okdot)" : "var(--pri,#2a3180)");
    const docSetAll = (v) => () => app.setState(st => { const o = { ...(st.docOpen || {}) }; ["g:req", "g:opt", "g:ext", "d:ext"].concat(s.docTypes.map(d => "d:" + d.id)).forEach(k => { o[k] = v; }); return { docOpen: o }; });

    const curAssigned = cur ? (cur.authorIds || []).map(id => s.authors.find(a => a.id === id)).filter(Boolean) : [];
    const reqProfs = (s.professions || []).filter(pf => (s.profRequired || {})[pf] !== false);
    const detailAuthorSlots = cur ? (s.professions || []).map(pf => {
      const pool = s.authors.filter(a => a.job === pf), selA = curAssigned.find(a => a.job === pf);
      return {
        prof: pf, profMark: (s.profRequired || {})[pf] !== false ? "*" : "", hasOpts: pool.length > 0, noOpts: !pool.length,
        opts: pool.map(a => ({ id: a.id, label: a.first + " " + a.last + (a.sicil ? " · " + a.sicil : "") })),
        value: selA ? selA.id : "",
        selStyle: "flex:1 1 220px;min-width:0;height:40px;border-radius:9px;padding:0 10px;font-size:13px;font-weight:700;background:var(--card);cursor:pointer;" + (selA || (s.profRequired || {})[pf] === false ? "border:1px solid var(--line);color:var(--ink)" : "border:1px solid var(--errline);color:var(--errtext)"),
        onPick: (e) => {
          if (!canWriteProjects) return app.toast(tx("Bu işlem için yetkiniz yok."));
          const v = e.target.value;
          app.act(() => app.api.put("/projects/" + cur.id + "/authors", { job: pf, authorId: v }).then((r) => { if (r.result === "queued") app.toast(tx("Talep üst kademe onayına gönderildi.")); }));
        },
        onAdd: () => { app.fd = {}; app.setState({ sheet: { type: "author" }, draft: { job: pf } }); },
      };
    }) : [];
    const curMiss = cur ? app.authorMiss(cur) : [], profTotal = reqProfs.length;
    const authorStatus = (profTotal - curMiss.length) + "/" + profTotal + tx(" atandı");
    const authorStatusStyle = "flex:none;font-size:12px;font-weight:800;border-radius:999px;padding:4px 10px;white-space:nowrap;" + (curMiss.length ? "background:var(--err);color:var(--errtext)" : "background:var(--tint);color:var(--brandink)");
    const authorMissDetail = curMiss.length ? tx("Eksik müellif: ") + curMiss.join(", ") : "";

    const detailFiles = cur ? (cur.files || []).map(f => ({
      ...f, ext: (f.name.split(".").pop() || "").toUpperCase().slice(0, 4),
      meta: f.size + " · " + f.at + " · " + f.by,
      canDelete: app.perm("files"),
      onDownload: () => app.download(f.name, f.url),
      onDelete: () => app.removeFile(f.id, f.name),
    })) : [];
    const curOwners = cur ? (cur.owners || []) : [];
    const curProxy = (cur && cur.proxy) || {};
    Object.assign(c, { projPendings, docPendingFor, docOpenMap, isDocOpen, toggleDoc, fmtBytes, docFiles, pill, iconBox, docNode, docGrp, reqDocTypes, optDocTypes, docGroups, reqDone, optDone, fileTotal, docSummary, docPct, docProgStyle, docSetAll, curAssigned, reqProfs, detailAuthorSlots, curMiss, profTotal, authorStatus, authorStatusStyle, authorMissDetail, detailFiles, curOwners, curProxy });
  return () => {
    const { canWriteProjects, cur, curD, directProjects, s } = c; /*LATE*/
    return {
      detailOwners: curOwners.map(o => ({ ...o, meta: [o.tc ? tx("TC") + " " + o.tc : "", o.phone].filter(Boolean).join(" · ") })),
      noOwners: !curOwners.length,
      detailProxy: { ...curProxy, meta: [curProxy.tc ? tx("TC") + " " + curProxy.tc : "", curProxy.phone].filter(Boolean).join(" · ") },
      hasProxy: !!curProxy.name, noProxy: !curProxy.name,
      draftOwners: ((s.draft || {}).owners || []).map(o => ({
        ...o, meta: [o.tc, o.phone].filter(Boolean).join(" · ") || "—",
        shareLabel: tx("Hisse") + ": " + o.name, shareOk: !!parseShare(o.share) || (((s.draft || {}).owners || []).length === 1 && !String(o.share || "").trim()),
        onShare: (e) => { const share = e.target.value; app.setState(st => ({ draft: { ...st.draft, owners: ((st.draft || {}).owners || []).map(x => x.id === o.id ? { ...x, share } : x) } })); },
        onRemove: () => app.setState(st => ({ draft: { ...st.draft, owners: ((st.draft || {}).owners || []).filter(x => x.id !== o.id) } })),
      })),
      shareTotal: (() => {
        const list = (s.draft || {}).owners || [];
        if (!list.length) return { show: false };
        const t = shareTotal(list);
        const base = "flex:none;font-size:12px;font-weight:800;padding:4px 9px;border-radius:999px;white-space:nowrap;";
        return t.ok
          ? { show: true, text: tx("Hisse toplamı") + " " + t.text + " ✓", style: base + "background:var(--tint);color:var(--brandink)" }
          : { show: true, text: t.text ? tx("Hisse toplamı") + " " + t.text + tx(" · 1/1 olmalı") : tx("Geçersiz hisse: ") + t.invalid.join(", "), style: base + "background:var(--err);color:var(--errtext)" };
      })(),
      // Kişisel not: sunucuda kullanıcı+proje anahtarıyla şifreli durur; başkası göremez.
      personalNote: cur ? {
        key: cur.id,
        load: () => app.api.get("/projects/" + cur.id + "/note"),
        save: (body: string) => app.api.put("/projects/" + cur.id + "/note", { body }),
        lockIc: ic(["rect", { x: "5", y: "11", width: "14", height: "9", rx: "2" }], ["path", { d: "M8 11V8a4 4 0 0 1 8 0v3" }]),
      } : null,
      cameraIc: ic(["path", { d: "M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" }], ["circle", { cx: "12", cy: "12.5", r: "3.5" }]),
      draftProxy: (s.draft || {}).proxy || {},
      refOwName: app.mkRef("owName"), refOwTc: app.mkRef("owTc"), refOwPhone: app.mkRef("owPhone"), refOwShare: app.mkRef("owShare"), refOwAddr: app.mkRef("owAddr"),
      addDraftOwner: () => {
        const f = app.fd, name = (f.owName || "").trim();
        if (!name) return app.toast(tx("Arsa sahibi adı zorunlu."));
        const o = { id: uid(), name, tc: (f.owTc || "").trim(), phone: (f.owPhone || "").trim(), address: (f.owAddr || "").trim(), share: (f.owShare || "").trim() };
        app.clearFields("owName", "owTc", "owPhone", "owAddr", "owShare");
        app.setState(st => ({ draft: { ...st.draft, owners: [...((st.draft || {}).owners || []), o] } }));
      },
      info: (() => {
        if (!cur) return {};
        const wide = (c.contentW || 0) >= 760;
        const editing = s.infoEdit === cur.id;
        const locked = !!curD.locked;
        const f = app.fd;
        const val = (key, fallback) => (f[key] !== undefined ? f[key] : fallback || "");
        const canPhoto = app.perm("files") && directProjects;
        return {
          wide, editing, locked,
          canEdit: canWriteProjects && !locked && !editing,
          lockedNote: locked ? tx("Onay bekleyen bir değişiklik var; karara bağlanana kadar düzenlenemez.") : "",
          gridStyle: "display:grid;column-gap:20px;row-gap:14px;align-items:start;grid-template-columns:" + (wide ? "220px minmax(0,1fr)" : "minmax(0,1fr)"),
          address: [cur.mahalle, cur.street].filter(Boolean).join(" · ") || "—",
          plot: [
            { key: "pafta", label: tx("PAFTA"), value: cur.pafta || "—" },
            { key: "ada", label: tx("ADA"), value: cur.ada || "—" },
            { key: "parsel", label: tx("PARSEL"), value: cur.parsel || "—" },
          ],
          note: cur.note || "",
          noNote: !cur.note,
          statusLabel: curD.statusLabel, badgeStyle: curD.badgeStyle,
          photoUrl: cur.photoAt ? "/api/v1/projects/" + cur.id + "/photo?v=" + cur.photoAt : "",
          photoBoxStyle: "position:relative;width:100%;aspect-ratio:" + (wide ? "4 / 3" : "16 / 9") + ";border-radius:12px;overflow:hidden;background:var(--soft2);border:1px solid var(--line2);display:flex;align-items:center;justify-content:center",
          canPhoto, photoBusy: s.busy === "photo",
          photoAddLabel: cur.photoAt ? tx("Değiştir") : tx("Fotoğraf ekle"),
          onPhoto: (e) => {
            const file = (e.target.files || [])[0];
            try { e.target.value = ""; } catch (er) {}
            if (file) app.uploadPhoto(cur.id, file);
          },
          onPhotoRemove: () => app.removePhoto(cur.id),
          onEdit: () => {
            ["inName", "inContractor", "inMahalle", "inStreet", "inPafta", "inAda", "inParsel", "inStatus", "inNote"].forEach(k => { delete app.fd[k]; });
            app.setState({ infoEdit: cur.id });
          },
          onCancel: () => app.setState({ infoEdit: null }),
          saveLabel: directProjects ? tx("Kaydet") : tx("Onaya gönder"),
          approvalNote: directProjects ? "" : tx("Rolünüz onaylı düzenlemeye tabi: değişiklik üst kademe onaylayınca uygulanır."),
          formGridStyle: "display:grid;gap:12px 14px;grid-template-columns:repeat(" + (wide ? 6 : 3) + ",minmax(0,1fr))",
          spanAll: "grid-column:1 / -1;min-width:0",
          spanHalf: wide ? "grid-column:span 3;min-width:0" : "grid-column:1 / -1;min-width:0",
          spanThird: wide ? "grid-column:span 2;min-width:0" : "min-width:0",
          form: {
            name: val("inName", cur.name), contractorId: val("inContractor", cur.contractorId),
            mahalle: val("inMahalle", cur.mahalle), street: val("inStreet", cur.street), pafta: val("inPafta", cur.pafta),
            ada: val("inAda", cur.ada), parsel: val("inParsel", cur.parsel), status: val("inStatus", cur.status), note: val("inNote", cur.note),
          },
          contractorOptions: s.contractors.map(x => ({ id: x.id, title: x.title })),
          statusOptions: STATUSES.map(x => ({ id: x[0], label: tx(x[1]) })),
          onSave: async () => {
            const payload: any = {
              ...cur,
              name: val("inName", cur.name).trim(), contractorId: val("inContractor", cur.contractorId),
              mahalle: val("inMahalle", cur.mahalle).trim(), street: val("inStreet", cur.street).trim(),
              pafta: val("inPafta", cur.pafta).trim(), ada: val("inAda", cur.ada).trim(), parsel: val("inParsel", cur.parsel).trim(),
              status: val("inStatus", cur.status), note: val("inNote", cur.note),
            };
            const miss = [["name", tx("İnşaat adı")], ["contractorId", tx("Müteahhit")], ["mahalle", tx("Mahalle")], ["street", tx("Cadde / sokak")], ["ada", tx("Ada no")], ["parsel", tx("Parsel no")]].filter(x => !String(payload[x[0]] || "").trim());
            if (miss.length) return app.toast(tx("Zorunlu alanlar eksik: ") + miss.map(x => x[1]).join(", "));
            if (await app.commit("update", "project", payload, tx("Proje düzenleme") + ": " + payload.name)) app.setState({ infoEdit: null });
          },
        };
      })(),
      people: (() => {
        if (!cur) return {};
        const wide = (c.contentW || 0) >= 760;
        const owners = cur.owners || [], proxy = cur.proxy || {};
        const total = shareTotal(owners);
        const pillBase = "flex:none;font-size:12px;font-weight:800;padding:4px 10px;border-radius:999px;white-space:nowrap;";
        const person = (p) => ({ meta: [p.tc ? tx("TC") + " " + p.tc : "", p.phone].filter(Boolean).join(" · "), address: p.address || "" });
        return {
          wide,
          canEdit: canWriteProjects && !curD.locked,
          onEdit: () => { app.fd = {}; app.setState({ sheet: { type: "people" }, draft: { ...cur } }); },
          bodyStyle: wide
            ? "display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)"
            : "display:flex;flex-direction:column",
          proxyColStyle: wide
            ? "min-width:0;padding-left:20px;margin-left:20px;border-left:1px solid var(--line2)"
            : "min-width:0;padding-top:14px;margin-top:14px;border-top:1px solid var(--line2)",
          owners: owners.map((o, i) => ({ id: o.id || String(i), name: o.name, share: o.share || "—", ...person(o), first: i === 0 })),
          noOwners: !owners.length,
          // Toplam doğruysa bilgi verilmez; yalnızca hatalı (eski) kayıtta uyarı çıkar.
          showTotal: owners.length > 0 && !total.ok,
          totalText: total.ok ? tx("Hisse toplamı") + " " + total.text : total.text ? tx("Hisse toplamı") + " " + total.text + tx(" · 1/1 olmalı") : tx("Geçersiz hisse"),
          totalStyle: pillBase + (total.ok ? "background:var(--tint);color:var(--brandink)" : "background:var(--err);color:var(--errtext)"),
          hasProxy: !!proxy.name,
          proxy: { name: proxy.name || "", ...person(proxy) },
        };
      })(),
      openPeople: () => { app.fd = {}; app.setState({ sheet: { type: "people" }, draft: { ...cur } }); },
      detail: curD, docGroups, docSummary, docProgStyle, docExpandAll: docSetAll(true), docCollapseAll: docSetAll(false),
      docFolderIc: ic(["path", { d: "M3 7.5A2 2 0 0 1 5 5.5h4l2 2h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }]),
      docFileIc: ic(["path", { d: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" }], ["path", { d: "M14 3v5h5" }]),
      detailAuthorSlots, authorStatus, authorStatusStyle, authorMissDetail, hasAuthorMissDetail: !!authorMissDetail, detailFiles,
      docsNeedApproval: canWriteProjects && !directProjects,
      detailPendings: projPendings, hasDetailPendings: projPendings.length > 0, detailPendingCount: projPendings.length,
      noFiles: detailFiles.length === 0,
      onProjectFiles: (e) => {
        const files = Array.from(e.target.files || []); if (!files.length || !cur) return;
        try { e.target.value = ""; } catch (er) {}
        app.uploadFiles(cur.id, null, files);
      },
      printProjectAuthors: () => {
        if (!cur) return;
        const miss = app.authorMiss(cur); if (miss.length) return app.toast(tx("Önce her meslek için bir müellif atayın: ") + miss.join(", "));
        const list = (cur.authorIds || []).map(id => s.authors.find(a => a.id === id)).filter(Boolean);
        app.printAuthorTable(list, cur.name + tx(" · Ada ") + cur.ada + tx(" / Parsel ") + cur.parsel + tx(" · Müteahhit: ") + cur.contractor);
      },

    };
  };
}
