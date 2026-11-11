import { tx, LOC } from "../i18n";
import { FONTS, PAGE_SIZES, uid } from "../domain/constants";
import { cleanHtml } from "./sanitize";

const anyList = (x: any): any[] => Array.from(x);
export const VAR_GROUPS = [
  { id: "genel", label: "Genel", short: "", ctx: ["project", "authors", "contractor"], items: [["genel.tarih", "Bugünün tarihi"], ["genel.tarihUzun", "Tarih (uzun)"], ["genel.sirket", "Şirket adı"], ["genel.belgeNo", "Belge no"]] },
  { id: "proje", label: "Proje", short: "", ctx: ["project", "authors"], items: [["proje.adi", "Proje adı"], ["proje.ada", "Ada no"], ["proje.parsel", "Parsel no"], ["proje.pafta", "Pafta no"], ["proje.mahalle", "Mahalle"], ["proje.cadde", "Cadde / sokak"], ["proje.adres", "Proje adresi"], ["proje.durum", "Proje durumu"], ["proje.belgeDurumu", "Belge durumu"], ["proje.not", "Proje notu"]] },
  { id: "muteahhit", label: "Müteahhit", short: "Müteahhit", ctx: ["project", "authors", "contractor"], items: [["muteahhit.unvan", "Firma unvanı"], ["muteahhit.yetkili", "Yetkili"], ["muteahhit.yetkiNo", "Yetki belge no"], ["muteahhit.sinif", "Sınıfı"], ["muteahhit.adres", "Adres"]] },
  { id: "mimar", label: "Projenin mimarı", short: "Mimar", ctx: ["project", "authors"], items: [["mimar.adSoyad", "Ad Soyad"], ["mimar.tc", "TC No"], ["mimar.sicil", "Oda sicil no"], ["mimar.telefon", "Telefon"], ["mimar.sirket", "Büro / şirket"], ["mimar.adres", "Adres"]] },
  { id: "muellif", label: "Müellif (ilk seçili)", short: "Müellif", ctx: ["authors"], items: [["muellif.adSoyad", "Ad Soyad"], ["muellif.tc", "TC No"], ["muellif.meslek", "Meslek"], ["muellif.sicil", "Oda sicil no"], ["muellif.telefon", "Telefon"], ["muellif.sirket", "Büro / şirket"], ["muellif.adres", "Adres"]] },
  { id: "arsaSahibi", label: "Arsa sahibi (ilk)", short: "Arsa sahibi", ctx: ["project"], items: [["arsaSahibi.ad", "Ad Soyad"], ["arsaSahibi.tc", "TC No"], ["arsaSahibi.telefon", "Telefon"], ["arsaSahibi.adres", "Adres"], ["arsaSahibi.hisse", "Hisse"]] },
  { id: "vekil", label: "Vekil", short: "Vekil", ctx: ["project"], items: [["vekil.ad", "Ad Soyad"], ["vekil.tc", "TC No"], ["vekil.telefon", "Telefon"], ["vekil.adres", "Adres"]] },
];
export const LISTS = {
  muellifler: { label: "Müellifler", ctx: ["project", "authors"], fields: [["sira", "Sıra"], ["adSoyad", "Ad Soyad"], ["meslek", "Meslek"], ["tc", "TC No"], ["telefon", "Telefon"], ["sirket", "Büro / şirket"], ["sicil", "Oda sicil no"], ["adres", "Adres"]] },
  // Kayıtlar ekranında seçilen müteahhitler (tek müteahhitte de bir satır).
  muteahhitler: { label: "Müteahhitler", ctx: ["contractor"], fields: [["sira", "Sıra"], ["unvan", "Firma unvanı"], ["yetkili", "Yetkili"], ["yetkiNo", "Yetki belge no"], ["sinif", "Sınıfı"], ["adres", "Adres"]] },
  arsaSahipleri: { label: "Arsa sahipleri", ctx: ["project"], fields: [["sira", "Sıra"], ["ad", "Ad Soyad"], ["tc", "TC No"], ["telefon", "Telefon"], ["adres", "Adres"], ["hisse", "Hisse"], ["imza", "İmza alanı"]] },
};
export const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const varLabel = (key) => {
  const m = /^(\w+)\[\]\.(\w+)$/.exec(key || "");
  if (m) { const Ls = LISTS[m[1]]; const f = Ls && Ls.fields.find(x => x[0] === m[2]); return Ls ? tx(Ls.label) + " · " + tx(f ? f[1] : m[2]) : key; }
  const G = VAR_GROUPS.find(x => x.id === String(key).split(".")[0]); const it = G && G.items.find(x => x[0] === key);
  if (!it) return key;
  return G.short ? tx(G.short) + " · " + tx(it[1]) : tx(it[1]);
};
export const CHIP_CSS = "background:#e9eefb;color:#2a3180;border:1px solid #c3cdf0;border-radius:4px;padding:0 4px;box-decoration-break:clone;-webkit-box-decoration-break:clone;font:inherit";
export const REP_DIV = "outline:1.5px dashed #8a96e0;outline-offset:3px;margin:8px 0";
export const CELL = "border:1px solid #444;padding:5px 7px;vertical-align:top;text-align:left";
export const TH = CELL + ";background:#efefef;font-weight:700";
export const PB_HTML = '<div data-pb="1" contenteditable="false" style="margin:18px 0;border-top:1.5px dashed #9aa3c7;height:0;text-align:center;line-height:0"><span style="background:#fff;padding:0 6px;font-family:Arial,sans-serif;font-size:8.5px;font-weight:700;letter-spacing:.6px;color:#6b74a0">SAYFA SONU</span></div>';
export const V = (key) => '<span data-v="' + key + '" contenteditable="false" style="' + CHIP_CSS + '">' + esc(varLabel(key)) + "</span>";
export const KV = (rows) => '<table style="width:100%;border-collapse:collapse;margin:8px 0"><tbody>' + rows.map(r => '<tr><td style="' + CELL + ';width:34%;background:#f6f6f6;font-weight:700">' + r[0] + '</td><td style="' + CELL + '">' + r[1] + "</td></tr>").join("") + "</tbody></table>";
export const REP_TR = "background:#eef1fc";
export const LISTTBL = (list, cols) => '<table style="width:100%;border-collapse:collapse;margin:8px 0"><thead><tr>' + cols.map(c => '<th style="' + TH + '">' + esc(c === "imza" ? tx("İmza") : tx(LISTS[list].fields.find(f => f[0] === c)[1])) + "</th>").join("") + '</tr></thead><tbody><tr data-repeat="' + list + '" style="' + REP_TR + '">' + cols.map(c => c === "imza" ? '<td style="' + CELL + ';height:12mm;width:22%"></td>' : '<td style="' + CELL + '">' + V(list + "[]." + c) + "</td>").join("") + "</tr></tbody></table>";
export const TABLE = (r, c) => '<table style="width:100%;border-collapse:collapse;margin:6px 0"><tbody>' + Array.from({ length: r }, () => "<tr>" + Array.from({ length: c }, () => '<td style="' + CELL + '"><br></td>').join("") + "</tr>").join("") + "</tbody></table>";
export const SIG = (pos, label) => pos === "two"
  ? '<table data-sig="1" style="width:100%;margin-top:30px;border-collapse:collapse"><tbody><tr><td style="width:44%;height:15mm;border-bottom:1px solid #222"></td><td></td><td style="width:44%;border-bottom:1px solid #222"></td></tr><tr><td style="text-align:center;padding-top:5px">' + label + '</td><td></td><td style="text-align:center;padding-top:5px">' + label + "</td></tr></tbody></table>"
  : '<table data-sig="1" style="margin:30px ' + (pos === "left" ? "auto 0 0" : "0 0 auto") + ';border-collapse:collapse"><tbody><tr><td style="width:62mm;height:15mm;border-bottom:1px solid #222"></td></tr><tr><td style="text-align:center;padding-top:5px">' + label + "</td></tr></tbody></table>";
export const HDR = () => '<table style="width:100%;border-collapse:collapse"><tbody><tr><td style="padding:0 0 6px;border-bottom:2px solid #2a3180;font-size:13pt;font-weight:700">' + V("genel.sirket") + '</td><td style="padding:0 0 6px;border-bottom:2px solid #2a3180;text-align:right;font-size:9pt;color:#555">' + V("genel.belgeNo") + "<br>" + V("genel.tarih") + "</td></tr></tbody></table>";
export const TPL_BASE = () => ({ size: "A4", orient: "portrait", margins: { t: 20, r: 20, b: 20, l: 22 }, font: FONTS[0][0], fontSize: 12, pageNo: true, pageNoPos: "right", updated: "" });
export const blankTpl = () => ({ ...TPL_BASE(), id: uid(), name: tx("Yeni şablon"), contexts: ["project"], header: HDR(), body: "<p><br></p>", footer: "" });
export const geom = (t) => {
  const ps = PAGE_SIZES[t.size] || PAGE_SIZES.A4, land = t.orient === "landscape";
  const m = Object.assign({ t: 20, r: 20, b: 20, l: 20 }, t.margins || {});
  const w = land ? ps[1] : ps[0], h = land ? ps[0] : ps[1];
  return { w, h, m, fmt: t.size === "Letter" ? "letter" : String(t.size || "A4").toLowerCase(), or: land ? "landscape" : "portrait", cwMm: w - m.l - m.r };
};
export const hasContent = (h) => /<(img|table)/i.test(h || "") || String(h || "").replace(/<[^>]+>/g, "").replace(/&nbsp;|\s|\u200B/g, "").length > 0;
/** Şablonlardaki marka rengi yer tutucuları. Hazır şablonlar ve düzenleyici bu sabit
 *  tonlarla yazar; belge üretilirken şirketin ana rengine (Sistem paneli → Şirket kimliği)
 *  çevrilir. Böylece kayıtlı şablonlara dokunmadan renk değişikliği her belgeye yansır. */
const BRAND_SLOTS: [RegExp, number][] = [
  [/#2a3180\b/gi, 1],      // çizgi ve vurgu: ana renk
  [/#8a96e0\b/gi, 0.55],   // tekrar bloğu çerçevesi
  [/#c3cdf0\b/gi, 0.28],   // değişken etiketi kenarı
  [/#e9eefb\b/gi, 0.1],    // değişken etiketi zemini
  [/#eef1fc\b/gi, 0.08],   // tekrarlanan satır zemini
];
const hex6 = (c: string) => { const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((c || "").trim()); if (!m) return null; const h = m[1].length === 3 ? m[1].replace(/./g, (x) => x + x) : m[1]; return h.toLowerCase(); };
/** Ana rengi beyazla karıştırır (w=1 ana renk, w=0 beyaz); Word/PDF de anlasın diye düz hex döner. */
const tintOf = (h: string, w: number) => "#" + [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * w + 255 * (1 - w)).toString(16).padStart(2, "0")).join("");
export const brandize = (html: string, pri?: string) => {
  const h = hex6(pri || "");
  if (!h || !html) return html;
  return BRAND_SLOTS.reduce((out, [re, w]) => out.replace(re, tintOf(h, w)), html);
};

export const renderTpl = (html, ctx, mode) => {
  const box: any = document.createElement("div"); box.innerHTML = cleanHtml(html || "");
  const val = (key, item, ln) => {
    const m = /^(\w+)\[\]\.(\w+)$/.exec(key);
    if (m) { if (item && m[1] === ln) return item[m[2]]; return (ctx.lists[m[1]] || []).map(x => x[m[2]]).filter(v => v !== "" && v != null).join(", "); }
    return ctx.vals[key];
  };
  const fill = (root: any, item?: any, ln?: any) => anyList(root.querySelectorAll("[data-v]")).forEach(n => { const v = val(n.getAttribute("data-v"), item, ln); n.replaceWith(document.createTextNode(v == null ? "" : String(v))); });
  anyList(box.querySelectorAll("[data-repeat]")).forEach(el => {
    if (!box.contains(el)) return;
    const ln = el.getAttribute("data-repeat");
    (ctx.lists[ln] || []).forEach(it => { const c: any = el.cloneNode(true); c.removeAttribute("data-repeat"); c.style.outline = ""; c.style.outlineOffset = ""; c.style.background = ""; c.style.backgroundColor = ""; fill(c, it, ln); el.parentNode.insertBefore(c, el); });
    el.remove();
  });
  fill(box);
  anyList(box.querySelectorAll("[data-pb]")).forEach(n => {
    if (mode === "print") return n.replaceWith(document.createTextNode("@@PB@@"));
    const d = document.createElement(mode === "word" ? "br" : "div");
    if (mode === "word") { d.setAttribute("clear", "all"); d.style.cssText = "page-break-before:always"; }
    else if (mode === "pdf") d.style.cssText = "height:0;page-break-after:always;break-after:page";
    else { d.style.cssText = "margin:22px 0;border-top:2px dashed #c3c6d6;height:0;text-align:center;line-height:0"; d.innerHTML = '<span style="background:#fff;padding:0 6px;font-family:Arial,sans-serif;font-size:8.5px;font-weight:700;letter-spacing:.6px;color:#8a8fa8">' + esc(tx("Sayfa sonu")).toLocaleUpperCase(LOC()) + "</span>"; }
    n.replaceWith(d);
  });
  anyList(box.querySelectorAll("[contenteditable]")).forEach(n => n.removeAttribute("contenteditable"));
  return brandize(box.innerHTML.replace(/\u200B/g, ""), ctx.brand);
};
export const SLOT_ZOOM = { genPaper: "gen", tplPrev: "tpl" };
