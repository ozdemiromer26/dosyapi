import type { CSSProperties } from "react";
import { css } from "./css";

/**
 * Ekranlarda tekrar eden görünümlerin tek kaynağı. Bir alanın ya da kartın
 * görünümü burada değiştirilir, ekranlar yalnızca adıyla kullanır.
 */
const line = "1px solid var(--line)";
const control = `border:${line};background:var(--soft)`;
const panel = `background:var(--card);border:${line};border-radius:14px;padding:16px;display:flex;flex-direction:column`;
const primary = "height:44px;border:none;border-radius:10px;background:var(--pri,#2a3180);color:#fff;font-weight:700;cursor:pointer";
const ellipsis = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
const muted = "color:var(--muted);font-weight:600";
const field = `height:40px;${control};border-radius:9px;padding:0 11px`;
const dropdown = `position:absolute;top:calc(100% + 4px);left:0;z-index:40;background:var(--card);border:${line};border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.16);padding:6px;max-width:calc(100vw - 28px);display:flex;flex-direction:column;gap:2px`;
const toolButton = "height:28px;min-width:28px;padding:0 5px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--ink);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;flex:none;font-size:12px;font-weight:700;white-space:nowrap";
const stack = (gap: number) => `display:flex;flex-direction:column;gap:${gap}px`;

const define = <K extends string>(items: Record<K, string>): Record<K, CSSProperties> =>
  Object.fromEntries(Object.entries(items).map(([name, text]) => [name, css(text)])) as Record<K, CSSProperties>;

export const st = define({
  // Yerleşim
  stack5: stack(5),
  stack6: stack(6),
  stack11: stack(11),
  stack13: stack(13),
  stack14: stack(14),
  row8: "display:flex;gap:8px",
  rowCenter8: "display:flex;align-items:center;gap:8px;flex-wrap:wrap",
  rowWrap8: "display:flex;gap:8px;flex-wrap:wrap",
  rowWrap10: "display:flex;gap:10px;flex-wrap:wrap",
  fillEllipsis: `flex:1;min-width:0;${ellipsis}`,

  // Kartlar
  card: `${panel};gap:11px`,
  cardLoose: `${panel};gap:12px`,

  // Metin
  title14: "font-size:14px;font-weight:800",
  title13: "font-size:13px;font-weight:800",
  rowTitle: `font-size:14px;font-weight:700;${ellipsis}`,
  overline: "font-size:11px;font-weight:800;letter-spacing:.08em;color:var(--muted)",
  caption: `font-size:11px;${muted}`,
  hint: `font-size:12px;${muted}`,
  hintBold: "font-size:12px;color:var(--muted);font-weight:700",
  hintLine: `font-size:12px;${muted};line-height:1.5`,
  hintParagraph: `font-size:12px;${muted};line-height:1.55`,
  note: `font-size:13px;${muted}`,
  noteParagraph: `font-size:13px;${muted};line-height:1.55`,

  // Form alanları
  fieldLabel: `${stack(6)};font-size:13px;font-weight:700;color:var(--muted)`,
  field: `${field};font-size:14px;font-weight:600`,
  fieldGrow: `flex:1;min-width:120px;${field};font-size:14px;font-weight:600`,
  fieldCompact: `min-width:0;${field};font-size:13px;font-weight:600`,
  fieldButton: `height:40px;${control};border-radius:9px;padding:0 10px;font-size:13px;font-weight:700`,
  fieldAuth: `height:44px;${control};border-radius:9px;padding:0 12px;font-size:14px;font-weight:600;color:var(--ink)`,

  // Düğmeler ve etiketler
  primary: `${primary};font-size:14px`,
  primaryLarge: `${primary};font-size:16px`,
  recordTag: "background:var(--soft3);border-radius:6px;padding:5px 8px;font-size:11px;color:var(--muted);font-weight:700",

  // Ana panel
  masterTitle: "font-size:14px;font-weight:800;color:var(--mink);letter-spacing:.3px",
  masterHint: "font-size:12px;color:var(--mmuted);line-height:1.6",

  // Belge düzenleyici araç çubuğu
  toolRow: "display:flex;flex-wrap:wrap;align-items:stretch;width:100%",
  toolGroup: "display:flex;flex-wrap:wrap;align-items:center;gap:2px",
  toolGroupLabel: "font-size:10px;font-weight:700;color:var(--muted);text-align:center;padding:3px 0 3px;white-space:nowrap",
  toolButton,
  toolMenuButton: `${toolButton};justify-content:flex-start;padding:0 7px;font-weight:600`,
  toolFieldLabel: `${stack(4)};font-size:10.5px;font-weight:700;color:var(--muted)`,
  toolField: `width:100%;height:32px;${control};border-radius:7px;padding:0 7px;font-size:12.5px;font-weight:700`,
  toolNote: "font-size:9px;color:var(--muted)",
  dropdown: `${dropdown};min-width:200px`,
  dropdownFit: `${dropdown};min-width:0`,
  menuHeading: "font-size:10px;font-weight:800;letter-spacing:.5px;color:var(--muted);padding:4px 9px 2px",
  menuItem: "display:flex;align-items:center;gap:9px;width:100%;min-height:32px;padding:5px 9px;border:none;border-radius:7px;background:transparent;color:var(--ink);font-size:12px;font-weight:600;cursor:pointer;text-align:left;white-space:nowrap",
  menuMark: "width:14px;flex:none;font-size:11px;font-weight:800;color:var(--brandink)",
});
