import { st } from "../styles";
import React from "react";
import { css } from "../css";
import type { Vals } from "../../vm/types";

export function CompanyScreen({ v }: { v: Vals }) {
  return (
    <>
          <div style={css("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:14px;align-items:start")}>
            <div style={st.cardLoose}>
              <div style={st.title14}>{v.T.belgeTipleri}</div>
              <div style={st.hintParagraph}>{v.T.herProjeAltindaIstenecek}</div>
              {(v.docTypes || []).map((d: any, i83: number) => (<React.Fragment key={d?.id ?? d?.key ?? i83}>
                <div style={css("background:var(--soft2);border-radius:10px;padding:10px 11px;display:flex;flex-direction:column;gap:8px")}>
                  <div style={css("display:flex;align-items:center;gap:9px;flex-wrap:wrap")}>
                    <div style={css("flex:1;min-width:110px;font-size:13px;font-weight:700")}>{d.name}</div>
                    <button onClick={d.onToggleReq} style={css(d.reqBtnStyle)}>{d.reqLabel}</button>
                    <button onClick={d.onDelete} aria-label={v.T.sil} style={css("width:32px;height:30px;border:1px solid var(--errline);background:var(--err);color:var(--errtext);border-radius:7px;font-size:12px;font-weight:700;cursor:pointer")}>✕</button>
                  </div>
                  <div style={st.rowCenter8}>
                    <select onChange={d.onFormat} value={d.accept} style={css("flex:1;min-width:160px;height:30px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:7px;padding:0 8px;font-size:12px;font-weight:700")}>
                      {(v.docFormats || []).map((o: any, i84: number) => (<React.Fragment key={o?.id ?? o?.key ?? i84}>
                        <option value={o.id}>{o.label}</option>
                      </React.Fragment>))}
                    </select>
                    <button onClick={d.onToggleMulti} style={css(d.multiBtnStyle)}>{d.multiLabel}</button>
                  </div>
                </div>
              </React.Fragment>))}
              <div style={st.row8}>
                <input name="dtName" ref={v.refDtName} onChange={v.onField} placeholder={v.T.yeniBelgeTipiImar} style={css("flex:1;height:40px;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:0 11px;font-size:13px;font-weight:600")} />
                <button onClick={v.addDocType} aria-label={v.T.ekle} style={css("width:52px;height:40px;border:none;border-radius:9px;background:var(--pri,#2a3180);color:#fff;font-size:18px;font-weight:700;cursor:pointer")}>+</button>
              </div>
            </div>

            <div style={st.cardLoose}>
              <div style={st.title14}>{v.T.muellifMeslekleri}</div>
              <div style={st.hintParagraph}>{v.T.muellifEklerkenMeslekYalnizca}</div>
              <div style={css("display:flex;gap:7px;flex-wrap:wrap")}>
                {(v.professions || []).map((p: any, i85: number) => (<React.Fragment key={p?.id ?? p?.key ?? i85}>
                  <span style={css("display:inline-flex;align-items:center;gap:7px;background:var(--soft3);border-radius:8px;padding:7px 10px;font-size:13px;font-weight:700")}>{p.name}
                    <button onClick={p.onToggleReq} style={css("border:none;background:var(--card);border-radius:6px;color:var(--muted);font-size:11px;font-weight:800;cursor:pointer;padding:3px 6px")}>{p.reqLabel}</button>
                    <button onClick={p.onDelete} aria-label={v.T.sil} style={css("border:none;background:none;color:var(--faint);font-size:13px;font-weight:700;cursor:pointer;padding:0")}>✕</button>
                  </span>
                </React.Fragment>))}
              </div>
              <div style={st.row8}>
                <input name="profName" ref={v.refProfName} onChange={v.onField} placeholder={v.T.yeniMeslek} style={css("flex:1;height:40px;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:0 11px;font-size:13px;font-weight:600")} />
                <button onClick={v.addProfession} aria-label={v.T.ekle} style={css("width:52px;height:40px;border:none;border-radius:9px;background:var(--pri,#2a3180);color:#fff;font-size:18px;font-weight:700;cursor:pointer")}>+</button>
              </div>
            </div>

            <div style={st.cardLoose}>
              <div style={st.title14}>{v.T.kullanicilarAmpRoller}</div>
              <div style={st.hintParagraph}>{v.userMgmtNote}</div>
              {(v.manageUsers || []).map((u: any, i86: number) => (<React.Fragment key={u?.id ?? u?.key ?? i86}>
                <div style={css("border:1px solid var(--line2);border-radius:11px;padding:12px;background:var(--soft);display:flex;flex-direction:column;gap:9px")}>
                  <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
                    <div style={css("width:32px;height:32px;border-radius:50%;background:var(--soft3);color:var(--brandink);font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center")}>{u.initials}</div>
                    <div style={css("flex:1;min-width:120px")}>
                      <div style={st.title14}>{u.name}</div>
                      <div style={st.hint}>{u.email}</div>
                    </div>
                    <span style={css(u.roleBadgeStyle)}>{u.roleLabel}</span>
                  </div>
                  {u.editable ? (<>
                    <div style={st.rowWrap8}>
                      <select onChange={u.onRole} defaultValue={u.roleId} style={css("flex:1;min-width:150px;height:36px;border:1px solid var(--line);background:var(--card);border-radius:8px;padding:0 9px;font-size:13px;font-weight:700")}>
                        {(v.assignableRoles || []).map((r: any, i87: number) => (<React.Fragment key={r?.id ?? r?.key ?? i87}>
                          <option value={r.id}>{v.T.k}{r.level} · {r.name}</option>
                        </React.Fragment>))}
                      </select>
                      <button onClick={u.onDelete} style={css("height:36px;padding:0 12px;border:1px solid var(--errline);background:var(--err);color:var(--errtext);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.sil}</button>
                    </div>
                  </>) : null}
                  {u.locked ? (<>
                    <div style={css("background:var(--soft3);border-radius:8px;padding:8px 10px;font-size:12px;font-weight:700;color:var(--muted);line-height:1.5")}>{u.lockNote}</div>
                  </>) : null}
                </div>
              </React.Fragment>))}
            </div>

          </div>
        </>
  );
}
