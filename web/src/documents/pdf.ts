import { jsPDF } from "jspdf";

/**
 * Ekrandaki sayfalanmış belgeden metin tabanlı PDF üretir. Her sözcük ekrandaki yerine
 * gerçek metin olarak yazılır: seçilebilir, aranabilir ve dosya boyutu küçüktür.
 * Yazı tipleri Times New Roman, Arial ve Courier New ile aynı genişliktedir.
 */

type Family = "Tinos" | "Arimo" | "Cousine";
type Face = "normal" | "bold" | "italic" | "bolditalic";
type Rgb = [number, number, number];

interface TextOp { text: string; x: number; y: number; width: number; family: Family; face: Face; sizePt: number; color: Rgb; underline: boolean; strike: boolean }
interface BoxOp { kind: "fill"; x: number; y: number; w: number; h: number; color: Rgb }
interface LineOp { kind: "line"; x1: number; y1: number; x2: number; y2: number; width: number; color: Rgb; dash: boolean }
interface ImageOp { kind: "image"; x: number; y: number; w: number; h: number; data: string }
type ShapeOp = BoxOp | LineOp | ImageOp;
interface PageOps { shapes: ShapeOp[]; text: TextOp[] }

const FILE_STYLE: Record<Face, string> = { normal: "Regular", bold: "Bold", italic: "Italic", bolditalic: "BoldItalic" };
const fontCache = new Map<string, Promise<string>>();

function loadFont(file: string): Promise<string> {
  let job = fontCache.get(file);
  if (!job) {
    job = fetch("/fonts/pdf/" + file + ".ttf").then(async (response) => {
      if (!response.ok) throw new Error("yazı tipi yüklenemedi");
      const bytes = new Uint8Array(await response.arrayBuffer());
      let text = "";
      for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(text);
    });
    fontCache.set(file, job);
  }
  return job;
}

function familyOf(css: string): Family {
  const first = css.split(",")[0].replace(/["']/g, "").trim().toLowerCase();
  if (/courier|mono/.test(first)) return "Cousine";
  if (/times|georgia|cambria|garamond|^serif/.test(first)) return "Tinos";
  return "Arimo";
}

function parseColor(value: string): Rgb | null {
  const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?/.exec(value);
  if (!m) return null;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
  return [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3])];
}

const canvas = document.createElement("canvas");
const measure = canvas.getContext("2d")!;
const baselines = new Map<string, number>();

/** Satır kutusu içinde taban çizgisinin oranı; gerçek yazı tipi ölçüsünden okunur. */
function baselineRatio(font: string): number {
  let ratio = baselines.get(font);
  if (ratio === undefined) {
    measure.font = font;
    const m = measure.measureText("Hg");
    const total = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
    ratio = total > 0 ? m.fontBoundingBoxAscent / total : 0.8;
    baselines.set(font, ratio);
  }
  return ratio;
}

function hasDecoration(node: Element | null, stop: Element, kind: string): boolean {
  for (let n = node; n && n !== stop.parentElement; n = n.parentElement) {
    if (getComputedStyle(n).textDecorationLine.includes(kind)) return true;
  }
  return false;
}

function imageData(img: HTMLImageElement): string | null {
  try {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    return c.toDataURL("image/png");
  } catch {
    return null;
  }
}

function collectBoxes(sheet: Element, origin: DOMRect, k: number, shapes: ShapeOp[]) {
  const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode() as HTMLElement | null; node; node = walker.nextNode() as HTMLElement | null) {
    const cs = getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = node.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const x = (r.left - origin.left) * k, y = (r.top - origin.top) * k, w = r.width * k, h = r.height * k;
    const fill = parseColor(cs.backgroundColor);
    if (fill) shapes.push({ kind: "fill", x, y, w, h, color: fill });
    const sides: [string, number, number, number, number][] = [
      ["Top", x, y, x + w, y], ["Right", x + w, y, x + w, y + h], ["Bottom", x, y + h, x + w, y + h], ["Left", x, y, x, y + h],
    ];
    for (const [side, x1, y1, x2, y2] of sides) {
      const width = parseFloat(cs.getPropertyValue("border-" + side.toLowerCase() + "-width")) || 0;
      const style = cs.getPropertyValue("border-" + side.toLowerCase() + "-style");
      const color = parseColor(cs.getPropertyValue("border-" + side.toLowerCase() + "-color"));
      if (width > 0 && style !== "none" && style !== "hidden" && color) {
        shapes.push({ kind: "line", x1, y1, x2, y2, width: width * k, color, dash: style === "dashed" || style === "dotted" });
      }
    }
    if (node.tagName === "IMG") {
      const data = imageData(node as HTMLImageElement);
      if (data) shapes.push({ kind: "image", x, y, w, h, data });
    }
  }
}

function pushWord(node: Text, start: number, end: number, origin: DOMRect, k: number, sheet: Element, out: TextOp[]) {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const rects = range.getClientRects();
  if (!rects.length) return;
  if (rects.length > 1 && end - start > 1) {
    // Satır sonunda bölünen uzun sözcük: satır satır ayrılır.
    let cut = start + 1;
    range.setEnd(node, cut);
    const top = range.getClientRects()[0]?.top;
    while (cut < end) {
      range.setEnd(node, cut + 1);
      const list = range.getClientRects();
      if (list.length > 1 || list[0]?.top !== top) break;
      cut++;
    }
    if (cut < end) {
      pushWord(node, start, cut, origin, k, sheet, out);
      pushWord(node, cut, end, origin, k, sheet, out);
      return;
    }
  }
  const parent = node.parentElement!;
  const cs = getComputedStyle(parent);
  if (cs.visibility === "hidden") return;
  const r = rects[0];
  const bold = parseInt(cs.fontWeight, 10) >= 600;
  const italic = cs.fontStyle === "italic" || cs.fontStyle.startsWith("oblique");
  const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  out.push({
    text: node.data.slice(start, end),
    x: (r.left - origin.left) * k,
    y: (r.top + r.height * baselineRatio(font) - origin.top) * k,
    width: r.width * k,
    family: familyOf(cs.fontFamily),
    face: bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal",
    sizePt: parseFloat(cs.fontSize) * 0.75,
    color: parseColor(cs.color) ?? [0, 0, 0],
    underline: hasDecoration(parent, sheet, "underline"),
    strike: hasDecoration(parent, sheet, "line-through"),
  });
}

/** Tarayıcı madde işaretlerini metin düğümü olarak vermez; ayrıca çizilir. */
function collectMarkers(sheet: Element, origin: DOMRect, k: number): Map<Node, TextOp> {
  const markers = new Map<Node, TextOp>();
  sheet.querySelectorAll("li").forEach((li) => {
    const cs = getComputedStyle(li);
    if (cs.listStyleType === "none") return;
    const first = document.createTreeWalker(li, NodeFilter.SHOW_TEXT).nextNode() as Text | null;
    if (!first || !first.data.trim()) return;
    const range = document.createRange();
    range.selectNodeContents(first);
    const r = range.getClientRects()[0];
    if (!r) return;
    const list = li.parentElement;
    const text = list?.tagName === "OL" ? Array.from(list.children).indexOf(li) + 1 + "." : "•";
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    measure.font = font;
    const width = measure.measureText(text).width;
    markers.set(first, {
      text,
      x: (li.getBoundingClientRect().left - width - parseFloat(cs.fontSize) * 0.5 - origin.left) * k,
      y: (r.top + r.height * baselineRatio(font) - origin.top) * k,
      width: width * k,
      family: familyOf(cs.fontFamily),
      face: "normal",
      sizePt: parseFloat(cs.fontSize) * 0.75,
      color: parseColor(cs.color) ?? [0, 0, 0],
      underline: false,
      strike: false,
    });
  });
  return markers;
}

function collectText(sheet: Element, origin: DOMRect, k: number, out: TextOp[]) {
  const markers = collectMarkers(sheet, origin, k);
  const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const marker = markers.get(node);
    if (marker) out.push(marker);
    for (const match of node.data.matchAll(/[^\s​]+/g)) {
      pushWord(node, match.index!, match.index! + match[0].length, origin, k, sheet, out);
    }
  }
}

export interface PdfPage { widthMm: number; heightMm: number; format: string; orientation: "portrait" | "landscape"; title: string; lang: string }

/** `root` içindeki `[data-sheet]` sayfalarını PDF'e yazar. */
export async function sheetsToPdf(root: Element, page: PdfPage): Promise<jsPDF> {
  const sheets = Array.from(root.querySelectorAll("[data-sheet]"));
  await document.fonts.ready;
  const pages: PageOps[] = sheets.map((sheet) => {
    const origin = sheet.getBoundingClientRect();
    const k = page.widthMm / origin.width;
    const ops: PageOps = { shapes: [], text: [] };
    collectBoxes(sheet, origin, k, ops.shapes);
    collectText(sheet, origin, k, ops.text);
    return ops;
  });

  const pdf = new jsPDF({ unit: "mm", format: page.format, orientation: page.orientation, compress: true });
  pdf.setProperties({ title: page.title });
  pdf.setLanguage(page.lang as any);
  const faces = new Set(pages.flatMap((p) => p.text.map((t) => t.family + "|" + t.face)));
  await Promise.all(
    Array.from(faces).map(async (key) => {
      const [family, face] = key.split("|") as [Family, Face];
      const file = family + "-" + FILE_STYLE[face];
      pdf.addFileToVFS(file + ".ttf", await loadFont(file));
      pdf.addFont(file + ".ttf", family, face, undefined, "Identity-H");
    }),
  );

  pages.forEach((ops, index) => {
    if (index > 0) pdf.addPage(page.format, page.orientation);
    for (const op of ops.shapes) {
      if (op.kind === "fill") {
        pdf.setFillColor(...op.color);
        pdf.rect(op.x, op.y, op.w, op.h, "F");
      } else if (op.kind === "line") {
        pdf.setDrawColor(...op.color);
        pdf.setLineWidth(op.width);
        pdf.setLineDashPattern(op.dash ? [1, 1] : [], 0);
        pdf.line(op.x1, op.y1, op.x2, op.y2);
      } else {
        pdf.addImage(op.data, "PNG", op.x, op.y, op.w, op.h, undefined, "FAST");
      }
    }
    pdf.setLineDashPattern([], 0);
    for (const t of ops.text) {
      pdf.setFont(t.family, t.face);
      pdf.setFontSize(t.sizePt);
      pdf.setTextColor(...t.color);
      const natural = pdf.getTextWidth(t.text);
      const gaps = Math.max(1, t.text.length - 1);
      const charSpace = Math.abs(t.width - natural) / gaps < 0.4 ? (t.width - natural) / gaps : 0;
      // Sözcük sonundaki boşluk görünmez; kopyalanan metinde sözcükler ayrık kalır.
      pdf.text(t.text + " ", t.x, t.y, { charSpace, baseline: "alphabetic" });
      if (t.underline || t.strike) {
        const lift = t.strike ? t.sizePt * 0.1 : -t.sizePt * 0.04;
        pdf.setDrawColor(...t.color);
        pdf.setLineWidth(t.sizePt * 0.018);
        pdf.line(t.x, t.y - lift, t.x + t.width, t.y - lift);
      }
    }
  });
  return pdf;
}
