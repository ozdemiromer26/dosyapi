import { st } from "../styles";
import React from "react";
import { css } from "../css";
import type { Vals } from "../../vm/types";

export function MasterFiles({ v }: { v: Vals }) {
  return (
    <>
          <div style={css("background:var(--mcard);border:1px solid var(--mline);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:12px")}>
            <div style={st.masterTitle}>{v.T.sunucuDosyalari}</div>
            <div style={st.masterHint}>{v.T.sunucudakiTumProjeBelgeleri}</div>
            <div style={st.rowWrap8}>
              <input name="mFileQ" onChange={v.onServerSearch} placeholder={v.T.dosyaProjeVeyaBelge} style={css("flex:1;min-width:180px;height:40px;border:1px solid var(--mline2);background:var(--minput);border-radius:9px;padding:0 11px;font-size:13px;font-weight:600;color:var(--mink)")} />
              <button onClick={v.fxExpandAll} style={css("height:40px;padding:0 12px;border:1px solid var(--mline2);background:var(--mbtn);color:var(--mtext);border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap")}>{v.T.tumunuAc}</button>
              <button onClick={v.fxCollapseAll} style={css("height:40px;padding:0 12px;border:1px solid var(--mline2);background:var(--mbtn);color:var(--mtext);border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap")}>{v.T.tumunuKapat}</button>
            </div>
            <div style={css("border:1px solid var(--mline);border-radius:12px;background:var(--mcard2);overflow:hidden;display:flex;flex-direction:column")}>
              {(v.fxRows || []).map((n: any, i12: number) => (<React.Fragment key={n?.id ?? n?.key ?? i12}>
                <div style={css(n.rowStyle)}>
                  {n.isFolder ? (<>
                    <button onClick={n.onToggle} style={css("flex:1;min-width:0;display:flex;align-items:center;gap:8px;border:none;background:none;padding:0;cursor:pointer;text-align:left;color:var(--mink)")}>
                      <span style={css("width:14px;flex:none;font-size:11px;color:var(--mmuted)")}>{n.chev}</span>
                      <span style={css(n.iconStyle)}>{n.icon}</span>
                      <span style={css(n.nameStyle)}>{n.name}</span>
                      <span style={css("flex:none;font-size:11px;font-weight:700;color:var(--mmuted)")}>{n.count}</span>
                    </button>
                  </>) : null}
                  {n.isFile ? (<>
                    <span style={css("width:14px;flex:none")}></span>
                    <div style={css("width:30px;height:30px;flex:none;border-radius:7px;background:var(--minput);border:1px solid var(--mline2);color:var(--mmuted);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center")}>{n.ext}</div>
                    <div style={css("flex:1;min-width:0")}>
                      <div style={css("font-size:13px;font-weight:700;color:var(--mink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{n.name}</div>
                      <div style={css("font-size:11px;color:var(--mmuted);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{n.meta}</div>
                    </div>
                    {n.canPreview ? <button onClick={n.onPreview} aria-label={v.T.onizle} title={v.T.onizle} style={css("flex:none;width:32px;height:30px;padding:0;border:1px solid var(--mline2);background:var(--mbtn);color:var(--mtext);border-radius:7px;cursor:pointer;display:flex;align-items:center;justify-content:center")}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg></button> : null}
                    <button onClick={n.onDownload} style={css("flex:none;height:30px;padding:0 10px;border:1px solid var(--mline2);background:var(--mbtn);color:var(--mtext);border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap")}>{v.T.indir}</button>
                    <button onClick={n.onDelete} aria-label={v.T.sil} style={css("flex:none;width:32px;height:30px;border:1px solid var(--merrline);background:var(--merr);color:var(--merrtext);border-radius:7px;font-size:12px;font-weight:700;cursor:pointer")}>✕</button>
                  </>) : null}
                </div>
              </React.Fragment>))}
            </div>
            {v.noServerFiles ? (<>
              <div style={css("padding:22px 0;text-align:center;font-size:13px;color:var(--mmuted);font-weight:600")}>{v.T.dosyaBulunamadi}</div>
            </>) : null}
          </div>
          </>
  );
}
