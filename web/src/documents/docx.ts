import { strToU8, zipSync } from "fflate";

/**
 * HTML belgeden gerçek WordprocessingML üretir. İçerik Word'e özgü bir gömme olarak değil,
 * paragraf ve tablo olarak yazılır: LibreOffice, Google Docs ve telefon uygulamalarında da açılır.
 * Üst ve alt bilgi gerçek Word üst/alt bilgisidir, sayfa numarası alan koduyla gelir.
 */

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface RunStyle { b?: boolean; i?: boolean; u?: boolean; s?: boolean; sub?: boolean; sup?: boolean; color?: string; sizePt?: number; font?: string; shade?: string }
interface Ctx { run: RunStyle; basePt: number; widthDxa: number; list?: { numId: number; level: number } }
interface Picture { bytes: Uint8Array; ext: "png" | "jpeg"; width: number; height: number }

function lengthPt(value: string | undefined, basePt: number): number | null {
  const m = /^(-?[\d.]+)(px|pt|mm|cm|em|rem|%)?$/.exec((value || "").trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case "pt": return n;
    case "mm": return n * 2.83465;
    case "cm": return n * 28.3465;
    case "em": case "rem": return n * basePt;
    case "%": return (n / 100) * basePt;
    default: return n * 0.75;
  }
}

function hex(value: string | undefined): string | undefined {
  const v = (value || "").trim().toLowerCase();
  if (!v || v === "transparent" || v === "inherit") return undefined;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (short) return (short[1] + short[1] + short[2] + short[2] + short[3] + short[3]).toUpperCase();
  const long = /^#([0-9a-f]{6})/.exec(v);
  if (long) return long[1].toUpperCase();
  const rgb = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:\s*[,/]\s*([\d.]+))?/.exec(v);
  if (rgb) {
    if (rgb[4] !== undefined && parseFloat(rgb[4]) === 0) return undefined;
    return [rgb[1], rgb[2], rgb[3]].map((n) => (+n).toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  return { black: "000000", white: "FFFFFF", red: "FF0000" }[v];
}

function runProps(r: RunStyle): string {
  let x = "";
  if (r.font) x += `<w:rFonts w:ascii="${esc(r.font)}" w:hAnsi="${esc(r.font)}" w:cs="${esc(r.font)}"/>`;
  if (r.b) x += "<w:b/>";
  if (r.i) x += "<w:i/>";
  if (r.s) x += "<w:strike/>";
  if (r.color) x += `<w:color w:val="${r.color}"/>`;
  if (r.sizePt) x += `<w:sz w:val="${Math.round(r.sizePt * 2)}"/><w:szCs w:val="${Math.round(r.sizePt * 2)}"/>`;
  if (r.u) x += '<w:u w:val="single"/>';
  if (r.shade) x += `<w:shd w:val="clear" w:color="auto" w:fill="${r.shade}"/>`;
  if (r.sub) x += '<w:vertAlign w:val="subscript"/>';
  if (r.sup) x += '<w:vertAlign w:val="superscript"/>';
  return x ? `<w:rPr>${x}</w:rPr>` : "";
}

const firstFamily = (css: string) => css.split(",")[0].replace(/["']/g, "").trim();

/** Bir öğenin stilini metin özelliklerine yansıtır. */
function styled(el: HTMLElement, ctx: Ctx): RunStyle {
  const r = { ...ctx.run };
  const tag = el.tagName;
  if (tag === "B" || tag === "STRONG" || tag === "TH" || /^H[1-3]$/.test(tag)) r.b = true;
  if (tag === "I" || tag === "EM") r.i = true;
  if (tag === "U") r.u = true;
  if (tag === "S" || tag === "STRIKE") r.s = true;
  if (tag === "SUB") r.sub = true;
  if (tag === "SUP") r.sup = true;
  if (tag === "H1") r.sizePt = ctx.basePt * 2;
  if (tag === "H2") r.sizePt = ctx.basePt * 1.5;
  if (tag === "H3") r.sizePt = ctx.basePt * 1.17;
  const st = el.style;
  const weight = st.fontWeight;
  if (weight) r.b = weight === "bold" || parseInt(weight, 10) >= 600;
  if (st.fontStyle) r.i = st.fontStyle === "italic";
  const decoration = st.textDecoration || (st as any).textDecorationLine || "";
  if (decoration.includes("underline")) r.u = true;
  if (decoration.includes("line-through")) r.s = true;
  const color = hex(st.color || el.getAttribute("color") || "");
  if (color) r.color = color;
  const bg = hex(st.backgroundColor);
  if (bg && tag !== "TD" && tag !== "TH") r.shade = bg;
  const size = lengthPt(st.fontSize, r.sizePt || ctx.basePt);
  if (size) r.sizePt = size;
  const face = st.fontFamily || el.getAttribute("face");
  if (face) r.font = firstFamily(face);
  return r;
}

class Package {
  media: { name: string; bytes: Uint8Array; ext: string }[] = [];
  bulletId = 1;
  numberIds: number[] = [];
  nextNum = 2;
  nextDrawing = 1;
}

/** Belge gövdesi, üst bilgi ve alt bilgi ayrı parçalardır; görsel ilişkileri parçaya özeldir. */
class Part {
  rels: string[] = [];
  constructor(private pkg: Package, private pictures: Map<Element, Picture>) {}

  private drawing(img: Element, ctx: Ctx): string {
    const pic = this.pictures.get(img);
    if (!pic) return "";
    const name = `image${this.pkg.media.length + 1}.${pic.ext === "png" ? "png" : "jpg"}`;
    this.pkg.media.push({ name, bytes: pic.bytes, ext: pic.ext });
    const rid = `rIdImg${this.rels.length + 1}`;
    this.rels.push(`<Relationship Id="${rid}" Type="${REL}/image" Target="media/${name}"/>`);
    const st = (img as HTMLElement).style;
    const widthPt = lengthPt(st.width, 0) || pic.width * 0.75;
    const limit = ctx.widthDxa / 20;
    const scale = Math.min(1, limit / widthPt);
    const heightPt = (lengthPt(st.height, 0) || (pic.height / pic.width) * widthPt) * scale;
    const cx = Math.round(widthPt * scale * 12700), cy = Math.round(heightPt * 12700);
    const id = this.pkg.nextDrawing++;
    return (
      `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Görsel ${id}"/>` +
      `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
    );
  }

  private inline(node: Node, ctx: Ctx): string {
    if (node.nodeType === 3) {
      const text = (node.nodeValue || "").replace(/​/g, "").replace(/\s+/g, " ");
      if (!text) return "";
      return `<w:r>${runProps(ctx.run)}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
    }
    if (node.nodeType !== 1) return "";
    const el = node as HTMLElement;
    if (el.tagName === "BR") {
      if (/page-break|break-(before|after)/.test(el.getAttribute("style") || "")) return '<w:r><w:br w:type="page"/></w:r>';
      return "<w:r><w:br/></w:r>";
    }
    if (el.tagName === "IMG") return this.drawing(el, ctx);
    const inner = { ...ctx, run: styled(el, ctx) };
    return Array.from(el.childNodes).map((c) => this.inline(c, inner)).join("");
  }

  private paragraph(content: string, el: HTMLElement | null, ctx: Ctx, extra = ""): string {
    const st = el?.style;
    const basePt = ctx.run.sizePt || ctx.basePt;
    let pPr = "";
    if (ctx.list) pPr += `<w:numPr><w:ilvl w:val="${ctx.list.level}"/><w:numId w:val="${ctx.list.numId}"/></w:numPr>`;
    pPr += extra;
    const heading = el && /^H[1-3]$/.test(el.tagName);
    const before = lengthPt(st?.marginTop, basePt) ?? (heading ? basePt * 0.7 : 0);
    const inList = !!ctx.list || el?.tagName === "TD" || el?.tagName === "TH";
    const after = lengthPt(st?.marginBottom, basePt) ?? (inList ? 0 : heading ? basePt * 0.7 : basePt);
    const line = parseFloat(st?.lineHeight || "");
    const lineValue = Math.round(240 * (line > 0 && line < 5 ? line : 1.4));
    pPr += `<w:spacing w:before="${Math.round(before * 20)}" w:after="${Math.round(after * 20)}" w:line="${lineValue}" w:lineRule="auto"/>`;
    const indent = lengthPt(st?.textIndent, basePt);
    const left = lengthPt(st?.marginLeft || st?.paddingLeft, basePt);
    if (indent || left) pPr += `<w:ind${left ? ` w:left="${Math.round(left * 20)}"` : ""}${indent ? ` w:firstLine="${Math.round(indent * 20)}"` : ""}/>`;
    const align = st?.textAlign || el?.getAttribute("align") || "";
    const jc = { left: "left", start: "left", center: "center", right: "right", end: "right", justify: "both" }[align];
    if (jc) pPr += `<w:jc w:val="${jc}"/>`;
    return `<w:p><w:pPr>${pPr}</w:pPr>${content}</w:p>`;
  }

  private border(el: HTMLElement, side: string, tag: string): string {
    const st = el.style as any;
    const name = side[0].toUpperCase() + side.slice(1);
    const style = st["border" + name + "Style"] || "";
    const width = lengthPt(st["border" + name + "Width"], 12) ?? 0;
    if (!style && !width) return "";
    if (style === "none" || style === "hidden" || width === 0) return `<w:${tag} w:val="nil"/>`;
    const val = { dashed: "dashed", dotted: "dotted", double: "double" }[style as string] || "single";
    return `<w:${tag} w:val="${val}" w:sz="${Math.max(2, Math.round(width * 8))}" w:space="0" w:color="${hex(st["border" + name + "Color"]) || "000000"}"/>`;
  }

  private table(el: HTMLTableElement, ctx: Ctx): string {
    const rows = Array.from(el.rows);
    if (!rows.length) return "";
    const pct = /^([\d.]+)%$/.exec(el.style.width || "")?.[1];
    const fixed = lengthPt(el.style.width, ctx.basePt);
    const total = Math.round(pct ? (ctx.widthDxa * parseFloat(pct)) / 100 : fixed && !pct ? fixed * 20 : ctx.widthDxa);
    const cols = Math.max(...rows.map((r) => Array.from(r.cells).reduce((n, c) => n + (c.colSpan || 1), 0)), 1);
    const declared = Array.from(el.querySelectorAll(":scope > colgroup > col")).map((c) => parseFloat((c as HTMLElement).style.width) || 0);
    const shares = declared.length === cols && declared.every((w) => w > 0) ? declared : Array(cols).fill(100 / cols);
    const sum = shares.reduce((a, b) => a + b, 0);
    const grid = shares.map((w) => Math.round((w / sum) * total));
    const margin = '<w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar>';
    let xml = `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${margin}</w:tblPr><w:tblGrid>${grid.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`;
    for (const row of rows) {
      const height = lengthPt(row.style.height, ctx.basePt);
      const header = row.parentElement?.tagName === "THEAD";
      const trPr = (height ? `<w:trHeight w:val="${Math.round(height * 20)}" w:hRule="atLeast"/>` : "") + (header ? "<w:tblHeader/>" : "");
      xml += "<w:tr>" + (trPr ? `<w:trPr>${trPr}</w:trPr>` : "");
      let col = 0;
      for (const cell of Array.from(row.cells)) {
        const span = cell.colSpan || 1;
        const width = grid.slice(col, col + span).reduce((a, b) => a + b, 0);
        col += span;
        const borders = ["top", "left", "bottom", "right"].map((s) => this.border(cell, s, s)).join("");
        const shade = hex(cell.style.backgroundColor);
        const valign = { middle: "center", bottom: "bottom", top: "top" }[cell.style.verticalAlign];
        const tcPr =
          `<w:tcW w:w="${width}" w:type="dxa"/>` + (span > 1 ? `<w:gridSpan w:val="${span}"/>` : "") + (borders ? `<w:tcBorders>${borders}</w:tcBorders>` : "") +
          (shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : "") + (valign ? `<w:vAlign w:val="${valign}"/>` : "");
        const inner: Ctx = { ...ctx, run: styled(cell, ctx), widthDxa: Math.max(width - 160, 200), list: undefined };
        xml += `<w:tc><w:tcPr>${tcPr}</w:tcPr>${this.blocks(cell, inner) || "<w:p/>"}</w:tc>`;
      }
      xml += "</w:tr>";
    }
    return xml + "</w:tbl>";
  }

  private list(el: HTMLElement, ctx: Ctx): string {
    const level = ctx.list ? Math.min(ctx.list.level + 1, 2) : 0;
    let numId = this.pkg.bulletId;
    if (el.tagName === "OL") {
      numId = this.pkg.nextNum++;
      this.pkg.numberIds.push(numId);
    }
    const inner: Ctx = { ...ctx, list: { numId, level } };
    return Array.from(el.children).map((li) => this.blocks(li, { ...inner, run: styled(li as HTMLElement, inner) }, li as HTMLElement)).join("");
  }

  /** Blok düzeyi: satır içi parçalar bir paragrafta toplanır, bloklar kendi yapısına çevrilir. */
  blocks(parent: Node, ctx: Ctx, self: HTMLElement | null = null): string {
    let out = "", runs = "";
    const flush = () => {
      if (runs) out += this.paragraph(runs, self ?? (parent as HTMLElement), ctx);
      runs = "";
    };
    const BLOCK = /^(P|DIV|H[1-3]|BLOCKQUOTE|LI)$/;
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === 1) {
        const el = child as HTMLElement;
        if (el.tagName === "TABLE") {
          flush();
          // Word'de iki tablo arasına ve tablodan sonra paragraf gerekir.
          out += this.table(el as HTMLTableElement, ctx) + '<w:p><w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr></w:p>';
          continue;
        }
        if (el.tagName === "UL" || el.tagName === "OL") {
          flush();
          out += this.list(el, ctx);
          continue;
        }
        if (el.tagName === "HR") {
          flush();
          out += '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="808080"/></w:pBdr></w:pPr></w:p>';
          continue;
        }
        if (BLOCK.test(el.tagName)) {
          flush();
          const inner = { ...ctx, run: styled(el, ctx) };
          const hasBlock = Array.from(el.children).some((c) => BLOCK.test(c.tagName) || /^(TABLE|UL|OL|HR)$/.test(c.tagName));
          if (hasBlock) out += this.blocks(el, inner);
          else {
            const content = Array.from(el.childNodes).map((c) => this.inline(c, inner)).join("");
            out += this.paragraph(content, el, inner);
          }
          continue;
        }
      }
      if (child.nodeType === 3 && !(child.nodeValue || "").trim() && !runs) continue;
      runs += this.inline(child, ctx);
    }
    flush();
    return out;
  }

  relsXml(): string {
    return `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${this.rels.join("")}</Relationships>`;
  }
}

function pngSize(b: Uint8Array) {
  const v = new DataView(b.buffer, b.byteOffset);
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

function jpegSize(b: Uint8Array) {
  for (let i = 2; i + 9 < b.length; ) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    }
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  return { width: 300, height: 150 };
}

async function loadPicture(src: string): Promise<Picture | null> {
  let bytes: Uint8Array;
  if (src.startsWith("data:")) {
    const comma = src.indexOf(",");
    bytes = Uint8Array.from(atob(src.slice(comma + 1)), (c) => c.charCodeAt(0));
  } else {
    const response = await fetch(src);
    if (!response.ok) return null;
    bytes = new Uint8Array(await response.arrayBuffer());
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return { bytes, ext: "png", ...pngSize(bytes) };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { bytes, ext: "jpeg", ...jpegSize(bytes) };
  return null;
}

const STYLES = (font: string, sizePt: number) =>
  `${XML}<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${esc(font)}" w:hAnsi="${esc(font)}" w:cs="${esc(font)}"/><w:sz w:val="${Math.round(sizePt * 2)}"/><w:szCs w:val="${Math.round(sizePt * 2)}"/><w:lang w:val="tr-TR"/></w:rPr></w:rPrDefault></w:docDefaults>` +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>';

function numbering(pkg: Package) {
  const level = (i: number, fmt: string, text: string) =>
    `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${360 * (i + 1)}" w:hanging="360"/></w:pPr></w:lvl>`;
  const bullets = [0, 1, 2].map((i) => level(i, "bullet", "•")).join("");
  const numbers = [0, 1, 2].map((i) => level(i, "decimal", `%${i + 1}.`)).join("");
  const nums = pkg.numberIds
    .map((id) => `<w:num w:numId="${id}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`)
    .join("");
  return `${XML}<w:numbering ${NS}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${bullets}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${numbers}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>${nums}</w:numbering>`;
}

const field = (code: string) =>
  `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${code} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;

export interface DocxInput {
  header: string;
  body: string;
  footer: string;
  font: string;
  fontSize: number;
  pageNo: boolean;
  pageNoPos: string;
  pageLabel: string;
  geometry: { w: number; h: number; or: string; m: Record<string, number> };
}

export async function htmlToDocx(input: DocxInput): Promise<Blob> {
  const g = input.geometry;
  const tw = (mm: number) => Math.round(mm * 56.693);
  const parse = (html: string) => new DOMParser().parseFromString(`<!DOCTYPE html><body>${html}</body>`, "text/html").body;
  const roots = { header: parse(input.header), body: parse(input.body), footer: parse(input.footer) };
  const pictures = new Map<Element, Picture>();
  for (const root of Object.values(roots)) {
    for (const img of Array.from(root.querySelectorAll("img"))) {
      const pic = await loadPicture(img.getAttribute("src") || "").catch(() => null);
      if (pic) pictures.set(img, pic);
    }
  }

  const font = firstFamily(input.font);
  const widthDxa = tw(g.w - g.m.l - g.m.r);
  const ctx: Ctx = { run: {}, basePt: input.fontSize, widthDxa };
  const pkg = new Package();
  const main = new Part(pkg, pictures), head = new Part(pkg, pictures), foot = new Part(pkg, pictures);
  const bodyXml = main.blocks(roots.body, ctx);
  const headerXml = head.blocks(roots.header, ctx);
  let footerXml = foot.blocks(roots.footer, ctx);
  if (input.pageNo) {
    const jc = { left: "left", center: "center", right: "right" }[input.pageNoPos] || "right";
    const label = `<w:r><w:t xml:space="preserve">${esc(input.pageLabel)} </w:t></w:r>`;
    footerXml += `<w:p><w:pPr><w:jc w:val="${jc}"/></w:pPr>${label}${field("PAGE")}<w:r><w:t xml:space="preserve"> / </w:t></w:r>${field("NUMPAGES")}</w:p>`;
  }

  const orient = g.or === "landscape" ? ' w:orient="landscape"' : "";
  const sect =
    (headerXml ? '<w:headerReference w:type="default" r:id="rIdHeader"/>' : "") + (footerXml ? '<w:footerReference w:type="default" r:id="rIdFooter"/>' : "") +
    `<w:pgSz w:w="${tw(g.w)}" w:h="${tw(g.h)}"${orient}/><w:pgMar w:top="${tw(g.m.t)}" w:right="${tw(g.m.r)}" w:bottom="${tw(g.m.b)}" w:left="${tw(g.m.l)}" w:header="400" w:footer="400" w:gutter="0"/>`;
  const relation = (id: string, type: string, target: string) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`;
  main.rels.push(relation("rIdStyles", "styles", "styles.xml"), relation("rIdNumbering", "numbering", "numbering.xml"));
  if (headerXml) main.rels.push(relation("rIdHeader", "header", "header1.xml"));
  if (footerXml) main.rels.push(relation("rIdFooter", "footer", "footer1.xml"));

  const types =
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/>` +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
    (headerXml ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : "") +
    (footerXml ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : "") +
    "</Types>";
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(types),
    "_rels/.rels": strToU8(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relation("rId1", "officeDocument", "word/document.xml")}</Relationships>`),
    "word/document.xml": strToU8(`${XML}<w:document ${NS}><w:body>${bodyXml || "<w:p/>"}<w:sectPr>${sect}</w:sectPr></w:body></w:document>`),
    "word/_rels/document.xml.rels": strToU8(main.relsXml()),
    "word/styles.xml": strToU8(STYLES(font, input.fontSize)),
    "word/numbering.xml": strToU8(numbering(pkg)),
  };
  if (headerXml) {
    files["word/header1.xml"] = strToU8(`${XML}<w:hdr ${NS}>${headerXml}</w:hdr>`);
    if (head.rels.length) files["word/_rels/header1.xml.rels"] = strToU8(head.relsXml());
  }
  if (footerXml) {
    files["word/footer1.xml"] = strToU8(`${XML}<w:ftr ${NS}>${footerXml}</w:ftr>`);
    if (foot.rels.length) files["word/_rels/footer1.xml.rels"] = strToU8(foot.relsXml());
  }
  for (const m of pkg.media) files["word/media/" + m.name] = m.bytes;
  return new Blob([zipSync(files) as BlobPart], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
