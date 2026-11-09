// @ts-nocheck -- DOM yoğun, prototipten taşınmış düzenleyici kodu; davranış E2E testiyle doğrulanır.
// Belge şablonu düzenleyicisi: içerik alanları, seçim, tablo ve geçmiş işlemleri.
import { tx, LOC } from "../i18n";
import { SIZES, FONTS } from "../domain/constants";
import { V, TABLE, PB_HTML, varLabel, SLOT_ZOOM } from "../documents/template";
import { cleanHtml } from "../documents/sanitize";
import { AppCore } from "./AppCore";

export class EditorController extends AppCore {
  slotRef(name) {
    this._sr = this._sr || {};
    return this._sr[name] || (this._sr[name] = (el) => {
      this._se = this._se || {}; this._se[name] = el;
      if (el) { const h = (this._sh || {})[name] || ""; el.innerHTML = cleanHtml(h); el._h = h; this.afterSlot(name, el); }
      else this.watchZoom(SLOT_ZOOM[name], null);
    });
  }
  afterSlot(name, el) { this.paginate(el.firstElementChild); this.watchZoom(SLOT_ZOOM[name], el); this.layoutZoom(SLOT_ZOOM[name]); }
  applySlots() {
    const se = this._se || {}, sh = this._sh || {};
    Object.keys(se).forEach(k => { const el = se[k]; const h = sh[k] || ""; if (el && el.isConnected && el._h !== h) { el.innerHTML = cleanHtml(h); el._h = h; this.afterSlot(k, el); } });
  }
  zoomWrapRef(k) {
    this._zwr = this._zwr || {};
    return this._zwr[k] || (this._zwr[k] = (el) => { this.watchZoom(k, el); if (el) requestAnimationFrame(() => this.layoutZoom(k)); });
  }
  zoneRef(z) {
    this._zr = this._zr || {};
    return this._zr[z] || (this._zr[z] = (el) => {
      this._ze = this._ze || {};
      if (!el) { delete this._ze[z]; return; }
      this._ze[z] = el;
      el.contentEditable = "true"; el.spellcheck = false;
      el.innerHTML = cleanHtml(this._zh[z] || "");
      this.relabel(el);
      el.oninput = () => this.syncZones(false, true);
      el.onfocus = () => { this._zone = z; try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) {} };
      el.onpointermove = (e) => { if (this._drag || e.pointerType === "touch") return; const h = this.tblHit(e, el), cu = h ? (h.kind === "col" ? "col-resize" : "row-resize") : ""; if (el.style.cursor !== cu) el.style.cursor = cu; };
      el.onpointerdown = (e) => { if (e.button !== 0) return; const h = this.tblHit(e, el); if (!h) return; e.preventDefault(); this.tblDrag(e, h, el); };
      // Dokunmatikte kenardan başlayan hareket sayfayı kaydırmasın, tabloyu boyutlandırsın.
      el.addEventListener("touchstart", (e) => { const t = e.touches[0]; if (t && this.tblHit({ target: t.target, clientX: t.clientX, clientY: t.clientY, pointerType: "touch" }, el)) e.preventDefault(); }, { passive: false });
      el.onclick = (e) => { const img = e.target && e.target.tagName === "IMG" ? e.target : null; this._img = img; if (!!img !== !!this.state.edImg) this.setState({ edImg: !!img }); };
      el.onkeydown = (e) => {
        if (!(e.metaKey || e.ctrlKey)) return;
        const k = (e.key || "").toLowerCase();
        if (k === "s") { e.preventDefault(); this.saveTpl(); }
        else if (k === "z" && !e.shiftKey) { e.preventDefault(); this.histGo(-1); }
        else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); this.histGo(1); }
      };
    });
  }
  relabel(root) {
    root.querySelectorAll("[data-v]").forEach(n => { n.textContent = varLabel(n.getAttribute("data-v")); n.setAttribute("contenteditable", "false"); });
    root.querySelectorAll("[data-pb]").forEach(n => n.setAttribute("contenteditable", "false"));
  }
  syncZones(silent, typing) {
    const ze = this._ze || {};
    Object.keys(ze).forEach(z => { this._zh[z] = ze[z].innerHTML; });
    if (!silent && !this.state.tplDirty) this.setState({ tplDirty: true });
    if (!silent) this.histPush(typing);
  }
  histReset() { clearTimeout(this._ht); this._ht = null; this._hs = [JSON.stringify(this._zh || {})]; this._hi = 0; }
  histPush(typing) {
    clearTimeout(this._ht); this._ht = null;
    if (typing) { this._ht = setTimeout(() => { this._ht = null; this.histPush(false); }, 450); return; }
    if (!this._hs) this.histReset();
    const cur = JSON.stringify(this._zh || {});
    if (this._hs[this._hi] === cur) return;
    this._hs = this._hs.slice(0, this._hi + 1); this._hs.push(cur);
    if (this._hs.length > 150) this._hs.shift();
    this._hi = this._hs.length - 1;
    this.setState(st => ({ histTick: (st.histTick || 0) + 1 }));
  }
  histGo(d) {
    if (this._ht) { this.syncZones(true); this.histPush(false); }
    if (!this._hs) return;
    const ni = this._hi + d; if (ni < 0 || ni >= this._hs.length) return;
    this._hi = ni; this._zh = JSON.parse(this._hs[ni]);
    const ze = this._ze || {};
    Object.keys(ze).forEach(z => { ze[z].innerHTML = cleanHtml(this._zh[z] || ""); this.relabel(ze[z]); });
    this._range = null; this._img = null;
    const el = ze[this._zone] || ze.body;
    if (el) { el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); this._range = r.cloneRange(); }
    this.setState(st => ({ tplDirty: true, edInTable: false, edImg: false, histTick: (st.histTick || 0) + 1 }));
  }
  tblState(t) {
    const c0 = t.rows[0] && t.rows[0].cells[0];
    return { hdr: t.dataset.hdr ? t.dataset.hdr === "1" : !!(c0 && c0.tagName === "TH"), band: t.dataset.band === "1", fc: t.dataset.fc === "1", bc: t.dataset.bc || "#444444", bw: t.dataset.bw || "1px", bm: t.dataset.bm || "all" };
  }
  tblCtx() {
    const el = this.restoreSel(); if (!el || !this._range) return null;
    let n = this._range.startContainer; n = n.nodeType === 1 ? n : n.parentNode;
    const cell = n && n.closest ? n.closest("td,th") : null; if (!cell || !el.contains(cell)) return null;
    const table = cell.closest("table"), r = this._range;
    let cells = Array.from(table.querySelectorAll("td,th")).filter(c => c.closest("table") === table && r.intersectsNode(c));
    if (!cells.length) cells = [cell];
    return { el, cell, table, cells, tr: cell.parentNode };
  }
  tblBorders(t) {
    const st = this.tblState(t), b = st.bw + " solid " + st.bc, rows = Array.from(t.rows), last = rows.length - 1;
    rows.forEach((rw, ri) => { const cs = Array.from(rw.cells); cs.forEach((x, ci) => {
      if (st.bm === "all") { x.style.border = b; return; }
      x.style.border = "none";
      if (st.bm === "horiz") { x.style.borderTop = b; x.style.borderBottom = b; }
      if (st.bm === "outer") { if (ri === 0) x.style.borderTop = b; if (ri === last) x.style.borderBottom = b; if (ci === 0) x.style.borderLeft = b; if (ci === cs.length - 1) x.style.borderRight = b; }
    }); });
  }
  tblLook(t, op) {
    const st = this.tblState(t), rows = Array.from(t.rows);
    if (op === "hdr" && rows[0]) Array.from(rows[0].cells).forEach(c => { c.style.background = st.hdr ? "#efefef" : "transparent"; c.style.fontWeight = st.hdr ? "700" : "400"; });
    if (st.band || op === "band") rows.forEach((r, i) => { if (st.hdr && i === 0) return; const k = i - (st.hdr ? 1 : 0); Array.from(r.cells).forEach(c => { c.style.background = st.band && k % 2 === 1 ? "#f2f3f7" : ""; }); });
    if (op === "fc" || op === "hdr") rows.forEach((r, i) => { if (st.hdr && i === 0) return; const c = r.cells[0]; if (c) c.style.fontWeight = st.fc ? "700" : ""; });
  }
  tblN(t) { return Math.max(1, ...Array.from(t.rows).map(rw => Array.from(rw.cells).reduce((a, x) => a + (x.colSpan || 1), 0))); }
  cellCol(cell) { let k = 0; for (const x of Array.from(cell.parentNode.cells)) { if (x === cell) return k; k += x.colSpan || 1; } return k; }
  tblGrid(t) {
    const n = this.tblN(t), cg = t.querySelector(":scope > colgroup");
    let ws = null;
    if (cg && cg.children.length === n) { ws = Array.from(cg.children).map(x => parseFloat(x.style.width) || 0); if (ws.some(w => !(w > 0))) ws = null; }
    if (!ws) {
      const tw = t.getBoundingClientRect().width || 1, ref = Array.from(t.rows).find(rw => rw.cells.length === n);
      ws = ref ? Array.from(ref.cells).map(x => Math.max(0.5, x.getBoundingClientRect().width / tw * 100)) : Array(n).fill(100 / n);
    }
    const sm = ws.reduce((a, b) => a + b, 0) || 1;
    return ws.map(w => w * 100 / sm);
  }
  tblSetCols(t, ws) {
    const sm = ws.reduce((a, b) => a + b, 0) || 1; ws = ws.map(w => w * 100 / sm);
    t.style.tableLayout = "fixed";
    let cg = t.querySelector(":scope > colgroup");
    if (!cg) { cg = document.createElement("colgroup"); t.insertBefore(cg, t.firstChild); }
    cg.innerHTML = ws.map(w => '<col style="width:' + w.toFixed(2) + '%">').join("");
    Array.from(t.rows).forEach(rw => { let k = 0; Array.from(rw.cells).forEach(x => { const sp = x.colSpan || 1; x.style.width = ws.slice(k, k + sp).reduce((a, b) => a + b, 0).toFixed(2) + "%"; k += sp; }); });
  }
  rowMM(tr, measure) {
    const h = tr.style.height || "", MM = 96 / 25.4;
    if (/mm$/.test(h)) return parseFloat(h);
    if (/px$/.test(h)) return Math.round(parseFloat(h) / MM * 2) / 2;
    if (!measure) return 0;
    const t = tr.closest("table"), sc = (t.getBoundingClientRect().width / (t.offsetWidth || 1)) || 1;
    return Math.round(tr.getBoundingClientRect().height / sc / MM * 2) / 2;
  }
  tblHit(e, el) {
    const cell = e.target && e.target.closest ? e.target.closest("td,th") : null;
    if (!cell || !el.contains(cell)) return null;
    const r = cell.getBoundingClientRect(), T = e.pointerType === "touch" ? 12 : 4, x = e.clientX, y = e.clientY, tr = cell.parentNode, t = cell.closest("table");
    if (Math.abs(x - r.right) <= T) return { kind: "col", cell };
    if (Math.abs(x - r.left) <= T && cell.previousElementSibling) return { kind: "col", cell: cell.previousElementSibling };
    if (Math.abs(y - r.bottom) <= T) return { kind: "row", tr };
    const ri = Array.prototype.indexOf.call(t.rows, tr);
    if (Math.abs(y - r.top) <= T && ri > 0) return { kind: "row", tr: t.rows[ri - 1] };
    return null;
  }
  tblDrag(e, h, el) {
    const t = (h.cell || h.tr).closest("table"); if (!t) return;
    const sc = (t.getBoundingClientRect().width / (t.offsetWidth || 1)) || 1, x0 = e.clientX, y0 = e.clientY, MM = 96 / 25.4;
    let mv;
    if (h.kind === "col") {
      const ws = this.tblGrid(t), n = ws.length, k = Math.min(n - 1, this.cellCol(h.cell) + (h.cell.colSpan || 1) - 1), tw = t.offsetWidth || 1, mn = 12 / tw * 100;
      const p = t.parentNode, ps = getComputedStyle(p), pw = Math.max(tw, p.clientWidth - (parseFloat(ps.paddingLeft) || 0) - (parseFloat(ps.paddingRight) || 0));
      mv = (ev) => {
        const d = (ev.clientX - x0) / sc;
        if (k < n - 1) { const w2 = ws.slice(), dp = Math.max(mn - ws[k], Math.min(ws[k + 1] - mn, d / tw * 100)); w2[k] += dp; w2[k + 1] -= dp; this.tblSetCols(t, w2); }
        else { const nw = Math.max(Math.min(pw, 24 * n), Math.min(pw, tw + d)); t.style.width = (nw / pw * 100).toFixed(1) + "%"; if (!t.querySelector(":scope > colgroup")) this.tblSetCols(t, ws); }
      };
    } else {
      const tr = h.tr, hh = tr.getBoundingClientRect().height / sc;
      mv = (ev) => { const nh = Math.max(4 * MM, hh + (ev.clientY - y0) / sc); tr.style.height = (Math.round(nh / MM * 2) / 2) + "mm"; };
    }
    const bs = document.body.style, prevSel = bs.userSelect;
    bs.cursor = h.kind === "col" ? "col-resize" : "row-resize"; bs.userSelect = "none"; this._drag = true;
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); bs.cursor = ""; bs.userSelect = prevSel; this._drag = false; el.style.cursor = ""; this.syncZones(); this.onSel(); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  }
  tblOp(op, v) {
    const c = this.tblCtx(); if (!c) return;
    const { table, cells, tr } = c, rows = Array.from(table.rows);
    const all = Array.from(table.querySelectorAll("td,th")).filter(x => x.closest("table") === table);
    if (op === "shade") cells.forEach(x => { x.style.background = v === "none" ? "" : v; });
    if (op === "valign") cells.forEach(x => { x.style.verticalAlign = v; });
    if (op === "pad") all.forEach(x => { x.style.padding = v; });
    if (op === "width") table.style.width = v;
    if (op === "dist") { const n = this.tblN(table); this.tblSetCols(table, Array(n).fill(100 / n)); }
    if (op === "colw") {
      const ws = this.tblGrid(table), n = ws.length; if (n < 2) return this.toast(tx("Tablonun tek sütunu var."));
      const c0 = this.cellCol(c.cell), c1 = Math.min(n - 1, c0 + (c.cell.colSpan || 1) - 1), nb = c1 + 1 < n ? c1 + 1 : c0 - 1; if (nb < 0) return;
      const d = Math.max(4 - ws[c1], Math.min(ws[nb] - 4, v)); ws[c1] += d; ws[nb] -= d; this.tblSetCols(table, ws);
    }
    if (op === "rowh") { const r0 = c.cell.parentNode; if (v === "auto") r0.style.height = ""; else r0.style.height = Math.max(4, Math.round((this.rowMM(r0, true) + v) * 2) / 2) + "mm"; }
    if (op === "split") {
      const x0 = c.cell, sp = x0.colSpan || 1; if (sp < 2) return this.toast(tx("Bu hücre birleştirilmiş değil."));
      const fixed = !!table.querySelector(":scope > colgroup"); const ws = fixed ? this.tblGrid(table) : null;
      x0.removeAttribute("colspan"); if (!fixed) x0.style.width = "";
      for (let i = 1; i < sp; i++) { const y = x0.cloneNode(false); y.innerHTML = "<br>"; x0.parentNode.insertBefore(y, x0.nextSibling); }
      if (fixed) this.tblSetCols(table, ws);
    }
    if (op === "bcolor" || op === "bwidth" || op === "bmode") { table.dataset[{ bcolor: "bc", bwidth: "bw", bmode: "bm" }[op]] = v; this.tblBorders(table); }
    if (op === "hdr" || op === "band" || op === "fc") { const st = this.tblState(table); table.dataset[op] = st[op] ? "0" : "1"; this.tblLook(table, op); }
    if (op === "merge") {
      const ord = Array.from(tr.cells).filter(x => cells.indexOf(x) > -1), ix = ord.map(x => x.cellIndex);
      if (ord.length < 2 || ord.length !== cells.length || ix[ix.length - 1] - ix[0] !== ix.length - 1) return this.toast(tx("Yalnızca aynı satırdaki yan yana hücreler birleştirilebilir."));
      const ws = table.querySelector(":scope > colgroup") ? this.tblGrid(table) : null;
      const first = ord[0];
      first.colSpan = ord.reduce((a, x) => a + (x.colSpan || 1), 0);
      ord.slice(1).forEach(x => { if (x.textContent.replace(/\u200B/g, "").trim() || x.querySelector("img,[data-v]")) first.insertAdjacentHTML("beforeend", " " + x.innerHTML); x.remove(); });
      if (ws) this.tblSetCols(table, ws);
    }
    this.syncZones(); this.onSel();
  }
  selBlocks(again) {
    const el = this.restoreSel(); if (!el) return [];
    const r = this._range;
    let bs = Array.from(el.querySelectorAll("p,h1,h2,h3,li,blockquote")).filter(b => r.intersectsNode(b) && !b.querySelector("p,h1,h2,h3,li"));
    if (!bs.length) { let n = r.startContainer; n = n.nodeType === 1 ? n : n.parentNode; const b = n && n.closest ? n.closest("p,h1,h2,h3,li,td,th,div") : null; if (b && b !== el && el.contains(b)) bs = [b]; }
    if (!bs.length && !again) { document.execCommand("formatBlock", false, "<p>"); const sel = window.getSelection(); if (sel.rangeCount) this._range = sel.getRangeAt(0).cloneRange(); return this.selBlocks(true); }
    return bs;
  }
  edPara(st) { const bs = this.selBlocks(); if (!bs.length) return; bs.forEach(b => Object.assign(b.style, st)); this.syncZones(); }
  edGrow(d) {
    const cur = parseFloat((this.state.fmt || {}).size) || (this.state.tplDraft || {}).fontSize || 12;
    const nx = d > 0 ? (SIZES.find(x => x > cur) || cur) : (SIZES.slice().reverse().find(x => x < cur) || cur);
    if (nx !== cur) this.edFontSize(nx);
  }
  onSel() {
    const sel = window.getSelection(); if (!sel || !sel.rangeCount) return;
    const r = sel.getRangeAt(0), ze = this._ze || {};
    const z = Object.keys(ze).find(k => ze[k].contains(r.startContainer));
    if (!z) return;
    this._range = r.cloneRange(); this._zone = z;
    const n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentNode;
    const cell = n && n.closest ? n.closest("td,th") : null;
    const inT = !!(cell && ze[z].contains(cell));
    const q = (c) => { try { return !!document.queryCommandState(c); } catch (e) { return false; } };
    const cs = n && n.nodeType === 1 ? getComputedStyle(n) : null;
    const fam = cs ? cs.fontFamily.split(",")[0].replace(/["']/g, "").trim().toLowerCase() : "";
    const fo = FONTS.find(f => f[1].toLowerCase() === fam || f[0].split(",")[0].replace(/["']/g, "").trim().toLowerCase() === fam);
    const pt = cs ? Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2 : 0;
    const hb = n && n.closest ? n.closest("h1,h2,h3") : null;
    const tb = inT ? this.tblState(cell.closest("table")) : {};
    const al = cs ? (n.closest("p,h1,h2,h3,li,td,th,div") || n) : null, ta = al ? getComputedStyle(al).textAlign : "";
    const f = { b: q("bold"), i: q("italic"), u: q("underline"), s: q("strikeThrough"), sub: q("subscript"), sup: q("superscript"), ul: q("insertUnorderedList"), ol: q("insertOrderedList"),
      ta: ta === "start" ? "left" : ta === "end" ? "right" : ta, font: fo ? fo[0] : "", size: pt ? String(pt) : "", block: hb && ze[z].contains(hb) ? hb.tagName.toLowerCase() : "p",
      va: inT ? getComputedStyle(cell).verticalAlign : "", ...tb };
    if (inT) { try { const t = cell.closest("table"), ws = this.tblGrid(t), c0 = this.cellCol(cell); f.colW = Math.round(ws.slice(c0, c0 + (cell.colSpan || 1)).reduce((a, b) => a + b, 0)); f.rowH = this.rowMM(cell.parentNode); } catch (e) {} }
    const js = JSON.stringify(f), patch = {};
    if (inT !== !!this.state.edInTable) patch.edInTable = inT;
    if (js !== this._fmtJ) { this._fmtJ = js; patch.fmt = f; }
    if (Object.keys(patch).length) this.setState(patch);
  }
  restoreSel() {
    const ze = this._ze || {};
    const z = this._zone && ze[this._zone] ? this._zone : "body";
    const el = ze[z]; if (!el) return null;
    el.focus();
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) {}
    const sel = window.getSelection();
    if (this._range && el.contains(this._range.startContainer)) { sel.removeAllRanges(); sel.addRange(this._range); }
    else { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); this._range = r.cloneRange(); }
    this._zone = z;
    return el;
  }
  edExec(cmd, val) {
    if (cmd === "undo" || cmd === "redo") return this.histGo(cmd === "undo" ? -1 : 1);
    if (!this.restoreSel()) return;
    try { document.execCommand("styleWithCSS", false, ["foreColor", "hiliteColor", "fontName"].indexOf(cmd) > -1); } catch (e) {}
    document.execCommand(cmd, false, val);
    this.syncZones(); this.onSel();
  }
  edFontSize(pt) {
    const el = this.restoreSel(); if (!el) return;
    const sel = window.getSelection();
    if (sel.isCollapsed) {
      const sp = document.createElement("span"); sp.style.fontSize = pt + "pt"; sp.textContent = "\u200B";
      sel.getRangeAt(0).insertNode(sp);
      const nr = document.createRange(); nr.setStart(sp.firstChild, 1); nr.collapse(true); sel.removeAllRanges(); sel.addRange(nr); this._range = nr.cloneRange();
      this.syncZones(); this.onSel(); return;
    }
    try { document.execCommand("styleWithCSS", false, false); } catch (e) {}
    document.execCommand("fontSize", false, "7");
    el.querySelectorAll('font[size="7"]').forEach(f => { const sp = document.createElement("span"); sp.style.fontSize = pt + "pt"; while (f.firstChild) sp.appendChild(f.firstChild); f.replaceWith(sp); sp.querySelectorAll("[style]").forEach(x => { if (x.style.fontSize) x.style.fontSize = ""; }); });
    this.syncZones(); this.onSel();
  }
  edInsert(html, block) {
    const el = this.restoreSel(); if (!el) return;
    const t = document.createElement("template"); t.innerHTML = cleanHtml(html);
    const frag = t.content, last = frag.lastChild;
    const sel = window.getSelection(), r = sel.getRangeAt(0);
    if (block) {
      let n = r.startContainer;
      if (n === el) n = el.childNodes[Math.max(0, r.startOffset - 1)] || null;
      else while (n && n.parentNode !== el) n = n.parentNode;
      if (n) el.insertBefore(frag, n.nextSibling); else el.appendChild(frag);
    } else { r.deleteContents(); r.insertNode(frag); }
    if (last) {
      const nr = document.createRange();
      if (block) {
        let nx = last.nextSibling;
        if (!nx || nx.nodeType !== 1) { nx = document.createElement("p"); nx.innerHTML = "<br>"; last.parentNode.insertBefore(nx, last.nextSibling); }
        nr.setStart(nx, 0);
      } else {
        if (!last.nextSibling) last.parentNode.appendChild(document.createTextNode("\u200B"));
        nr.setStartAfter(last.nextSibling && last.nextSibling.nodeType === 3 && last.nextSibling.nodeValue === "\u200B" ? last.nextSibling : last);
      }
      nr.collapse(true); sel.removeAllRanges(); sel.addRange(nr); this._range = nr.cloneRange();
    }
    this.syncZones();
  }
  insertVar(key) { this.edInsert(V(key), false); }
  edTable(op) {
    const el = this.restoreSel(); if (!el || !this._range) return;
    let n = this._range.startContainer; n = n.nodeType === 1 ? n : n.parentNode;
    const cell = n && n.closest ? n.closest("td,th") : null; if (!cell || !el.contains(cell)) return;
    const tr = cell.parentNode, table = cell.closest("table"), idx = Array.prototype.indexOf.call(tr.children, cell);
    const rows = Array.from(table.rows);
    const blank = (c) => { const x = c.cloneNode(false); x.innerHTML = "<br>"; return x; };
    const fx = !!table.querySelector(":scope > colgroup"), ws0 = fx ? this.tblGrid(table) : null, c0 = this.cellCol(cell);
    let gone = false;
    if (op === "row+") { const nr = tr.cloneNode(false); nr.removeAttribute("data-repeat"); nr.style.background = ""; Array.from(tr.children).forEach(c => nr.appendChild(blank(c))); tr.parentNode.insertBefore(nr, tr.nextSibling); }
    if (op === "rowA") { const nr = tr.cloneNode(false); nr.removeAttribute("data-repeat"); nr.style.background = ""; Array.from(tr.children).forEach(c => nr.appendChild(blank(c))); tr.parentNode.insertBefore(nr, tr); }
    if (op === "colL") rows.forEach(row => { const ref = row.children[Math.min(idx, row.children.length - 1)]; if (ref) row.insertBefore(blank(ref), ref); });
    if (op === "col+") rows.forEach(row => { const ref = row.children[Math.min(idx, row.children.length - 1)]; if (ref) row.insertBefore(blank(ref), ref.nextSibling); });
    if (op === "row-") { if (table.rows.length <= 1) { table.remove(); } else tr.remove(); gone = true; }
    if (op === "col-") { if (tr.children.length <= 1) table.remove(); else rows.forEach(row => { const c = row.children[idx]; if (c) c.remove(); }); gone = true; }
    if (op === "del") { table.remove(); gone = true; }
    if (fx && table.isConnected && (op === "col+" || op === "colL" || op === "col-")) {
      let ws = ws0.slice();
      if (op === "col-") ws.splice(c0, 1); else { const h2 = ws[c0] / 2; ws.splice(c0, 1, h2, h2); }
      const n = this.tblN(table); if (ws.length !== n) ws = Array(n).fill(100 / n);
      this.tblSetCols(table, ws);
    }
    if (gone) { this._range = null; this.setState({ edInTable: false }); }
    this.syncZones();
  }
  edImgSet(st) { if (!this._img || !this._img.isConnected) return; Object.assign(this._img.style, st); this.syncZones(); }
}
