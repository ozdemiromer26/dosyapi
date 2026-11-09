import { st } from "../styles";
import React from "react";
import { css } from "../css";
import type { Vals } from "../../vm/types";

const CARD = "background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px";
const BTN = "height:40px;padding:0 14px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:9px;font-size:13px;font-weight:700;cursor:pointer";
const INPUT = "flex:1;min-width:150px;height:40px;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:0 11px;font-size:13px;font-weight:600;color:var(--ink)";

/** Sunucunun ürettiği QR SVG'si; <img> içinde gösterildiği için betik çalıştıramaz. */
export const qrSrc = (svg: string) => "data:image/svg+xml;base64," + btoa(svg);

/** Kullanıcının iki adımlı doğrulama ve oturum güvenliği kartı. */
export function ProfileSecurity({ v }: { v: Vals }) {
  const T = v.T, setup = v.totpSetup;
  return (
    <div style={css(CARD)}>
      <div style={css("display:flex;align-items:center;gap:8px")}>
        <div style={css("flex:1;min-width:0;font-size:14px;font-weight:800")}>{T.ikiAdimBaslik}</div>
        <span style={css("flex:none;font-size:11px;font-weight:800;padding:4px 9px;border-radius:999px;" + (v.meTotp ? "background:var(--ok);color:var(--oktext)" : "background:var(--soft3);color:var(--muted)"))}>{v.meTotp ? T.acik : T.kapali}</span>
      </div>
      <div style={st.hintParagraph}>{T.ikiAdimNot}</div>
      {v.meTotp ? (
        <>
          <div style={st.hintParagraph}>{T.ikiAdimKapatNot}</div>
          <div style={st.rowWrap8}>
            <input name="ptPass" ref={v.refPtPass} type="password" autoComplete="current-password" placeholder={T.mevcutSifre} onChange={v.onField} style={css(INPUT)} />
            <button onClick={v.totpDisable} style={css(BTN + ";border-color:var(--errline);background:var(--err);color:var(--errtext)")}>{T.ikiAdimKapat}</button>
          </div>
        </>
      ) : setup ? (
        <>
          <div style={st.hintParagraph}>{T.ikiAdimQr}</div>
          {setup.qr ? <img src={qrSrc(setup.qr)} alt={T.ikiAdimQrAlt} width={196} height={196} style={css("align-self:flex-start;width:196px;height:196px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:6px;box-sizing:border-box")} /> : null}
          <div style={st.hintParagraph}>{T.ikiAdimElle}</div>
          <div style={css("font-family:var(--mono);font-size:13px;word-break:break-all;background:var(--soft3);padding:8px 10px;border-radius:8px;user-select:all")}>{setup.secret}</div>
          <div style={st.rowWrap8}>
            <input name="ptCode" ref={v.refPtCode} inputMode="numeric" autoComplete="one-time-code" placeholder={T.dogrulamaKodu} onChange={v.onField} style={css(INPUT)} />
            <button onClick={v.totpConfirm} style={css(BTN + ";border:none;background:var(--pri,#2a3180);color:#fff")}>{T.dogrula}</button>
            <button onClick={v.totpCancel} style={css(BTN)}>{T.vazgec}</button>
          </div>
        </>
      ) : (
        <button onClick={v.totpBegin} style={css(BTN + ";align-self:flex-start")}>{T.ikiAdimAc}</button>
      )}
      <button onClick={v.logoutOthers} style={css(BTN + ";align-self:flex-start")}>{T.digerOturumlar}</button>
    </div>
  );
}
