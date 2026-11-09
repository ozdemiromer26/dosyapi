import { st } from "../styles";
import React from "react";
import { css } from "../css";
import type { Vals } from "../../vm/types";

export function MasterUsers({ v }: { v: Vals }) {
  return (
    <>
          <div style={css("background:var(--mcard);border:1px solid var(--mline);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:12px")}>
            <div style={st.masterTitle}>{v.T.tumKullanicilar}</div>
            <div style={st.masterHint}>{v.T.sorgusuzEklemeRolAtama}</div>
            {(v.mUsers || []).map((u: any, i9: number) => (<React.Fragment key={u?.id ?? u?.key ?? i9}>
              <div style={css("border:1px solid var(--mline);border-radius:12px;padding:12px;background:var(--mcard2);display:flex;flex-direction:column;gap:9px")}>
                <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
                  <div style={css("width:32px;height:32px;border-radius:50%;background:var(--mchip);color:var(--mchiptext);font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center")}>{u.initials}</div>
                  <div style={css("flex:1;min-width:130px")}>
                    <div style={css("font-size:14px;font-weight:800;color:var(--mink)")}>{u.name}</div>
                    <div style={css("font-size:12px;color:var(--mmuted);font-weight:600")}>{u.email}</div>
                  </div>
                  <span style={css(u.statusStyle)}>{u.statusLabel}</span>
                </div>
                <div style={st.rowWrap8}>
                  <select onChange={u.onRole} value={u.pickRoleId} style={css("flex:1;min-width:150px;height:36px;border:1px solid var(--mline2);background:var(--minput);border-radius:8px;padding:0 9px;font-size:13px;font-weight:700;color:var(--mink)")}>
                    {(v.mRoles || []).map((r: any, i10: number) => (<React.Fragment key={r?.id ?? r?.key ?? i10}>
                      <option value={r.id}>{v.T.k}{r.level} · {r.name}</option>
                    </React.Fragment>))}
                  </select>
                  {u.isPending ? (<>
                    <button onClick={u.onApprove} style={css("height:36px;padding:0 12px;border:none;background:var(--pri,#2a3180);color:#fff;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.onayla}</button>
                  </>) : null}
                  <button onClick={u.onSendLink} style={css("height:36px;padding:0 11px;border:1px solid var(--mline2);background:var(--mbtn);color:var(--mtext);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.baglantiGonderKisa}</button>
                  <button onClick={u.onDelete} style={css("height:36px;padding:0 11px;border:1px solid var(--merrline);background:var(--merr);color:var(--merrtext);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{u.delLabel}</button>
                </div>
              </div>
            </React.Fragment>))}
            <div style={css("border-top:1px dashed var(--mline);padding-top:13px;display:flex;flex-direction:column;gap:8px")}>
              <div style={css("font-size:13px;font-weight:800;color:var(--mink)")}>{v.T.yeniKullaniciOlustur}</div>
              <div style={st.rowWrap8}>
                <input name="nuName" ref={v.refNuName} onChange={v.onField} placeholder={v.T.adSoyad2} style={css("flex:1;min-width:130px;height:40px;border:1px solid var(--mline2);background:var(--minput);border-radius:8px;padding:0 11px;font-size:13px;font-weight:600;color:var(--mink)")} />
                <input name="nuEmail" ref={v.refNuEmail} onChange={v.onField} placeholder={v.T.ePosta2} style={css("flex:1;min-width:130px;height:40px;border:1px solid var(--mline2);background:var(--minput);border-radius:8px;padding:0 11px;font-size:13px;font-weight:600;color:var(--mink)")} />
              </div>
              <div style={st.rowWrap8}>
                <select name="nuRole" onChange={v.onField} style={css("flex:1;min-width:140px;height:40px;border:1px solid var(--mline2);background:var(--minput);border-radius:8px;padding:0 9px;font-size:13px;font-weight:700;color:var(--mink)")}>
                  {(v.mRoles || []).map((r: any, i11: number) => (<React.Fragment key={r?.id ?? r?.key ?? i11}>
                    <option value={r.id}>{v.T.k}{r.level} · {r.name}</option>
                  </React.Fragment>))}
                </select>
                <button onClick={v.addUserMaster} style={css("height:40px;padding:0 14px;border:none;border-radius:8px;background:var(--pri,#2a3180);color:#fff;font-size:13px;font-weight:700;cursor:pointer")}>{v.T.ekle}</button>
              </div>
            </div>
          </div>
          </>
  );
}
