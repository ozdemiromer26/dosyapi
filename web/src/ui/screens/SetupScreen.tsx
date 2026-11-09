import { st } from "../styles";
import React from "react";
import { css } from "../css";
import type { Vals } from "../../vm/types";

const LABEL = "display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:var(--muted)";
const INPUT = "height:44px;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:0 12px;font-size:14px;font-weight:600;color:var(--ink)";

function Input({ v, name, label, type, hint }: { v: Vals; name: string; label: string; type?: string; hint?: string }) {
  return (
    <label style={css(LABEL)}>
      {label}
      <input name={name} type={type || "text"} placeholder={hint} autoComplete="off" onChange={v.onField} style={css(INPUT)} />
    </label>
  );
}

/** İlk kurulum sihirbazı. */
export function SetupScreen({ v }: { v: Vals }) {
  const T = v.T;
  return (
    <div style={css("flex:1;display:flex;align-items:center;justify-content:center;padding:32px 16px;background:radial-gradient(120% 70% at 50% 0%,var(--soft) 0%,var(--line) 100%)")}>
      <div data-form="1" onKeyDown={v.onEnterSubmit} style={css("width:100%;max-width:480px;display:flex;flex-direction:column;gap:18px")}>
        <div style={css("display:flex;flex-direction:column;align-items:center;gap:10px")}>
          {v.brandMarkLg}
          <div style={css("font-size:24px;font-weight:700;letter-spacing:-.5px;color:var(--logo-a)")}>dos<span style={css("color:var(--logo-b)")}>yapı</span></div>
          <div style={st.note}>{T.dosyapiSlogan}</div>
        </div>
        <div style={css("background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:14px;box-shadow:0 2px 10px rgba(0,0,0,.05)")}>
          <div>
            <div style={css("font-size:17px;font-weight:800")}>{T.kurulumBaslik}</div>
            <div style={css("font-size:13px;color:var(--muted);font-weight:600;line-height:1.55;margin-top:4px")}>{T.kurulumAciklama}</div>
          </div>
          <Input v={v} name="sToken" label={T.kurulumBelirteci} hint={T.kurulumBelirteciIpucu} />
          <Input v={v} name="sCompany" label={T.sirketAdiUp} />
          <div style={css("border-top:1px dashed var(--line);padding-top:12px;font-size:12px;font-weight:800;letter-spacing:.4px;color:var(--muted)")}>{T.sistemPaneli}</div>
          <Input v={v} name="sMaster" label={T.masterSifreUp} type="password" hint={T.enAz12} />
          <Input v={v} name="sMaster2" label={T.yeniSifreTekrarUp} type="password" />
          <div style={css("border-top:1px dashed var(--line);padding-top:12px;font-size:12px;font-weight:800;letter-spacing:.4px;color:var(--muted)")}>{T.ilkYonetici}</div>
          <Input v={v} name="sAdminName" label={T.adSoyad} />
          <Input v={v} name="sAdminEmail" label={T.ePosta} type="email" />
          <Input v={v} name="sAdminPass" label={T.sifre} type="password" hint={T.enAz12} />
          <Input v={v} name="sAdminPass2" label={T.yeniSifreTekrarUp} type="password" />
          <button data-submit="1" onClick={v.completeSetup} style={st.primaryLarge}>{T.kurulumuTamamla}</button>
          {v.authError ? <div style={css("background:var(--err);border:1px solid var(--errline);color:var(--errtext);border-radius:9px;padding:10px 12px;font-size:13px;font-weight:700")}>{v.authError}</div> : null}
        </div>
      </div>
    </div>
  );
}
