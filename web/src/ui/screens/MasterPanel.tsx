import React from "react";
import { css } from "../css";
import { Note, PassInput } from "../parts";
import type { Vals } from "../../vm/types";
import { MasterIdentity } from "./MasterIdentity";
import { MasterRoles } from "./MasterRoles";
import { MasterUsers } from "./MasterUsers";
import { MasterFiles } from "./MasterFiles";
import { MasterSystem } from "./MasterSystem";
import { MasterDns } from "./MasterDns";
import { MasterMail } from "./MasterMail";
import { MasterSecurity } from "./MasterSecurity";
import { MasterAbout } from "./MasterAbout";

export function MasterPanel({ v }: { v: Vals }) {
  return (
    <>
    <div style={css("flex:1;background:var(--mbg);padding:0 0 60px;--pri:#1E4FD8;--brandink:var(--mbrandink);font-family:var(--sans)")}>
      <div style={css("position:sticky;top:0;z-index:10;background:var(--mbg);border-bottom:1px solid var(--mline);padding:14px 18px;display:flex;align-items:center;gap:" + (v.isDesktop ? 12 : 8) + "px")}>
        <div style={css("width:34px;height:34px;border-radius:9px;background:#FFFFFF;border:1px solid var(--mline);display:flex;align-items:center;justify-content:center;flex:none")}>{v.brandMarkLight}</div>
        {/* Başlık tek satır kalır: mobilde de Çıkış alta düşmez. */}
        <div style={css("flex:1;min-width:0")}>
          <div style={css("font-size:14px;color:var(--mink);white-space:nowrap")}><span className="wm">dos<span style={css("color:var(--logo-b)")}>yapı</span></span></div>
          <div style={css("font-size:12px;color:var(--mmuted);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{v.T.sistemPaneliAd}</div>
        </div>
        <button onClick={v.toggleLang} aria-label={v.T.dil} style={css(v.langBtnStyleM)}>{v.langLabel}</button>
        <button onClick={v.toggleTheme} aria-label={v.T.karanlikMod2} style={css(v.themeIconBtnStyleM)}>{v.themeIcon}</button>
        <button onClick={v.closeMaster} style={css("flex:none;white-space:nowrap;height:36px;padding:0 " + (v.isDesktop ? 14 : 11) + "px;border-radius:9px;border:1px solid var(--merrline);background:var(--merr);color:var(--merrtext);font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:7px")}>{v.logoutIcon}{v.T.cikis}</button>
      </div>

      {v.gateBlocked ? (
        <div role="alert" style={css("max-width:440px;margin:" + v.gateCardMargin + ";background:var(--mcard);border:1px solid var(--mline);border-radius:16px;padding:24px;display:flex;flex-direction:column;gap:14px")}>
          <div style={css("display:flex;align-items:center;gap:12px")}>
            <span style={css("width:48px;height:48px;flex:none;border-radius:14px;background:var(--merr);border:1px solid var(--merrline);color:var(--merrtext);display:flex;align-items:center;justify-content:center")}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /><line x1="12" y1="14.5" x2="12" y2="16.5" /></svg>
            </span>
            <div style={css("min-width:0")}>
              <div style={css("font-size:16px;font-weight:800;color:var(--mink)")}>{v.gateTitle}</div>
              {v.gateSub ? <div style={css("font-size:12.5px;color:var(--mmuted);font-weight:600;margin-top:2px")}>{v.gateSub}</div> : null}
            </div>
          </div>
          <div style={css("font-size:13px;color:var(--mmuted);line-height:1.6")}>{v.gateText}</div>
          <div style={css(v.gateCmdStyle)}>
            <code style={css("flex:1;min-width:0;font-family:var(--mono);font-size:" + v.gateCmdFont + ";font-weight:600;color:#E3E9F5;letter-spacing:.01em;white-space:nowrap;overflow-x:auto")}><span style={css("color:#93A0BC")}>$</span> {v.gateCmd}</code>
            <button onClick={v.copyGateCmd} style={css("flex:none;height:32px;padding:0 12px;border:1px solid #2E3F69;background:#172443;color:#E3E9F5;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.kopyala}</button>
          </div>
          <div style={css("display:flex;flex-direction:column")}>
            {(v.gateRows || []).map((r: any) => (
              <div key={r.k} style={css("display:flex;gap:10px;padding:8px 0;border-top:1px solid var(--mline);font-size:12.5px")}>
                <span style={css(v.gateRowKey + ";color:var(--mmuted);font-weight:700")}>{r.k}</span>
                <span style={css("flex:1;min-width:0;color:var(--mink);font-weight:700;word-break:break-all")}>{r.v}</span>
              </div>
            ))}
          </div>
          {!v.gateDisabled ? <Note tone="info">{v.T.kilitKomutNot}</Note> : null}
          {!v.gateDisabled ? <button onClick={v.retryGate} style={css("height:44px;border:1px solid var(--mline2);border-radius:9px;background:var(--mbtn);color:var(--mtext);font-size:14px;font-weight:700;cursor:pointer")}>{v.T.tekrarDene}</button> : null}
        </div>
      ) : null}

      {v.masterLocked ? (<>
        <div data-form="1" onKeyDown={v.onEnterSubmit} style={css("max-width:380px;margin:60px auto;background:var(--mcard);border:1px solid var(--mline);border-radius:16px;padding:24px;display:flex;flex-direction:column;gap:14px")}>
          <div style={css("font-size:16px;font-weight:800;color:var(--mink)")}>{v.T.masterSifre}</div>
          <div style={css("font-size:13px;color:var(--mmuted);line-height:1.6")}>{v.T.devamEtmekIcinMaster}</div>
          <PassInput name="mPass" onChange={v.onField} placeholder="••••••••" style={css("height:44px;border:1px solid var(--mline2);background:var(--minput);border-radius:9px;padding:0 12px;font-size:14px;font-weight:600;color:var(--mink)")} />
          {v.masterTotpNeeded ? <input name="mCode" onChange={v.onField} inputMode="numeric" placeholder={v.T.dogrulamaKodu} style={css("height:44px;border:1px solid var(--mline2);background:var(--minput);border-radius:9px;padding:0 12px;font-size:14px;font-weight:600;color:var(--mink)")} /> : null}
          <button data-submit="1" onClick={v.masterLogin} style={css("height:44px;border:none;border-radius:9px;background:var(--pri,#1E4FD8);color:#fff;font-size:14px;font-weight:700;cursor:pointer")}>{v.T.paneleGir}</button>
          {v.masterError ? (<>
            <div style={css("background:var(--merr);border:1px solid var(--merrline);color:var(--merrtext);border-radius:9px;padding:10px 12px;font-size:13px;font-weight:700")}>{v.masterError}</div>
          </>) : null}
        </div>
      </>) : null}

      {v.masterAuthed ? (<>
        <div style={css(v.masterLayoutStyle)}>
          <div style={css(v.masterMenuStyle)}>
            {(v.masterMenu || []).map((m: any, i1: number) => (<React.Fragment key={m?.id ?? m?.key ?? i1}>
              <button onClick={m.onClick} style={css(m.style)}>{m.label}</button>
            </React.Fragment>))}
          </div>

          <div style={css("flex:1;min-width:0;max-width:820px;display:flex;flex-direction:column;gap:16px")}>

          {v.mIsKimlik ? <MasterIdentity v={v} /> : null}

          {v.mIsRoller ? <MasterRoles v={v} /> : null}

          {v.mIsKullanicilar ? <MasterUsers v={v} /> : null}

          {v.mIsProjeler ? <MasterFiles v={v} /> : null}

          {v.mIsDns ? <MasterDns v={v} /> : null}
          {v.mIsEposta ? <MasterMail v={v} /> : null}
          {v.mIsSistem ? <MasterSystem v={v} /> : null}

          {v.mIsGuvenlik ? <MasterSecurity v={v} /> : null}

          {v.mIsHakkinda ? <MasterAbout v={v} /> : null}

          </div>
        </div>
      </>) : null}
    </div>
  </>
  );
}
