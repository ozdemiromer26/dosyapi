// @ts-nocheck -- DOM yoğun, prototipten taşınmış düzenleyici kodu; davranış E2E testiyle doğrulanır.
// Belge üretimi: şablon doldurma, sayfalama, PDF, Word ve yazdırma.
import { tx, LOC } from "../i18n";
import { STATUS_LABEL } from "../domain/constants";
import { geom, renderTpl, SLOT_ZOOM, esc, hasContent } from "../documents/template";
import { htmlToDocx } from "../documents/docx";
import { cleanHtml } from "../documents/sanitize";
import { alignPrintBands, printFrame } from "../documents/print";
import { tplPayload } from "../api/mappers";
import { EditorController } from "./EditorController";

export class DocumentController extends EditorController {
  openTpl(t, isNew) {
    this._zh = { header: t.header || "", body: t.body || "<p><br></p>", footer: t.footer || "" };
    this._range = null; this._zone = "body"; this._img = null; this._fmtJ = ""; this.histReset();
    this.setState({ rbTab: "home", rbMenu: null, fmt: {}, tplDraft: { ...t, margins: Object.assign({ t: 20, r: 20, b: 20, l: 20 }, t.margins || {}) }, tplMode: "edit", tplDirty: !!isNew, edPop: null, edInTable: false, edImg: false, tplSide: "vars", varQ: "" });
  }
  closeTpl() { this._zh = {}; this.setState({ tplDraft: null, tplDirty: false, edPop: null, edInTable: false, edImg: false }); }
  async saveTpl() {
    const d = this.state.tplDraft; if (!d) return false;
    this.syncZones(true);
    const name = (d.name || "").trim();
    if (!name) { this.toast(tx("Şablon adı zorunlu.")); return false; }
    if (!(d.contexts || []).length) { this.toast(tx("En az bir kullanım yeri seçin.")); return false; }
    const body = tplPayload({ ...d, name, header: this._zh.header || "", body: this._zh.body || "", footer: this._zh.footer || "" });
    try {
      const saved = await this.api.put("/templates", body);
      await this.refresh();
      this.setState({ tplDraft: { ...d, id: saved.id, name }, tplDirty: false });
      this.toast(tx("Şablon kaydedildi."));
      return true;
    } catch (e) { this.fail(e); return false; }
  }
  authorMiss(p) {
    const s = this.state, ids = (p && p.authorIds) || [];
    return (s.professions || []).filter(pf => (s.profRequired || {})[pf] !== false).filter(pf => !ids.some(id => { const a = s.authors.find(x => x.id === id); return a && a.job === pf; }));
  }
  openGen(kind, d, prefer) {
    if (kind === "project") { const pr = this.state.projects.find(p => p.id === (d || {}).projectId), miss = pr ? this.authorMiss(pr) : []; if (miss.length) return this.toast(tx("Önce her meslek için bir müellif atayın: ") + miss.join(", ")); }
    this.setState({ gen: { kind, ...d, tplId: prefer || null }, notifOpen: false, sheet: null }); }
  genSubject(g) {
    const s = this.state;
    if (g.kind === "project") return (s.projects.find(p => p.id === g.projectId) || {}).name || "";
    if (g.kind === "contractor") return (s.contractors.find(c => c.id === g.contractorId) || {}).title || "";
    const ids = g.ids || [], pr = g.projectId && s.projects.find(p => p.id === g.projectId);
    const one = ids.length === 1 ? s.authors.find(a => a.id === ids[0]) : null;
    return one ? one.first + " " + one.last : ids.length + tx(" müellif") + (pr ? " · " + pr.name : "");
  }
  buildCtx(kind, d) {
    const s = this.state; d = d || {};
    const now = new Date(), A = (id) => s.authors.find(a => a.id === id);
    let project = null, authors = [], contractor = null;
    if (kind === "project") { project = s.projects.find(p => p.id === d.projectId) || null; authors = project ? (project.authorIds || []).map(A).filter(Boolean) : []; }
    if (kind === "authors") { authors = (d.ids || []).map(A).filter(Boolean); project = d.projectId ? (s.projects.find(p => p.id === d.projectId) || null) : null; }
    if (kind === "contractor") contractor = s.contractors.find(c => c.id === d.contractorId) || null;
    if (project && !contractor) contractor = s.contractors.find(c => c.id === project.contractorId) || { title: project.contractor };
    const pAuthors = project ? (project.authorIds || []).map(A).filter(Boolean) : authors;
    const mimar = pAuthors.find(a => /mimar/i.test(a.job || "")) || null;
    const owners = project ? (project.owners || []) : [];
    const proxy = (project && project.proxy) || {};
    const au = (a) => a ? { adSoyad: ((a.first || "") + " " + (a.last || "")).trim(), tc: a.tc || "", telefon: a.phone || "", meslek: a.job || "", sirket: a.company || "", sicil: a.sicil || "", adres: a.address || "" } : {};
    const v = {};
    const put = (pre, o) => Object.keys(o).forEach(k => { v[pre + "." + k] = o[k]; });
    const ref = project || contractor || authors[0] || {};
    const pad = (x) => String(x).padStart(2, "0");
    put("genel", { tarih: pad(now.getDate()) + "." + pad(now.getMonth() + 1) + "." + now.getFullYear(), tarihUzun: now.toLocaleDateString(LOC(), { day: "numeric", month: "long", year: "numeric" }), sirket: s.company.name, belgeNo: "BLG-" + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + "-" + String(ref.id || "0").toUpperCase().slice(0, 4) });
    if (project) put("proje", {
      adi: project.name, ada: project.ada, parsel: project.parsel, pafta: project.pafta || "", mahalle: project.mahalle || "", cadde: project.street || "",
      adres: [project.mahalle, project.street].filter(Boolean).join(", "), durum: STATUS_LABEL(project.status || (project.done ? "iskan" : "uygulama")),
      belgeDurumu: s.docTypes.map(dt => dt.name + ": " + ((project.docs || {})[dt.id] ? tx("var") : dt.required ? tx("EKSİK") : "—")).join(", "), not: project.note || "",
    });
    if (contractor) put("muteahhit", { unvan: contractor.title || "", yetkili: contractor.owner || "", yetkiNo: contractor.licence || "", sinif: contractor.rank || "", adres: contractor.address || "" });
    put("mimar", au(mimar)); put("muellif", au(authors[0]));
    const o0 = owners[0] || {};
    put("arsaSahibi", { ad: o0.name || "", tc: o0.tc || "", telefon: o0.phone || "", adres: o0.address || "", hisse: o0.share || "" });
    put("vekil", { ad: proxy.name || "", tc: proxy.tc || "", telefon: proxy.phone || "", adres: proxy.address || "" });
    return { brand: s.palette && s.palette.pri, vals: v, lists: {
      muellifler: authors.map((a, i) => ({ sira: i + 1, ...au(a) })),
      arsaSahipleri: owners.map((o, i) => ({ sira: i + 1, ad: o.name || "", tc: o.tc || "", telefon: o.phone || "", adres: o.address || "", hisse: o.share || "", imza: "" })),
    } };
  }
  paperHtml(t, ctx) {
    const g = geom(t), px = (mm) => Math.round(mm * 3.7795);
    const H = renderTpl(t.header, ctx, "screen"), F = renderTpl(t.footer, ctx, "screen");
    const segs = renderTpl(t.body, ctx, "print").split("@@PB@@");
    const hH = hasContent(H), hF = hasContent(F);
    const pn = t.pageNo ? '<div data-pn="1" style="margin-top:6px;font-family:Arial,sans-serif;font-size:9pt;color:#555;text-align:' + (t.pageNoPos || "right") + '"></div>' : "";
    const sheet = (b) => '<div data-sheet="1" data-h="' + px(g.h) + '" style="width:' + px(g.w) + "px;height:" + px(g.h) + "px;box-sizing:border-box;background:#fff;color:#111;text-align:left;box-shadow:0 2px 14px rgba(0,0,0,.14);padding:" + px(g.m.t) + "px " + px(g.m.r) + "px " + px(g.m.b) + "px " + px(g.m.l) + "px;font-family:" + t.font + ";font-size:" + t.fontSize + 'pt;line-height:1.4;display:flex;flex-direction:column;overflow:hidden;margin:0 0 18px">' + (hH ? '<div style="flex:none;margin-bottom:10px">' + H + "</div>" : "") + '<div data-b="1" style="flex:1 1 auto;min-height:0;overflow:hidden">' + b + "</div>" + (hF || pn ? '<div style="flex:none;margin-top:10px">' + (hF ? F : "") + pn + "</div>" : "") + "</div>";
    return '<div data-zin="1" style="width:' + px(g.w) + 'px">' + segs.map(sheet).join("") + "</div>";
  }
  paginate(root) {
    if (!root) return;
    const list = () => Array.from(root.querySelectorAll("[data-sheet]"));
    let i = 0, guard = 0;
    while (i < list().length && guard++ < 300) {
      const sh = list()[i], body = sh.querySelector("[data-b]");
      const over = () => body.scrollHeight > body.clientHeight + 1;
      if (body && over()) {
        const nx = sh.cloneNode(true), nb = nx.querySelector("[data-b]"); nb.innerHTML = "";
        let moved = false;
        while (over()) {
          const last = body.lastElementChild;
          if (last && last.tagName === "TABLE" && this.splitTableRow(last, nb)) { moved = true; continue; }
          if (body.children.length < 2) break;
          nb.insertBefore(last, nb.firstChild);
          moved = true;
        }
        if (moved) sh.parentNode.insertBefore(nx, sh.nextSibling);
        else { sh.style.height = "auto"; sh.style.minHeight = sh.getAttribute("data-h") + "px"; body.style.overflow = "visible"; }
      }
      i++;
    }
    const all = list();
    all.forEach((s, j) => { s.querySelectorAll("[data-pn]").forEach(p => { p.textContent = tx("Sayfa") + " " + (j + 1) + " / " + all.length; }); if (j === all.length - 1) s.style.marginBottom = "0"; });
  }
  /** Uzun tablonun son satırını sonraki sayfadaki devam tablosuna taşır; başlık satırı tekrar eder. */
  splitTableRow(table, nextBody) {
    const rows = Array.from(table.tBodies[0] ? table.tBodies[0].rows : table.rows);
    if (rows.length < 2) return false;
    let tail = nextBody.firstElementChild;
    if (!tail || !tail.hasAttribute("data-cont")) {
      tail = table.cloneNode(false);
      tail.setAttribute("data-cont", "1");
      const cols = table.querySelector(":scope > colgroup");
      if (cols) tail.appendChild(cols.cloneNode(true));
      if (table.tHead) tail.appendChild(table.tHead.cloneNode(true));
      tail.appendChild(document.createElement("tbody"));
      nextBody.insertBefore(tail, nextBody.firstChild);
    }
    const tbody = tail.tBodies[0];
    tbody.insertBefore(rows[rows.length - 1], tbody.firstChild);
    return true;
  }
  watchZoom(k, wrap) {
    this._zw = this._zw || {}; this._zro = this._zro || {};
    if (this._zro[k]) { this._zro[k].disconnect(); this._zro[k] = null; }
    this._zw[k] = wrap;
    const area = wrap && wrap.closest ? wrap.closest("[data-zarea]") : null;
    if (!area) return;
    if (!area._zwheel) {
      area._zwheel = true;
      area.addEventListener("wheel", (e) => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); this.zoomStep(k, e.deltaY < 0 ? 1 : -1); }, { passive: false });
    }
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { this._zraf = this._zraf || {}; cancelAnimationFrame(this._zraf[k]); this._zraf[k] = requestAnimationFrame(() => this.layoutZoom(k)); });
    ro.observe(area); if (wrap.firstElementChild) ro.observe(wrap.firstElementChild);
    this._zro[k] = ro;
  }
  layoutZoom(k) {
    const wrap = (this._zw || {})[k]; if (!wrap || !wrap.isConnected) return;
    const inner = wrap.firstElementChild; if (!inner) return;
    const area = wrap.closest("[data-zarea]") || wrap.parentNode, cs = getComputedStyle(area);
    const W = inner.offsetWidth, H = inner.offsetHeight; if (!W) return;
    const aw = area.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
    const zs = (this.state.zoom || {})[k];
    const z = typeof zs === "number" ? zs : Math.max(0.25, Math.min(1, aw / W));
    inner.style.transformOrigin = "0 0"; inner.style.transform = "scale(" + z + ")";
    wrap.style.width = Math.ceil(W * z) + "px"; wrap.style.height = Math.ceil(H * z) + "px"; wrap.style.margin = "0 auto";
    this._zcur = this._zcur || {}; this._zcur[k] = z;
    const lbl = Math.round(z * 100) + "%";
    if ((this.state.zoomLbl || {})[k] !== lbl) this.setState(st => ({ zoomLbl: { ...(st.zoomLbl || {}), [k]: lbl } }));
  }
  zoomStep(k, dir) {
    const z = (this._zcur || {})[k] || 1;
    const nz = dir > 0 ? Math.min(2, (Math.floor(z * 10 + 0.001) + 1) / 10) : Math.max(0.3, (Math.ceil(z * 10 - 0.001) - 1) / 10);
    this.setState(st => ({ zoom: { ...(st.zoom || {}), [k]: nz } }), () => this.layoutZoom(k));
  }
  zoomSet(k, v) { this.setState(st => ({ zoom: { ...(st.zoom || {}), [k]: v } }), () => this.layoutZoom(k)); }
  printHtml(t, ctx, title) {
    const g = geom(t), m = g.m;
    const H = renderTpl(t.header, ctx, "print").replace(/@@PB@@/g, ""), F = renderTpl(t.footer, ctx, "print").replace(/@@PB@@/g, "");
    const segs = renderTpl(t.body, ctx, "print").split("@@PB@@");
    const hH = hasContent(H), hF = hasContent(F);
    const boxName = { left: "bottom-left", center: "bottom-center", right: "bottom-right" }[t.pageNoPos || "right"];
    const pn = t.pageNo ? "@" + boxName + '{content:"' + tx("Sayfa") + ' " counter(page) " / " counter(pages);font-family:Arial,sans-serif;font-size:9pt;color:#555}' : "";
    const seg = (h) => '<table class="pg"><thead><tr><td><div class="sh"></div></td></tr></thead><tfoot><tr><td><div class="sf"></div></td></tr></tfoot><tbody><tr><td>' + h + "</td></tr></tbody></table>";
    const css = "@page{size:" + (t.size === "Letter" ? "letter" : t.size) + " " + g.or + ";margin:" + m.t + "mm " + m.r + "mm " + m.b + "mm " + m.l + "mm;" + pn + "}html,body{margin:0;padding:0;background:#fff}body{font-family:" + t.font + ";font-size:" + t.fontSize + "pt;color:#111;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}.pg{width:100%;border-collapse:collapse}.pg>thead>tr>td,.pg>tfoot>tr>td,.pg>tbody>tr>td{padding:0;border:0}.brk{break-after:page;page-break-after:always;height:0}#H{position:fixed;top:0;left:0;right:0}#F{position:fixed;bottom:0;left:0;right:0}img{max-width:100%}@media screen{body{padding:" + m.t + "mm " + m.r + "mm " + m.b + "mm " + m.l + "mm;max-width:" + g.w + "mm;box-sizing:border-box;margin:0 auto}#H,#F{position:static}.sh,.sf{display:none}}";
    return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>" + esc(title) + "</title><style>" + css + "</style></head><body>" + (hH ? '<div id="H">' + H + "</div>" : "") + segs.map(seg).join('<div class="brk"></div>') + (hF ? '<div id="F">' + F + "</div>" : "") + "</body></html>";
  }
  /** Belgeyi görünmez alanda sayfalar ve her sayfayı metin olarak PDF'e yazar. */
  async pdfTpl(t, ctx, title) {
    const g = geom(t);
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;left:-20000px;top:0;";
    host.innerHTML = cleanHtml(this.paperHtml(t, ctx));
    document.body.appendChild(host);
    try {
      await Promise.all(Array.from(host.querySelectorAll("img")).map(img => img.decode().catch(() => {})));
      this.paginate(host.firstElementChild);
      const { sheetsToPdf } = await import("../documents/pdf");
      return await sheetsToPdf(host, { widthMm: g.w, heightMm: g.h, format: g.fmt, orientation: g.or, title, lang: LOC() === "tr-TR" ? "tr" : "en" });
    } finally { host.remove(); }
  }
  saveBlob(blob, name) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    this.toast(name + tx(" indiriliyor."));
  }
  async wordTpl(t, ctx, fname) {
    const blob = await htmlToDocx({
      header: renderTpl(t.header, ctx, "word"), body: renderTpl(t.body, ctx, "word"), footer: renderTpl(t.footer, ctx, "word"),
      font: t.font, fontSize: t.fontSize, pageNo: !!t.pageNo, pageNoPos: t.pageNoPos || "right", pageLabel: tx("Sayfa"), geometry: geom(t),
    });
    this.saveBlob(blob, fname + ".docx");
  }
  async genRun(kind, t, ctx, subj, gen) {
    if (this.state.genBusy) return;
    const fname = (t.name + " - " + subj).replace(/[\\/:*?"<>|]+/g, "").trim();
    if (kind === "print") {
      printFrame(this.printHtml(t, ctx, fname), alignPrintBands);
      return;
    }
    this.setState({ genBusy: kind });
    try {
      if (kind === "word") await this.wordTpl(t, ctx, fname);
      else {
        const pdf = await this.pdfTpl(t, ctx, fname);
        if (kind === "pdf") { pdf.save(fname + ".pdf"); this.toast(fname + ".pdf" + tx(" indiriliyor.")); }
        else {
          const blob = pdf.output("blob");
          await this.api.upload("/projects/" + gen.projectId + "/files?name=" + encodeURIComponent(fname + ".pdf"), blob);
          await this.refresh();
          this.toast(tx("Belge projenin ek dosyalarına kaydedildi."));
        }
      }
    } catch (e) { this.toast(tx("Belge oluşturulamadı.")); }
    this.setState({ genBusy: "" });
  }
  applyTheme() { if (typeof document !== "undefined") document.body.setAttribute("data-theme", this.state.theme); }
  mkRef(n) { return this._refs[n] || (this._refs[n] = (elm) => { this.r[n] = elm; }); }
}
