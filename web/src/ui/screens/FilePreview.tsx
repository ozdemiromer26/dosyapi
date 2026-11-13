import { css } from "../css";
import type { Vals } from "../../vm/types";

/** Dosya önizleme: PDF, görsel ya da düz metin. Tam ekran katman; Esc ya da Kapat ile kapanır. */
export function FilePreview({ v }: { v: Vals }) {
  const p = v.preview, T = v.T;
  if (!p) return null;
  const btn = "height:36px;padding:0 13px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;flex:none";
  return (
    <div role="dialog" aria-modal="true" aria-label={p.name} onClick={(e) => { if (e.target === e.currentTarget) v.closePreview(); }}
      style={css("position:fixed;inset:0;z-index:90;background:rgba(10,12,20,.72);display:flex;flex-direction:column;padding:14px;gap:10px")}>
      <div style={css("display:flex;align-items:center;gap:10px;color:#fff;min-width:0")}>
        <div style={css("flex:1;min-width:0;font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{p.name}</div>
        <button onClick={v.downloadPreview} style={css(btn + ";border:1px solid rgba(255,255,255,.35);background:transparent;color:#fff")}>{T.indir}</button>
        <button onClick={v.closePreview} autoFocus style={css(btn + ";border:none;background:#fff;color:#111")}>{T.kapat}</button>
      </div>
      <div style={css("flex:1;min-height:0;display:flex;align-items:center;justify-content:center;border-radius:12px;overflow:hidden;background:" + (p.kind === "pdf" ? "#525659" : "rgba(255,255,255,.06)"))}>
        {p.error ? <div style={css("color:#fff;font-size:14px;font-weight:700;text-align:center;padding:20px")}>{p.error}</div>
          : !p.src && !p.text ? <div style={css("color:#fff;font-size:13px;font-weight:700")}>{T.yukleniyor}</div>
          : p.kind === "image" ? <img src={p.src} alt={p.name} style={css("max-width:100%;max-height:100%;object-fit:contain;background:#fff")} />
          : p.kind === "pdf" ? <iframe src={p.src} title={p.name} style={css("width:100%;height:100%;border:0;background:#fff")} />
          : <pre style={css("margin:0;width:100%;height:100%;overflow:auto;background:#fff;color:#111;padding:16px;font:13px/1.5 var(--mono);white-space:pre-wrap;word-break:break-word")}>{p.text}</pre>}
      </div>
    </div>
  );
}
