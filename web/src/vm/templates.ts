// @ts-nocheck -- düzenleyici şeridinin dinamik değerleri; davranış E2E testiyle doğrulanır.
// Görünüm modeli: templates
import type { Ctx, Vals } from "./types";
import { LOC, tx } from "../i18n";
import { BC_COLORS, COLORS, FC_COLORS, FONTS, HL_COLORS, PAGE_SIZES, SH_COLORS, SIZES, TPL_CTX } from "../domain/constants";
import { ICONS, RBI, TBI } from "../ui/icons";
import { tplPayload } from "../api/mappers";
import { LISTS, LISTTBL, PB_HTML, REP_DIV, SIG, TABLE, V, VAR_GROUPS, blankTpl, geom } from "../documents/template";
/*IMPORTS*/

export function buildTemplates(c: Ctx): () => Vals {
  const app = c.app;
  const { contentW, isDesktop, s, tabStyle } = c; /*TOP*/
    const canTpl = app.perm("templates");
    const ctxLabel = (k) => tx((TPL_CTX.find(x => x[0] === k) || ["", k])[1]);
    const segBtn = (on) => "height:32px;padding:0 12px;border:none;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;" + (on ? "background:var(--card);color:var(--brandink);box-shadow:0 1px 3px rgba(0,0,0,.1)" : "background:transparent;color:var(--muted)");
    const optChip = (on) => "height:30px;padding:0 10px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;" + (on ? "background:var(--pri,#2a3180);color:#fff;border:1px solid var(--pri,#2a3180)" : "background:var(--card);color:var(--muted);border:1px solid var(--line)");
    const cbox = (on) => "width:16px;height:16px;flex:none;border-radius:4px;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;" + (on ? "background:var(--pri,#2a3180);color:#fff;border:1px solid var(--pri,#2a3180)" : "background:var(--card);color:transparent;border:1px solid var(--line)");
    const tplCards = s.templates.map(t => ({
      id: t.id, name: t.name, icon: ICONS.templates(),
      meta: t.size + " · " + (t.orient === "landscape" ? tx("Yatay") : tx("Dikey")) + (t.updated ? " · " + t.updated : ""),
      ctxChips: (t.contexts || []).map(c => ({ label: ctxLabel(c) })),
      onEdit: () => app.openTpl(t),
      onDup: () => app.act(() => app.api.put("/templates", tplPayload({ ...t, id: "", name: t.name + tx(" (kopya)") })), tx("Şablon kopyalandı.")),
      onDelete: () => app.setState({ sheet: { type: "confirm", action: "delete", entity: "template", obj: t } }),
    }));
    const dr = s.tplDraft;
    app._sh = app._sh || {};
    let tplVals = {};
    if (dr) {
      const ctxs = dr.contexts || [];
      const g = geom(dr), px = (mm) => Math.round(mm * 3.7795), ms = s.vw < 700 ? 0.45 : 1;
      const sideBeside = contentW >= 900;
      const editorW = sideBeside ? contentW - 334 : contentW;
      const vq = (s.varQ || "").trim().toLocaleLowerCase(LOC());
      const okCtx = (arr) => arr.some(c => ctxs.indexOf(c) > -1);
      const setDr = (patch) => app.setState(st => ({ tplDraft: { ...st.tplDraft, ...(typeof patch === "function" ? patch(st.tplDraft) : patch) }, tplDirty: true }));
      const vOpen = s.varOpen || {};
      const chev = (on) => "flex:none;width:12px;font-size:11px;color:var(--muted);display:inline-block;transition:transform .15s ease;transform:rotate(" + (on ? "90deg" : "0deg") + ")";
      const togV = (id) => () => app.setState(st => ({ varOpen: { ...(st.varOpen || {}), [id]: !(st.varOpen || {})[id] } }));
      const varGroupsRaw = VAR_GROUPS.filter(gr => okCtx(gr.ctx)).map(gr => ({
        id: gr.id, label: tx(gr.label),
        items: gr.items.filter(it => !vq || tx(it[1]).toLocaleLowerCase(LOC()).indexOf(vq) > -1 || tx(gr.label).toLocaleLowerCase(LOC()).indexOf(vq) > -1).map(it => ({ label: tx(it[1]), onInsert: () => app.insertVar(it[0]) })),
      })).filter(gr => gr.items.length);
      const varGroups = varGroupsRaw.map((gr, gi) => { const on = !!vq || !!vOpen[gr.id]; return { ...gr, count: gr.items.length, open: on, chevStyle: chev(on), onToggle: togV(gr.id), wrapStyle: gi < varGroupsRaw.length - 1 ? "border-bottom:1px solid var(--line2)" : "" }; });
      const listDefs = Object.keys(LISTS).filter(k => okCtx(LISTS[k].ctx)).map(k => {
        const Ls = LISTS[k], cols = (s.tbCols || {})[k] || [];
        const lOn = !!vOpen["list:" + k];
        return {
          key: k, label: tx(Ls.label), open: lOn, chevStyle: chev(lOn), onToggle: togV("list:" + k),
          cols: Ls.fields.map(f => { const on = cols.indexOf(f[0]) > -1; return { label: tx(f[1]), mark: on ? "✓" : "+", style: optChip(on).replace("height:30px", "height:28px"), onToggle: () => app.setState(st => { const cur = (st.tbCols || {})[k] || []; const nx = on ? cur.filter(x => x !== f[0]) : Ls.fields.map(x => x[0]).filter(x => x === f[0] || cur.indexOf(x) > -1); return { tbCols: { ...st.tbCols, [k]: nx } }; }) }; }),
          fields: Ls.fields.filter(f => f[0] !== "imza").map(f => ({ label: tx(f[1]), onInsert: () => app.insertVar(k + "[]." + f[0]) })),
          onTable: () => { if (!cols.length) return app.toast(tx("En az bir sütun seçin.")); app.edInsert(LISTTBL(k, cols), true); },
          onRepeat: () => app.edInsert('<div data-repeat="' + k + '" style="' + REP_DIV + '"><p style="margin:3px 0">' + V(k + "[].sira") + ". " + V(k + "[]." + Ls.fields[1][0]) + " — " + V(k + "[].telefon") + "</p></div>", true),
        };
      });
      const sampleOpts = [];
      if (ctxs.indexOf("project") > -1) s.projects.forEach(p => sampleOpts.push({ id: "project:" + p.id, label: tx("Proje") + " · " + p.name }));
      if (ctxs.indexOf("authors") > -1) { sampleOpts.push({ id: "authors:", label: tx("Müellifler") + " · " + tx("tümü") }); s.projects.forEach(p => sampleOpts.push({ id: "authors:" + p.id, label: tx("Müellifler") + " · " + p.name })); }
      if (ctxs.indexOf("contractor") > -1) s.contractors.forEach(c => sampleOpts.push({ id: "contractor:" + c.id, label: tx("Müteahhit") + " · " + c.title }));
      const sampleVal = sampleOpts.some(o => o.id === s.tplSample) ? s.tplSample : ((sampleOpts[0] || {}).id || "");
      const isPrev = s.tplMode === "preview";
      if (isPrev) {
        const sk = sampleVal.split(":")[0] || "project", sid = sampleVal.split(":")[1] || "";
        const data = sk === "project" ? { projectId: sid } : sk === "authors" ? { ids: sid ? ((s.projects.find(p => p.id === sid) || {}).authorIds || []) : s.authors.map(a => a.id), projectId: sid } : { contractorId: sid };
        app._sh.tplPrev = app.paperHtml({ ...dr, header: app._zh.header, body: app._zh.body, footer: app._zh.footer }, app.buildCtx(sk, data));
      }
      tplVals = {
        tplDraft: dr,
        tplIsEdit: !isPrev, tplIsPreview: isPrev,
        tplModeEditStyle: segBtn(!isPrev), tplModePrevStyle: segBtn(isPrev),
        tplModeEdit: () => app.setState({ tplMode: "edit" }),
        tplModePreview: () => app.setState({ tplMode: "preview", edPop: null, edInTable: false, edImg: false }),
        tplDirty: !!s.tplDirty,
        onTplName: (e) => setDr({ name: e.target.value }),
        tplCtxOpen: s.rbMenu === "ctx",
        tplCtxMenu: () => app.setState(st => ({ rbMenu: st.rbMenu === "ctx" ? null : "ctx" })),
        tplCtxSummary: (() => { const sel = TPL_CTX.filter(c => ctxs.indexOf(c[0]) > -1).map(c => tx(c[1])); return sel.length ? sel.join(", ") : tx("Seçim yok"); })(),
        tplCtxCount: TPL_CTX.filter(c => ctxs.indexOf(c[0]) > -1).length, tplCtxCountShow: TPL_CTX.filter(c => ctxs.indexOf(c[0]) > -1).length > 1,
        tplCtxBtnStyle: "display:flex;align-items:center;gap:8px;height:36px;width:" + (s.vw < 700 ? "100%" : "300px") + ";max-width:100%;min-width:0;padding:0 10px 0 12px;border-radius:8px;border:1px solid " + (s.rbMenu === "ctx" ? "var(--pri,#2a3180)" : "var(--line)") + ";background:var(--card);font-size:13px;font-weight:700;cursor:pointer;color:" + (ctxs.length ? "var(--ink)" : "var(--muted)"),
        tplCtxAllLabel: TPL_CTX.every(c => ctxs.indexOf(c[0]) > -1) ? tx("Seçimi temizle") : tx("Tümünü seç"),
        tplCtxAll: () => setDr(() => ({ contexts: TPL_CTX.every(c => ctxs.indexOf(c[0]) > -1) ? [] : TPL_CTX.map(c => c[0]) })),
        tplCtxOpts: TPL_CTX.map(c => { const on = ctxs.indexOf(c[0]) > -1; return {
          on: on ? "true" : "false", label: tx(c[1]), mark: on ? "✓" : "", boxStyle: cbox(on),
          rowStyle: "display:flex;align-items:center;gap:9px;height:36px;width:100%;padding:0 12px 0 8px;border:none;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer;text-align:left;" + (on ? "background:var(--tint);color:var(--brandink)" : "background:transparent;color:var(--ink)"),
          onToggle: () => setDr(d0 => { const cs = d0.contexts || []; return { contexts: cs.indexOf(c[0]) > -1 ? cs.filter(x => x !== c[0]) : [...cs, c[0]] }; }),
        }; }),
        tplSampleOpts: sampleOpts, tplSampleVal: sampleVal, onTplSample: (e) => app.setState({ tplSample: e.target.value }),
        tplPrevRef: app.slotRef("tplPrev"), zWrapTpl: app.zoomWrapRef("tpl"),
        noVarHits: !varGroups.length, hasListDefs: listDefs.length > 0,
        tplPaperLabel: (dr.size || "A4") + " · " + ((dr.orient || "portrait") === "landscape" ? tx("Yatay") : tx("Dikey")) + " · " + (FONTS.find(f => f[0] === dr.font) || ["", "—"])[1] + " " + (dr.fontSize || 12) + " pt",
        zLblTpl: (s.zoomLbl || {}).tpl || "100%", zOutTpl: () => app.zoomStep("tpl", -1), zInTpl: () => app.zoomStep("tpl", 1),
        zFitTpl: () => app.zoomSet("tpl", "fit"), z100Tpl: () => app.zoomSet("tpl", 1), zFitTplStyle: optChip((s.zoom || {}).tpl === "fit"),
        tplZoom: String(Math.min(1, Math.max(0.3, (editorW - 50) / px(g.w)))),
        paperEditStyle: "flex:none;width:" + px(g.w) + "px;min-height:" + px(g.h) + "px;box-sizing:border-box;background:#fff;color:#111;text-align:left;box-shadow:0 2px 14px rgba(0,0,0,.14);padding:" + [g.m.t, g.m.r, g.m.b, g.m.l].map(x => Math.max(22, px(x)) + "px").join(" ") + ";font-family:" + dr.font + ";font-size:" + dr.fontSize + "pt;line-height:1.4;display:flex;flex-direction:column",
        tplPageNo: !!dr.pageNo, pageNoMock: tx("Sayfa") + " 1 / 1",
        pageNoMockStyle: "margin-top:6px;font-family:Arial,sans-serif;font-size:9pt;color:#777;text-align:" + (dr.pageNoPos || "right"),
        zHeader: app.zoneRef("header"), zBody: app.zoneRef("body"), zFooter: app.zoneRef("footer"),
        tbKeep: (e) => e.preventDefault(),
        tbBold: () => app.edExec("bold"), tbItalic: () => app.edExec("italic"), tbUnder: () => app.edExec("underline"),
        tbAL: () => app.edExec("justifyLeft"), tbAC: () => app.edExec("justifyCenter"), tbAR: () => app.edExec("justifyRight"), tbAJ: () => app.edExec("justifyFull"),
        tbUL: () => app.edExec("insertUnorderedList"), tbOL: () => app.edExec("insertOrderedList"),
        tbUndo: () => app.edExec("undo"), tbRedo: () => app.edExec("redo"), tbClear: () => app.edExec("removeFormat"),
        tbPB: () => app.edInsert(PB_HTML, true),
        tbBlock: (e) => { const v = e.target.value; e.target.value = ""; if (v) app.edExec("formatBlock", "<" + v + ">"); },
        tbSize: (e) => { const v = e.target.value; e.target.value = ""; if (v) app.edFontSize(v); },
        tbSizes: SIZES.map(v => ({ v: String(v) })),
        tbI: { al: TBI.al(), ac: TBI.ac(), ar: TBI.ar(), aj: TBI.aj(), ul: TBI.ul(), ol: TBI.ol(), undo: TBI.undo(), redo: TBI.redo() },
        edPopColor: s.edPop === "color", edPopTable: s.edPop === "table", edPopImg: s.edPop === "img", edPopSig: s.edPop === "sig",
        tbPopColor: () => app.setState(st => ({ edPop: st.edPop === "color" ? null : "color" })),
        tbPopTable: () => app.setState(st => ({ edPop: st.edPop === "table" ? null : "table" })),
        tbPopImg: () => app.setState(st => ({ edPop: st.edPop === "img" ? null : "img" })),
        tbPopSig: () => app.setState(st => ({ edPop: st.edPop === "sig" ? null : "sig" })),
        tbColors: COLORS.map(c => ({ hex: c, style: "width:26px;height:26px;flex:none;border-radius:6px;border:1px solid var(--line);cursor:pointer;background:" + c, onPick: () => app.edExec("foreColor", c) })),
        tblRowOpts: [1, 2, 3, 4, 5, 6, 8, 10].map(n => ({ v: String(n) })), tblColOpts: [1, 2, 3, 4, 5, 6, 8].map(n => ({ v: String(n) })),
        tbInsertTable: () => { const r = +(app.fd.tblRows || 3), c = +(app.fd.tblCols || 3); app.edInsert(TABLE(r, c), true); app.setState({ edPop: null }); },
        tbLogo: () => { if (!s.company.logoUrl) return app.toast(tx("Önce sistem panelinden şirket logosu yükleyin.")); app.edInsert('<img src="' + s.company.logoUrl + '" alt="Logo" style="width:22%;max-width:100%">', false); app.setState({ edPop: null }); },
        tbImgFile: (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { app.edInsert('<img src="' + rd.result + '" alt="" style="width:40%;max-width:100%">', false); app.setState({ edPop: null }); }; rd.readAsDataURL(f); e.target.value = ""; },
        tbSigR: () => { app.edInsert(SIG("right", tx("Ad Soyad") + "<br>" + tx("İmza")), true); app.setState({ edPop: null }); },
        tbSigL: () => { app.edInsert(SIG("left", tx("Ad Soyad") + "<br>" + tx("İmza")), true); app.setState({ edPop: null }); },
        tbSig2: () => { app.edInsert(SIG("two", tx("Ad Soyad") + "<br>" + tx("İmza")), true); app.setState({ edPop: null }); },
        edInTable: !!s.edInTable && !isPrev, edImg: !!s.edImg && !isPrev,
        tbRowAdd: () => app.edTable("row+"), tbColAdd: () => app.edTable("col+"), tbRowDel: () => app.edTable("row-"), tbColDel: () => app.edTable("col-"), tbTblDel: () => app.edTable("del"),
        imgWidths: [25, 50, 75, 100].map(p => ({ label: p + "%", onPick: () => app.edImgSet({ width: p + "%" }) })),
        imgAligns: [["left", "Sola"], ["center", "Ortala"], ["right", "Sağa"]].map(a => ({ label: tx(a[1]), onPick: () => app.edImgSet({ display: "block", margin: a[0] === "left" ? "0 auto 0 0" : a[0] === "center" ? "0 auto" : "0 0 0 auto" }) })),
        tbImgDel: () => { if (app._img) { app._img.remove(); app._img = null; app.syncZones(); app.setState({ edImg: false }); } },
        tplSideIsVars: s.tplSide !== "page", tplSideIsPage: s.tplSide === "page",
        tplSideVarsStyle: tabStyle(s.tplSide !== "page"), tplSidePageStyle: tabStyle(s.tplSide === "page"),
        tplSideVars: () => app.setState({ tplSide: "vars" }), tplSidePage: () => app.setState({ tplSide: "page" }),
        sidePanelStyle: "min-width:260px;max-width:100%;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:12px;" + (sideBeside ? "flex:0 0 320px;position:sticky;top:calc(var(--hdr-h,59px) + 8px);max-height:calc(100vh - var(--hdr-h,59px) - 26px);overflow-y:auto" : "flex:1 1 100%"),
        varGroups, listDefs, onVarQ: (e) => app.setState({ varQ: e.target.value }),
        pgSizes: Object.keys(PAGE_SIZES).map(k => ({ label: k, style: optChip(dr.size === k), onPick: () => setDr({ size: k }) })),
        pgOrients: [["portrait", "Dikey"], ["landscape", "Yatay"]].map(o => ({ label: tx(o[1]), style: optChip((dr.orient || "portrait") === o[0]), onPick: () => setDr({ orient: o[0] }) })),
        onMargin: (e) => { const k = { mgT: "t", mgR: "r", mgB: "b", mgL: "l" }[e.target.name]; const v = Math.max(0, Math.min(60, parseFloat(e.target.value) || 0)); setDr(d0 => ({ margins: { ...(d0.margins || {}), [k]: v } })); },
        fontOpts: FONTS.map(f => ({ id: f[0], label: f[1] })), onTplFont: (e) => setDr({ font: e.target.value }),
        onTplSize: (e) => setDr({ fontSize: +e.target.value }), tplSizeVal: String(dr.fontSize || 12),
        togglePageNo: () => setDr(d0 => ({ pageNo: !d0.pageNo })),
        pnTrackStyle: "width:40px;height:22px;flex:none;border-radius:999px;padding:2px;display:flex;align-items:center;transition:background .18s ease;" + (dr.pageNo ? "justify-content:flex-end;background:var(--pri,#2a3180);border:1px solid var(--pri,#2a3180)" : "justify-content:flex-start;background:var(--soft3);border:1px solid var(--line)"),
        pnKnobStyle: "width:16px;height:16px;border-radius:50%;display:block;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.28)",
        pnPos: [["left", "Sol"], ["center", "Orta"], ["right", "Sağ"]].map(o => ({ label: tx(o[1]), style: optChip((dr.pageNoPos || "right") === o[0]), onPick: () => setDr({ pageNoPos: o[0] }) })),
        ...(() => {
          const f = s.fmt || {}, M = s.rbMenu, inT = !!s.edInTable && !isPrev, inI = !!s.edImg && !isPrev;
          const SBs = "height:28px;min-width:28px;padding:0 5px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;flex:none;font-size:13px;color:var(--ink);";
          const tg = (on, extra) => SBs + (on ? "background:var(--tint);border:1px solid var(--tintline);color:var(--brandink);" : "background:transparent;border:1px solid transparent;") + (extra || "");
          const mn = (id) => () => app.setState(st => ({ rbMenu: st.rbMenu === id ? null : id, rbGrid: null }));
          const close = (fn) => (...a) => { fn(...a); app.setState({ rbMenu: null }); };
          const sw = (c, fn) => ({ hex: c, style: "width:22px;height:22px;border-radius:5px;border:1px solid rgba(0,0,0,.14);cursor:pointer;padding:0;background:" + c, onPick: close(fn) });
          const mk = (on) => on ? "✓" : "";
          const nf = (x) => Number(x).toLocaleString(LOC());
          const tabsAll = (isPrev ? [["layout", "Sayfa Düzeni"]] : [["home", "Giriş"], ["insert", "Ekle"], ["vars", "Değişkenler"], ["layout", "Sayfa Düzeni"]])
            .concat(inT ? [["tdesign", "Tablo Tasarımı", 1], ["tlayout", "Tablo Düzeni", 1]] : []).concat(inI ? [["img", "Görsel Biçimi", 1]] : []);
          const tab = tabsAll.some(t => t[0] === s.rbTab) ? s.rbTab : tabsAll[0][0];
          const canU = !!(app._hs && app._hi > 0) || !!app._ht, canR = !!(app._hs && app._hi < app._hs.length - 1);
          const qs = (on) => SBs + "background:transparent;border:1px solid transparent;" + (on ? "" : "opacity:.35;pointer-events:none");
          const vqHits = [];
          if (vq) varGroupsRaw.forEach(gr => gr.items.forEach(it => vqHits.length < 40 && vqHits.push({ label: it.label, group: gr.label, onInsert: it.onInsert })));
          const rg = s.rbGrid, grid = [];
          for (let r = 1; r <= 8; r++) for (let c = 1; c <= 10; c++) { const on = rg && r <= rg.r && c <= rg.c; grid.push({ label: c + "×" + r, style: "width:17px;height:17px;padding:0;border-radius:2px;cursor:pointer;" + (on ? "background:var(--tint);border:1px solid var(--pri,#2a3180)" : "background:var(--card);border:1px solid var(--line)"), onEnter: () => app.setState({ rbGrid: { r, c } }), onPick: close(() => app.edInsert(TABLE(r, c), true)) }); }
          const mg = dr.margins || {};
          const sizesCur = SIZES.map(String); if (f.size && sizesCur.indexOf(f.size) < 0) { sizesCur.push(f.size); sizesCur.sort((a, b) => a - b); }
          const mob = s.vw < 700;
          return {
            rbDesk: !mob, rbMob: mob,
            rbGrpStyle: mob ? "display:flex;padding:3px 4px;min-width:0" : "display:flex;flex-direction:column;padding:4px 10px 0;border-right:1px solid var(--line2);min-height:86px",
            rbInRow: "flex:1;display:flex;align-items:center;gap:3px;flex-wrap:wrap",
            rbInCol: mob ? "flex:1;display:flex;flex-wrap:wrap;align-items:center;gap:3px" : "flex:1;display:flex;flex-direction:column;justify-content:center;gap:4px",
            rbBB: mob ? "display:flex;flex-direction:row;align-items:center;gap:5px;height:32px;padding:0 8px;border:1px solid var(--line);border-radius:7px;background:var(--card);color:var(--ink);cursor:pointer;font-size:11.5px;font-weight:700;white-space:nowrap;flex:none" : "display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;min-width:58px;height:64px;padding:6px 7px 4px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--ink);cursor:pointer;font-size:11px;font-weight:700;line-height:1.15;text-align:center;flex:none",
            rbBodyStyle: "display:flex;align-items:stretch;padding:" + (mob ? "4px" : "4px 2px 2px;min-height:90px"),
            rbFontSel: "height:28px;border:1px solid var(--line);background:var(--card);border-radius:6px;padding:0 6px;font-size:12px;font-weight:600;color:var(--ink);width:" + (mob ? "118px" : "150px"),
            saveTpl: () => app.saveTpl(), rbSave: () => app.saveTpl(), rbUndo: () => app.histGo(-1), rbRedo: () => app.histGo(1),
            undoStyle: qs(canU), redoStyle: qs(canR), ri: RBI(),
            rbTabs: tabsAll.map(t => { const on = t[0] === tab; return { label: tx(t[1]), onPick: () => app.setState({ rbTab: t[0], rbMenu: null }),
              style: "height:32px;padding:0 14px;border-radius:8px 8px 0 0;font-size:12.5px;font-weight:" + (on ? "800" : "700") + ";cursor:pointer;white-space:nowrap;flex:none;margin-bottom:-1px;" + (t[2] ? "color:var(--brandink);border-top:2px solid var(--brandink);" : "border-top:2px solid transparent;") + (on ? "background:var(--card);border-left:1px solid var(--line);border-right:1px solid var(--line);border-bottom:1px solid var(--card);" + (t[2] ? "" : "color:var(--brandink);") : "background:transparent;border-left:1px solid transparent;border-right:1px solid transparent;border-bottom:1px solid transparent;" + (t[2] ? "" : "color:var(--muted);")) }; }),
            rbHome: tab === "home", rbInsert: tab === "insert", rbVars: tab === "vars", rbLayout: tab === "layout", rbTD: tab === "tdesign", rbTL: tab === "tlayout", rbImg: tab === "img",
            fmtFont: f.font || "", fmtSize: f.size || "", rbSizes: sizesCur.map(v => ({ v })),
            rbFont: (e) => { const v = e.target.value; if (v) app.edExec("fontName", v); },
            rbSize: (e) => { const v = e.target.value; if (v) app.edFontSize(v); },
            rbGrow: () => app.edGrow(1), rbShrink: () => app.edGrow(-1),
            stB: tg(f.b, "font-weight:900"), stI: tg(f.i, "font-style:italic;font-family:Georgia,serif;font-weight:700;font-size:14px"), stU: tg(f.u, "text-decoration:underline;font-weight:700"),
            stS: tg(f.s, "text-decoration:line-through;font-weight:700;font-size:12px"), stSub: tg(f.sub, "font-size:12px;font-weight:700"), stSup: tg(f.sup, "font-size:12px;font-weight:700"),
            tbStrike: () => app.edExec("strikeThrough"), tbSub: () => app.edExec("subscript"), tbSup: () => app.edExec("superscript"),
            fcBarStyle: "font-size:13px;font-weight:800;line-height:1;border-bottom:3px solid " + (s.lastFc || "#a8341a") + ";padding:0 2px 1px",
            hlBarStyle: "font-size:11.5px;font-weight:800;line-height:1;border-bottom:3px solid " + (s.lastHl || "#fff176") + ";padding:0 2px 1px",
            rbFcApply: () => app.edExec("foreColor", s.lastFc || "#a8341a"), mnFc: mn("fc"), mFc: M === "fc",
            fcColors: FC_COLORS.map(c => sw(c, () => { app.edExec("foreColor", c); app.setState({ lastFc: c }); })), rbFcAuto: close(() => app.edExec("foreColor", "#111111")),
            rbHlApply: () => app.edExec("hiliteColor", s.lastHl || "#fff176"), mnHl: mn("hl"), mHl: M === "hl",
            hlColors: HL_COLORS.map(c => sw(c, () => { app.edExec("hiliteColor", c); app.setState({ lastHl: c }); })), rbHlNone: close(() => app.edExec("hiliteColor", "transparent")),
            stUL: tg(f.ul), stOL: tg(f.ol), stAL: tg(f.ta === "left"), stAC: tg(f.ta === "center"), stAR: tg(f.ta === "right"), stAJ: tg(f.ta === "justify"),
            tbOut: () => app.edExec("outdent"), tbIn: () => app.edExec("indent"),
            mnLs: mn("ls"), mLs: M === "ls", lsOpts: [1, 1.15, 1.5, 2, 2.5, 3].map(v => ({ label: nf(v), mark: "", onPick: close(() => app.edPara({ lineHeight: String(v) })) })),
            rbSpAdd: close(() => app.edPara({ marginBottom: "8pt" })), rbSpDel: close(() => app.edPara({ marginBottom: "0" })),
            styleGal: [["p", "Normal", "font-size:12px"], ["h1", "Başlık 1", "font-size:15px;font-weight:800"], ["h2", "Başlık 2", "font-size:13.5px;font-weight:800"], ["h3", "Başlık 3", "font-size:12.5px;font-weight:800"]].map(x => ({
              label: tx(x[1]), pvStyle: "font-family:Georgia,serif;line-height:1.1;color:var(--ink);white-space:nowrap;" + x[2], onPick: () => app.edExec("formatBlock", "<" + x[0] + ">"),
              style: "display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:4px;width:78px;height:54px;padding:4px 8px;border-radius:6px;cursor:pointer;text-align:left;flex:none;overflow:hidden;" + (f.block === x[0] ? "background:var(--tint);border:1px solid var(--tintline)" : "background:var(--card);border:1px solid var(--line)"),
            })),
            mnTbl: mn("tbl"), mTbl: M === "tbl", gridCells: grid, gridLabel: rg ? rg.c + " × " + rg.r + " " + tx("Tablo") : tx("Tablo ekle"), gridLeave: () => app.setState({ rbGrid: null }),
            mnSig: mn("sig"), mSig: M === "sig",
            sigOpts: [["right", "Sağa imza"], ["left", "Sola imza"], ["two", "İki imza"]].map(o => ({ label: tx(o[1]), mark: "", onPick: close(() => app.edInsert(SIG(o[0], tx("Ad Soyad") + "<br>" + tx("İmza")), true)) })),
            tbHr: () => app.edInsert('<hr style="border:none;border-top:1px solid #444;margin:10px 0">', true),
            varQ: s.varQ || "", onVarQ: (e) => app.setState({ varQ: e.target.value, rbMenu: "q" }), onVarFocus: () => app.setState({ rbMenu: "q" }),
            mQ: M === "q" && !!vq, varHits: vqHits, noVarHits: !!vq && !vqHits.length,
            varDD: VAR_GROUPS.filter(gr => okCtx(gr.ctx)).map(gr => { const open = M === "v:" + gr.id; return {
              label: tx(gr.short || gr.label), up: tx(gr.label).toLocaleUpperCase(LOC()), count: gr.items.length, open, onMenu: mn("v:" + gr.id),
              btnStyle: "height:28px;padding:0 8px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;flex:none;" + (open ? "background:var(--tint);border:1px solid var(--tintline);color:var(--brandink)" : "background:var(--card);border:1px solid var(--line);color:var(--ink)"),
              items: gr.items.map(it => ({ label: tx(it[1]), onInsert: close(() => app.insertVar(it[0])) })),
            }; }),
            listDD: listDefs.map(l => ({ ...l, menuOpen: M === "l:" + l.key, onMenu: mn("l:" + l.key), onTableC: () => { l.onTable(); if (((s.tbCols || {})[l.key] || []).length) app.setState({ rbMenu: null }); }, onRepeatC: close(l.onRepeat) })),
            mnMg: mn("mg"), mMg: M === "mg",
            mgPresets: [["Normal", 25.4, 25.4], ["Dar", 12.7, 12.7], ["Orta", 25.4, 19.1], ["Geniş", 25.4, 50.8]].map(p => ({ label: tx(p[0]), sub: nf(p[1]) + " × " + nf(p[2]) + " mm", mark: mk(mg.t === p[1] && mg.b === p[1] && mg.l === p[2] && mg.r === p[2]), onPick: close(() => setDr({ margins: { t: p[1], b: p[1], l: p[2], r: p[2] } })) })),
            mnOr: mn("or"), mOr: M === "or", orOpts: [["portrait", "Dikey"], ["landscape", "Yatay"]].map(o => ({ label: tx(o[1]), mark: mk((dr.orient || "portrait") === o[0]), onPick: close(() => setDr({ orient: o[0] })) })),
            mnSz: mn("sz"), mSz: M === "sz", szOpts: Object.keys(PAGE_SIZES).map(k => ({ label: k, sub: nf(PAGE_SIZES[k][0]) + " × " + nf(PAGE_SIZES[k][1]) + " mm", mark: mk((dr.size || "A4") === k), onPick: close(() => setDr({ size: k })) })),
            mnPn: mn("pn"), mPn: M === "pn",
            tsOpts: [["hdr", "Başlık satırı"], ["band", "Şeritli satırlar"], ["fc", "İlk sütun"]].map(o => { const on = !!f[o[0]]; return { label: tx(o[1]), mark: mk(on), boxStyle: cbox(on), onToggle: () => app.tblOp(o[0]) }; }),
            mnSh: mn("sh"), mSh: M === "sh", shColors: SH_COLORS.map(c => sw(c, () => { app.tblOp("shade", c); app.setState({ lastSh: c }); })), rbShNone: close(() => app.tblOp("shade", "none")),
            rbShApply: () => app.tblOp("shade", s.lastSh || "#e9eefb"), shBarStyle: "border-bottom:3px solid " + (s.lastSh || "#e9eefb") + ";padding-bottom:1px",
            mnBc: mn("bc"), mBc: M === "bc", bcColors: BC_COLORS.map(c => sw(c, () => app.tblOp("bcolor", c))), bcBarStyle: "font-size:12px;line-height:1;border-bottom:3px solid " + (f.bc || "#444444") + ";padding:0 1px 1px",
            mnBm: mn("bm"), mBm: M === "bm", bmOpts: [["all", "Tüm kenarlıklar"], ["outer", "Dış kenarlıklar"], ["horiz", "Yalnız yatay çizgiler"], ["none", "Kenarlık yok"]].map(o => ({ label: tx(o[1]), mark: mk((f.bm || "all") === o[0]), onPick: close(() => app.tblOp("bmode", o[0])) })),
            fmtBw: f.bw || "1px", bwOpts: [["0.5pt", "½ pt"], ["1px", "¾ pt"], ["1pt", "1 pt"], ["1.5pt", "1½ pt"], ["2.25pt", "2¼ pt"], ["3pt", "3 pt"]].map(o => ({ v: o[0], label: o[1] })), onBw: (e) => app.tblOp("bwidth", e.target.value),
            tbRowA: () => app.edTable("rowA"), tbColL: () => app.edTable("colL"),
            mnDel: mn("del"), mDel: M === "del", tbRowDelC: close(() => app.edTable("row-")), tbColDelC: close(() => app.edTable("col-")), tbTblDelC: close(() => app.edTable("del")),
            tbMerge: () => app.tblOp("merge"), tbDist: () => app.tblOp("dist"), tbSplit: () => app.tblOp("split"),
            tbColNar: () => app.tblOp("colw", -5), tbColWid: () => app.tblOp("colw", 5),
            tbRowDec: () => app.tblOp("rowh", -2), tbRowInc: () => app.tblOp("rowh", 2), tbRowAuto: () => app.tblOp("rowh", "auto"),
            fmtColW: f.colW ? "%" + f.colW : "—", fmtRowH: f.rowH ? nf(f.rowH) + " mm" : tx("Oto"),
            stepBtn: "height:26px;width:26px;flex:none;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink);cursor:pointer;font-size:14px;font-weight:700;line-height:1;padding:0;display:flex;align-items:center;justify-content:center",
            mnTw: mn("tw"), mTw: M === "tw", twOpts: [["50%", "%50"], ["75%", "%75"], ["100%", "%100"], ["auto", "Otomatik"]].map(o => ({ label: tx(o[1]), mark: "", onPick: close(() => app.tblOp("width", o[0])) })),
            mnPad: mn("pad"), mPad: M === "pad", padOpts: [["2px 4px", "Dar"], ["5px 7px", "Normal"], ["8px 11px", "Geniş"]].map(o => ({ label: tx(o[1]), mark: "", onPick: close(() => app.tblOp("pad", o[0])) })),
            tbVaT: () => app.tblOp("valign", "top"), tbVaM: () => app.tblOp("valign", "middle"), tbVaB: () => app.tblOp("valign", "bottom"),
            stVaT: tg(f.va === "top"), stVaM: tg(f.va === "middle"), stVaB: tg(f.va === "bottom"),
            imgBorders: [["", "Yok"], ["1px solid #444", "İnce"]].map(o => ({ label: tx(o[1]), onPick: () => app.edImgSet({ border: o[0] }) })),
          };
        })(),
      };
    }
    let genVals = { genOpen: false };
    const gen = s.gen;
    if (gen) {
      const gt = s.templates.filter(t => (t.contexts || []).indexOf(gen.kind) > -1);
      const gcur = gt.find(t => t.id === gen.tplId) || gt[0] || null;
      const gctx = app.buildCtx(gen.kind, gen), subj = app.genSubject(gen);
      app._sh.genPaper = gcur ? app.paperHtml(gcur, gctx) : "";
      const pw = gcur ? Math.round(geom(gcur).w * 3.7795) : 794;
      const availW = isDesktop ? Math.min(s.vw, 1180) - 28 - 260 - 34 - 24 : s.vw - 28 - 34 - 20;
      genVals = {
        genOpen: true, genSubject: ctxLabel(gen.kind) + " · " + subj,
        genPaperLabel: gcur ? gcur.name + " · " + (gcur.size || "A4") + " " + ((gcur.orient || "portrait") === "landscape" ? tx("Yatay") : tx("Dikey")) : "",
        zLblGen: (s.zoomLbl || {}).gen || "100%", zOutGen: () => app.zoomStep("gen", -1), zInGen: () => app.zoomStep("gen", 1),
        zFitGen: () => app.zoomSet("gen", "fit"), z100Gen: () => app.zoomSet("gen", 1), zFitGenStyle: optChip((s.zoom || {}).gen === "fit"),
        genTpls: gt.map(t => { const on = gcur && t.id === gcur.id; return {
          name: t.name, onPick: () => app.setState(st => ({ gen: { ...st.gen, tplId: t.id } })),
          style: (isDesktop ? "width:100%;text-align:left;padding:10px 11px;line-height:1.35;" : "flex:none;white-space:nowrap;height:36px;padding:0 12px;") + "border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;" + (on ? "background:var(--tint);color:var(--brandink);border:1px solid var(--tintline)" : "background:transparent;color:var(--ink);border:1px solid " + (isDesktop ? "transparent" : "var(--line)")),
        }; }),
        genNoTpl: !gt.length, genHasTpl: !!gcur, canTpl,
        genPaperRef: app.slotRef("genPaper"), genZoom: String(Math.min(1, Math.max(0.3, availW / pw))),
        genBodyStyle: "flex:1;min-height:0;display:flex;" + (isDesktop ? "flex-direction:row" : "flex-direction:column"),
        genSideStyle: isDesktop ? "width:260px;flex:none;border-right:1px solid var(--line2);padding:14px;display:flex;flex-direction:column;gap:4px;overflow-y:auto" : "flex:none;padding:10px 14px;display:flex;gap:6px;overflow-x:auto;border-bottom:1px solid var(--line2)",
        genCanSave: gen.kind === "project" && app.perm("files"),
        genBusyLabel: { pdf: tx("PDF hazırlanıyor…"), word: tx("Word belgesi hazırlanıyor…"), save: tx("Projeye kaydediliyor…") }[s.genBusy] || "",
        closeGen: () => app.setState({ gen: null }),
        goTemplatesFromGen: () => app.setState({ gen: null, tab: "templates" }),
        genPdf: () => gcur && app.genRun("pdf", gcur, gctx, subj, gen),
        genPrint: () => gcur && app.genRun("print", gcur, gctx, subj, gen),
        genWord: () => gcur && app.genRun("word", gcur, gctx, subj, gen),
        genSave: () => gcur && app.genRun("save", gcur, gctx, subj, gen),
      };
    } else app._sh.genPaper = "";
    clearTimeout(app._slotT); app._slotT = setTimeout(() => app.applySlots(), 0);
    Object.assign(c, { canTpl, ctxLabel, segBtn, optChip, cbox, tplCards, dr, tplVals, genVals, gen });
  return () => {
    const { s, sh } = c; /*LATE*/
    return {
      ...tplVals, ...genVals,
      isTemplates: s.tab === "templates", tplListMode: !dr, tplEditMode: !!dr,
      tplCards, noTpls: !s.templates.length, canTpl,
      newTpl: () => app.openTpl(blankTpl(), true),
      tplBack: () => { if (s.tplDirty) return app.setState({ sheet: { type: "tplLeave" } }); app.closeTpl(); },
      tplLeaveSave: () => { app.saveTpl().then((ok) => { if (ok) { app.setState({ sheet: null }); app.closeTpl(); } }); },
      tplLeaveDiscard: () => { app.setState({ sheet: null }); app.closeTpl(); },
      sheetIsTplLeave: sh.type === "tplLeave",
    };
  };
}
