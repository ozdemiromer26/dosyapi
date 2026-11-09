import { esc } from "./template";

/** Şantiye panosu: proje künyesi ve uygulamadaki dosyaya giden QR. */
export function boardHtml(p: { name: string; contractor: string; architect: string; location: string; slogan: string; company: string; qrSvg: string }) {
  const qr = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(p.qrSvg)));
  const field = (label: string, value: string) =>
    '<div><div style="font:500 13px monospace;letter-spacing:1px;color:#AEB6C6">' + esc(label) + '</div><div style="font-size:22px;font-weight:600;color:#fff;margin-top:6px">' + esc(value || "—") + "</div></div>";
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(p.name) + "</title>" +
    '<style>@page{size:A3 landscape;margin:12mm}html,body{margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:Arial,Helvetica,sans-serif}</style></head><body>' +
    '<div style="display:grid;grid-template-columns:1.1fr 1.4fr 240px;gap:40px;align-items:center;background:#0E1B3D;padding:44px 48px;border-bottom:12px solid #1E4FD8">' +
    '<div><div style="font-size:44px;font-weight:700;letter-spacing:-1px;color:#fff">' + esc(p.company) + '</div><div style="font-size:16px;color:#B9C4DD;margin-top:8px">' + esc(p.slogan) + "</div></div>" +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px 28px">' + field("PROJE", p.name) + field("YÜKLENİCİ", p.contractor) + field("KONUM", p.location) + field("MÜELLİF", p.architect) + "</div>" +
    '<div style="text-align:center"><div style="background:#fff;border-radius:12px;padding:12px"><img src="' + qr + '" alt="QR" style="width:100%;display:block"></div><div style="font-size:14px;color:#C4CAD6;margin-top:10px">Şantiye dosyası</div></div>' +
    "</div></body></html>"
  );
}
