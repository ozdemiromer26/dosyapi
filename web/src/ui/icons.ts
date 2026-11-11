import React from "react";

export const el = (...a: any[]): any => (React.createElement as any)(...a);
export const ic = (...ch: any[]) => el("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", style: { flex: "none" } }, ch.map((c, i) => el(c[0], Object.assign({ key: i }, c[1]))));
export const R = (x, y, w, h, r?) => ["rect", { x, y, width: w, height: h, rx: r || 1.5 }];
export const C = (cx, cy, r) => ["circle", { cx, cy, r }];
export const L = (x1, y1, x2, y2) => ["line", { x1, y1, x2, y2 }];
export const ICONS = {
  home: () => ic(R(3, 3, 7, 7), R(14, 3, 7, 7), R(3, 14, 7, 7), R(14, 14, 7, 7)),
  projects: () => ic(R(3, 7, 18, 13, 2), L(3, 11, 21, 11), L(9, 7, 9, 4), L(15, 7, 15, 4)),
  messages: () => ic(["path", { d: "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" }], L(8, 10, 16, 10), L(8, 13, 13, 13)),
  tasks: () => ic(R(5, 4, 14, 17, 2), L(9, 10, 15, 10), L(9, 14, 13, 14)),
  records: () => ic(C(9, 8, 3), C(16.5, 9, 2.2), L(4, 19, 20, 19)),
  approvals: () => ic(C(12, 12, 8.5), ["polyline", { points: "8.5,12 11,14.5 15.5,9.5" }]),
  profile: () => ic(C(12, 8, 3.6), R(5, 15, 14, 5.5, 2.75)),
  company: () => ic(R(4, 4, 16, 17, 2), L(9, 9, 9, 9), L(9, 13, 9, 13), L(15, 9, 15, 9), L(15, 13, 15, 13), L(10, 21, 14, 21)),
  bell: () => ic(["path", { d: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" }], ["path", { d: "M10 20.5a2 2 0 0 0 4 0" }]),
  about: () => ic(C(12, 12, 9), L(12, 11, 12, 16.5), L(12, 7.6, 12, 7.7)),
  more: () => ic(C(5, 12, 1.4), C(12, 12, 1.4), C(19, 12, 1.4)),
  templates: () => ic(["path", { d: "M7 3h7l4 4v14H7z" }], ["polyline", { points: "14,3 14,7 18,7" }], L(10, 12, 15, 12), L(10, 16, 15, 16)),
};
export const DMARK_A = "M16 34H30A3 3 0 0 1 33 37V81A3 3 0 0 1 30 84H16A3 3 0 0 1 13 81V37A3 3 0 0 1 16 34ZM18 41H28V45H18ZM18.5 71A4.5 4.5 0 1 0 27.5 71A4.5 4.5 0 1 0 18.5 71ZM66 46H80A3 3 0 0 1 83 49V81A3 3 0 0 1 80 84H66A3 3 0 0 1 63 81V49A3 3 0 0 1 66 46ZM68 53H78V57H68ZM68.5 71A4.5 4.5 0 1 0 77.5 71A4.5 4.5 0 1 0 68.5 71Z";
export const DMARK_B = "M41 12H55A3 3 0 0 1 58 15V81A3 3 0 0 1 55 84H41A3 3 0 0 1 38 81V15A3 3 0 0 1 41 12ZM43 19H53V23H43ZM43.5 71A4.5 4.5 0 1 0 52.5 71A4.5 4.5 0 1 0 43.5 71Z";
export const DMARK = (sz, mono?) => el("svg", { width: sz, height: sz, viewBox: "0 0 96 96", role: "img", "aria-label": "dosyapı", style: { flex: "none", display: "block" } },
  el("path", { key: "a", fillRule: "evenodd", d: DMARK_A, style: { fill: mono || "var(--logo-a)" } }),
  el("path", { key: "b", fillRule: "evenodd", d: DMARK_B, style: { fill: mono || "var(--logo-b)" } }));
/** Açık zemin üzerinde iki renkli marka işareti; temadan bağımsız sabit renkler. */
export const DMARK_LIGHT = (sz) => el("svg", { width: sz, height: sz, viewBox: "0 0 96 96", role: "img", "aria-label": "dosyapı", style: { flex: "none", display: "block" } },
  el("path", { key: "a", fillRule: "evenodd", d: DMARK_A, fill: "#0E1B3D" }),
  el("path", { key: "b", fillRule: "evenodd", d: DMARK_B, fill: "#1E4FD8" }));
export const SUN = () => ic(C(12, 12, 4.1), L(12, 2.6, 12, 4.4), L(12, 19.6, 12, 21.4), L(2.6, 12, 4.4, 12), L(19.6, 12, 21.4, 12), L(5.4, 5.4, 6.7, 6.7), L(17.3, 17.3, 18.6, 18.6), L(17.3, 6.7, 18.6, 5.4), L(5.4, 18.6, 6.7, 17.3));
export const MOON = () => ic(["path", { d: "M20.6 14.5A8.7 8.7 0 1 1 9.5 3.4a6.9 6.9 0 0 0 11.1 11.1z" }]);

export const icz = (sz, ...ch: any[]) => el("svg", { width: sz, height: sz, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", style: { flex: "none", display: "block" } }, ...ch.map((c, i) => el(c[0], { key: i, ...c[1] })));
export const PTH = (d) => ["path", { d }];
export const PL = (points) => ["polyline", { points }];
export const RBI = () => ({
  save: icz(17, PTH("M5 3h11l3 3v15H5z"), PTH("M8 3v5h8V3"), R(8, 13, 8, 6, 1)),
  undo: icz(17, PTH("M9 7H5V3"), PTH("M5 7a8 8 0 1 1-1.5 7")),
  redo: icz(17, PTH("M15 7h4V3"), PTH("M19 7a8 8 0 1 0 1.5 7")),
  outdent: icz(17, L(11, 6, 20, 6), L(11, 10, 20, 10), L(11, 14, 20, 14), L(4, 18, 20, 18), PL("7,8 4,10 7,12")),
  indent: icz(17, L(11, 6, 20, 6), L(11, 10, 20, 10), L(11, 14, 20, 14), L(4, 18, 20, 18), PL("4,8 7,10 4,12")),
  spacing: icz(17, L(11, 6, 20, 6), L(11, 12, 20, 12), L(11, 18, 20, 18), PL("4,7 6,5 8,7"), PL("4,17 6,19 8,17"), L(6, 5, 6, 19)),
  table: icz(26, R(3, 4, 18, 16, 1.5), L(3, 9.5, 21, 9.5), L(3, 14.5, 21, 14.5), L(9, 4, 9, 20), L(15, 4, 15, 20)),
  image: icz(26, R(3, 4, 18, 16, 2), C(8.5, 9.5, 1.8), PL("21,16 15.5,11 6,20")),
  logo: icz(26, R(4, 4, 16, 16, 3), PTH("M8 16l4-8 4 8z")),
  sig: icz(26, PTH("M3 16c3-1 4-9 6-9s0 8 2 8 2-4 4-4 1 3 3 3"), L(3, 20, 21, 20)),
  pb: icz(26, PTH("M5 3v6h14V3"), PTH("M5 21v-6h14v6"), L(3, 12, 5, 12), L(8, 12, 10, 12), L(14, 12, 16, 12), L(19, 12, 21, 12)),
  hr: icz(26, L(6, 6, 18, 6), L(3, 12, 21, 12), L(6, 18, 18, 18)),
  list: icz(26, C(5, 7, 1), C(5, 12, 1), C(5, 17, 1), L(9, 7, 20, 7), L(9, 12, 20, 12), L(9, 17, 20, 17), R(2, 3, 20, 18, 2)),
  margins: icz(26, R(5, 3, 14, 18, 1.5), ["rect", { x: 8, y: 6, width: 8, height: 12, rx: 0.5, strokeDasharray: "2 2" }]),
  orient: icz(26, R(3, 6, 10, 15, 1.5), R(10, 3, 11, 8, 1.5)),
  size: icz(26, R(6, 3, 12, 18, 1.5), L(9, 8, 15, 8), L(9, 12, 15, 12)),
  pageno: icz(26, R(5, 3, 14, 18, 1.5), L(9, 7, 15, 7), L(9, 10, 15, 10), L(11, 17, 13, 17)),
  rowA: icz(17, R(3, 11, 18, 9, 1.5), L(3, 15.5, 21, 15.5), L(12, 2, 12, 8), L(9, 5, 15, 5)),
  rowB: icz(17, R(3, 4, 18, 9, 1.5), L(3, 8.5, 21, 8.5), L(12, 16, 12, 22), L(9, 19, 15, 19)),
  colL: icz(17, R(11, 3, 9, 18, 1.5), L(15.5, 3, 15.5, 21), L(2, 12, 8, 12), L(5, 9, 5, 15)),
  colR: icz(17, R(4, 3, 9, 18, 1.5), L(8.5, 3, 8.5, 21), L(16, 12, 22, 12), L(19, 9, 19, 15)),
  del: icz(26, R(3, 5, 18, 14, 1.5), L(9, 9, 15, 15), L(15, 9, 9, 15)),
  merge: icz(26, R(3, 5, 18, 14, 1.5), PL("7,10 9.5,12 7,14"), PL("17,10 14.5,12 17,14"), L(9.5, 12, 14.5, 12)),
  dist: icz(17, R(3, 5, 18, 14, 1.5), L(9, 5, 9, 19), L(15, 5, 15, 19)),
  split: icz(26, R(3, 5, 18, 14, 1.5), L(12, 5, 12, 19), PL("9,10 6.5,12 9,14"), PL("15,10 17.5,12 15,14")),
  colw: icz(15, L(3, 12, 21, 12), PL("6,9 3,12 6,15"), PL("18,9 21,12 18,15")),
  rowh: icz(15, L(12, 3, 12, 21), PL("9,6 12,3 15,6"), PL("9,18 12,21 15,18")),
  width: icz(17, L(3, 12, 21, 12), PL("6,9 3,12 6,15"), PL("18,9 21,12 18,15")),
  pad: icz(17, R(4, 4, 16, 16, 1.5), ["rect", { x: 8, y: 8, width: 8, height: 8, rx: 0.5, strokeDasharray: "2 1.5" }]),
  vt: icz(17, R(4, 4, 16, 16, 1.5), L(8, 8, 16, 8), L(8, 11, 16, 11)),
  vm: icz(17, R(4, 4, 16, 16, 1.5), L(8, 10.5, 16, 10.5), L(8, 13.5, 16, 13.5)),
  vb: icz(17, R(4, 4, 16, 16, 1.5), L(8, 13, 16, 13), L(8, 16, 16, 16)),
  shade: icz(26, PTH("M5 13l7-7 6 6-7 7z"), PTH("M19 14s2 2.5 2 4a2 2 0 0 1-4 0c0-1.5 2-4 2-4z")),
  borders: icz(16, R(4, 4, 16, 16, 1), ["line", { x1: 12, y1: 4, x2: 12, y2: 20, strokeDasharray: "2 2" }], ["line", { x1: 4, y1: 12, x2: 20, y2: 12, strokeDasharray: "2 2" }]),
});
export const TBI = {
  al: () => ic(L(4, 6, 20, 6), L(4, 10, 14, 10), L(4, 14, 20, 14), L(4, 18, 14, 18)),
  ac: () => ic(L(4, 6, 20, 6), L(7, 10, 17, 10), L(4, 14, 20, 14), L(7, 18, 17, 18)),
  ar: () => ic(L(4, 6, 20, 6), L(10, 10, 20, 10), L(4, 14, 20, 14), L(10, 18, 20, 18)),
  aj: () => ic(L(4, 6, 20, 6), L(4, 10, 20, 10), L(4, 14, 20, 14), L(4, 18, 20, 18)),
  ul: () => ic(C(5, 7, 1.1), C(5, 12, 1.1), C(5, 17, 1.1), L(9, 7, 20, 7), L(9, 12, 20, 12), L(9, 17, 20, 17)),
  ol: () => ic(L(10, 7, 20, 7), L(10, 12, 20, 12), L(10, 17, 20, 17), L(5, 5, 5, 9), ["polyline", { points: "4,15 6.5,15 4,19 6.5,19" }]),
  undo: () => ic(["path", { d: "M9 7H5V3" }], ["path", { d: "M5 7a8 8 0 1 1-1.5 7" }]),
  redo: () => ic(["path", { d: "M15 7h4V3" }], ["path", { d: "M19 7a8 8 0 1 0 1.5 7" }]),
};

