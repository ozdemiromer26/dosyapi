import { tx } from "../i18n";
import { CELL, TH, esc } from "./template";

/** Tek dokunuşla eklenen inşaat tabloları. */
export const TABLE_PRESETS: { id: string; label: string; cols: string[]; rows: number }[] = [
  { id: "metraj", label: "Metraj", cols: ["Poz No", "Tanım", "Birim", "Miktar"], rows: 6 },
  { id: "malzeme", label: "Malzeme listesi", cols: ["Malzeme", "Birim", "Miktar", "Teslim tarihi"], rows: 6 },
  { id: "puantaj", label: "Puantaj", cols: ["Ad Soyad", "Görev", "Gün", "Mesai", "İmza"], rows: 6 },
  { id: "imza", label: "İmza tablosu", cols: ["Ad Soyad", "Unvan", "Tarih", "İmza"], rows: 3 },
];

export function presetTable(preset: { cols: string[]; rows: number }): string {
  const head = preset.cols.map((c) => '<th style="' + TH + '">' + esc(tx(c)) + "</th>").join("");
  const cells = preset.cols.map(() => '<td style="' + CELL + '"><br></td>').join("");
  const body = Array.from({ length: preset.rows }, () => "<tr>" + cells + "</tr>").join("");
  return '<table style="width:100%;border-collapse:collapse;margin:8px 0"><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table>";
}

/** Özel boyutlu tablo; ızgara sınırını (10×8) aşar. */
export function customTable(cols: number, rows: number, header = false): string {
  const c = Math.min(Math.max(cols, 1), 30), r = Math.min(Math.max(rows, 1), 200);
  const cells = Array.from({ length: c }, () => '<td style="' + CELL + '"><br></td>').join("");
  const body = Array.from({ length: header ? Math.max(r - 1, 1) : r }, () => "<tr>" + cells + "</tr>").join("");
  const head = header ? "<thead><tr>" + Array.from({ length: c }, () => '<th style="' + TH + '"><br></th>').join("") + "</tr></thead>" : "";
  return '<table style="width:100%;border-collapse:collapse;margin:6px 0">' + head + "<tbody>" + body + "</tbody></table>";
}
