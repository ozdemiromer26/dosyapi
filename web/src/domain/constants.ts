import { tx } from "../i18n";

/** Evrensel benzersiz kimlik (HTTP üzerinde de çalışır). */
export const uid = (): string => {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
};
export const ini = (s) => (s || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
export const PROJ_OPTS = [["edit", "Doğrudan düzenle"], ["approve", "Onaylı düzenle"], ["read", "Salt okuma"], ["none", "Erişim yok"]];
export const STATUSES = [
  ["etut", "Etüt aşaması"], ["uygulama", "Uygulama aşaması"], ["denetim", "Yapı denetime gönderildi"],
  ["belediye", "Belediye kontrolünde"], ["mimari", "Mimari onaylandı"], ["tumproje", "Tüm projeler onaylandı"],
  ["ruhsat", "Ruhsat alındı"], ["iskan", "İskan alındı"],
];
export const STATUS_LABEL = (id) => tx((STATUSES.find(x => x[0] === id) || ["", "Etüt aşaması"])[1]);
export const DOC_FORMATS = [["all", "Tüm dosya tipleri"], ["pdf", "Yalnızca PDF"], ["pdfimg", "PDF + görsel"], ["image", "Görsel (JPG/PNG)"], ["cad", "Çizim (DWG/DXF)"], ["office", "Ofis belgesi"]];
export const ACCEPT_ATTR = { all: "*/*", pdf: ".pdf", pdfimg: ".pdf,image/*", image: "image/*", cad: ".dwg,.dxf", office: ".doc,.docx,.xls,.xlsx,.ppt,.pptx" };
export const FMT_LABEL = (id) => tx((DOC_FORMATS.find(x => x[0] === (id || "all")) || DOC_FORMATS[0])[1]);
export const MSECTIONS = [["kimlik", "Şirket kimliği"], ["roller", "Roller & yetkiler"], ["kullanicilar", "Kullanıcılar"], ["projeler", "Sunucu dosyaları"], ["dns", "Alan adı & DNS"], ["eposta", "E-posta"], ["sistem", "Sistem"], ["guvenlik", "Güvenlik"], ["hakkinda", "Hakkında"]];
export const FLAGS = [["company", "Şirket ayarları"], ["users", "Kullanıcı yönetimi"], ["approve", "Kayıt onaylama"], ["tasks", "Görev atama"], ["files", "Dosya yükleme"], ["templates", "Şablon yönetimi"]];

export const TPL_CTX = [["project", "Proje detayı"], ["authors", "Müellifler"], ["contractor", "Müteahhitler"]];
export const PAGE_SIZES = { A4: [210, 297], A5: [148, 210], Letter: [215.9, 279.4] };
export const FONTS = [["'Times New Roman', Times, serif", "Times New Roman"], ["Arial, Helvetica, sans-serif", "Arial"], ["Calibri, Carlito, Arial, sans-serif", "Calibri"], ["Georgia, serif", "Georgia"], ["Cambria, Georgia, serif", "Cambria"], ["Garamond, 'EB Garamond', serif", "Garamond"], ["Verdana, Geneva, sans-serif", "Verdana"], ["Tahoma, Verdana, sans-serif", "Tahoma"], ["'Trebuchet MS', Arial, sans-serif", "Trebuchet MS"], ["'Courier New', Courier, monospace", "Courier New"]];
export const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
export const FC_COLORS = ["#000000", "#434343", "#666666", "#999999", "#2a3180", "#1d72b8", "#1b6b3a", "#a8341a", "#c0392b", "#d35400", "#b7950b", "#27ae60", "#16a085", "#2980b9", "#8e44ad", "#7f8c8d"];
export const HL_COLORS = ["#fff176", "#a5d6a7", "#81d4fa", "#f48fb1", "#ffcc80", "#ce93d8", "#e0e0e0", "#b2dfdb"];
export const SH_COLORS = ["#f2f2f2", "#e6e6e6", "#d9d9d9", "#bfbfbf", "#e9eefb", "#dbe5f1", "#e2efda", "#fdecea", "#fff4ce", "#fce4d6", "#ede7f6", "#2a3180"];
export const BC_COLORS = ["#000000", "#444444", "#7f7f7f", "#bfbfbf", "#2a3180", "#1d72b8", "#1b6b3a", "#a8341a"];
export const COLORS = ["#111111", "#2a3180", "#1d72b8", "#a8341a", "#1b6b3a", "#8a5a00", "#6b6b6b"];

/** Yerel takvim günü "YYYY-AA-GG" (görev terminleriyle aynı biçim). */
export function localToday(d = new Date()) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
