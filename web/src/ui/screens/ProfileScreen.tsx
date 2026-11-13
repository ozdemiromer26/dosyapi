import { st } from "../styles";
import React from "react";
import { css } from "../css";
import { PassInput } from "../parts";
import type { Vals } from "../../vm/types";
import { ProfileSecurity } from "./ProfileSecurity";

export function ProfileScreen({ v }: { v: Vals }) {
  return (
    <>
          <div style={css("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:14px;align-items:start")}>
            <div style={st.stack14}>
              <div style={css("background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap")}>
                <div style={css("width:58px;height:58px;border-radius:50%;background:repeating-linear-gradient(135deg,var(--soft3) 0 6px,var(--soft3) 6px 12px);border:1px solid var(--line);color:var(--brandink);font-size:18px;font-weight:800;display:flex;align-items:center;justify-content:center")}>{v.meInitials}</div>
                <div style={css("flex:1;min-width:140px")}>
                  <div style={css("font-size:18px;font-weight:800")}>{v.meName}</div>
                  <div style={css("font-size:13px;color:var(--muted);font-weight:600;margin-top:2px")}>{v.meEmail}</div>
                  <span style={css(v.meRoleBadgeStyle)}>{v.meRoleLabel} {v.T.kademe} {v.meLevel}</span>
                </div>
              </div>

              <div style={st.card}>
                <div style={st.title14}>{v.T.hesapBilgileri}</div>
                <label style={css("display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:var(--muted)")}>{v.T.adSoyad}
                  <input name="pName" onChange={v.onField} defaultValue={v.meName} style={st.field} />
                </label>
                <label style={css("display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:var(--muted)")}>{v.T.ePosta}
                  <input name="pEmail" onChange={v.onField} defaultValue={v.meEmail} style={st.field} />
                </label>
                <label style={st.fieldLabel}>{v.T.epostaDegisimSifre}
                  <PassInput name="pCurrent" ref={v.refPCurrent} autoComplete="current-password" onChange={v.onField} style={css("height:40px;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:0 11px;font-size:14px;font-weight:600;color:var(--ink)")} />
                </label>
                <button onClick={v.saveProfile} style={css("height:40px;border:none;border-radius:9px;background:var(--pri,#2a3180);color:#fff;font-size:14px;font-weight:700;cursor:pointer")}>{v.T.bilgileriKaydet}</button>
              </div>

              <div style={st.card}>
                <div style={st.title14}>{v.T.sifreDegistir}</div>
                <PassInput name="oldPass" ref={v.refOldPass} onChange={v.onField} placeholder={v.T.mevcutSifre} style={st.field} />
                <PassInput name="newPass" ref={v.refNewPass} onChange={v.onField} placeholder={v.T.yeniSifre} style={st.field} />
                <PassInput name="newPass2" ref={v.refNewPass2} onChange={v.onField} placeholder={v.T.yeniSifreOnayi} style={st.field} />
                <button onClick={v.savePassword} style={css("height:40px;border:1px solid var(--line);background:var(--soft3);border-radius:9px;font-size:14px;font-weight:700;cursor:pointer")}>{v.T.sifreyiGuncelle}</button>
              </div>
            </div>

            <div style={st.stack14}>
              <div style={css("background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px")}>
                <div style={st.title14}>{v.T.rolYetkilerim}</div>
                {(v.myPerms || []).map((p: any, i48: number) => (<React.Fragment key={p?.id ?? p?.key ?? i48}>
                  <div style={css("display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line3);padding:8px 0")}>
                    <span style={css(p.dotStyle)}></span>
                    <div style={css("flex:1;font-size:13px;font-weight:700")}>{p.label}</div>
                    <span style={st.hintBold}>{p.value}</span>
                  </div>
                </React.Fragment>))}
              </div>

              <ProfileSecurity v={v} />
              <div style={st.card}>
                <div style={st.title14}>{v.T.hesapSilmeTalebi}</div>
                <div style={css("font-size:12px;color:var(--muted);font-weight:600;line-height:1.6")}>{v.deleteRequestNote}</div>
                {v.deleteIsPending ? (
                  <button onClick={v.goSentApprovals} style={css("height:40px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:9px;font-size:13px;font-weight:700;cursor:pointer")}>{v.T.talebiGoruntule}</button>
                ) : null}
                {v.canRequestDelete ? (<>
                  <button onClick={v.requestSelfDelete} style={css("height:40px;border:1px solid var(--errline);background:var(--err);color:var(--errtext);border-radius:9px;font-size:13px;font-weight:700;cursor:pointer")}>{v.T.hesabiminSilinmesiniTalepEt}</button>
                </>) : null}
              </div>
            </div>
          </div>
        </>
  );
}
