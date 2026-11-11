import { st } from "../styles";
import React from "react";
import { css } from "../css";
import { PoweredBy, NoteBox, AuthBackdrop, AUTH_BG } from "../parts";
import type { Vals } from "../../vm/types";

export function AuthScreen({ v }: { v: Vals }) {
  return (
    <>
    <div style={css("flex:1;position:relative;display:flex;align-items:center;justify-content:center;padding:32px 16px;" + AUTH_BG)}>
      <AuthBackdrop />
      <div style={css("position:absolute;top:16px;right:16px;z-index:2;display:flex;align-items:center;gap:8px")}>
        <button onClick={v.toggleLang} aria-label={v.T.dil} style={css(v.langBtnStyle)}>{v.langLabel}</button>
        <button onClick={v.toggleTheme} aria-label={v.T.karanlikMod2} style={css(v.themeIconBtnStyle)}>{v.themeIcon}</button>
      </div>
      <div style={css("position:relative;z-index:1;width:100%;max-width:420px;display:flex;flex-direction:column;gap:20px")}>
        <div style={css("display:flex;flex-direction:column;align-items:center;gap:12px")}>
          {v.hasLogo ? (<>
            <img src={v.logoUrl} alt="Logo" style={css("width:62px;height:62px;border-radius:17px;object-fit:cover")} />
          </>) : null}
          {v.noLogo ? (<>
            <div style={css("width:62px;height:62px;border-radius:17px;background:var(--pri,#2a3180);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:21px")}>{v.companyMonogram}</div>
          </>) : null}
          <div style={css("text-align:center")}>
            <div style={css("font-size:18px;font-weight:800;letter-spacing:-.3px")}>{v.companyName}</div>
          </div>
        </div>

        <div style={css("background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:16px;box-shadow:0 2px 10px rgba(0,0,0,.05)")}>
          <div style={css("display:flex;background:var(--soft3);border-radius:10px;padding:4px;gap:4px")}>
            <button onClick={v.showLogin} style={css(v.loginTabStyle)}>{v.T.girisYap}</button>
            <button onClick={v.showRegister} style={css(v.registerTabStyle)}>{v.T.kayitOl}</button>
          </div>

          {v.isLogin ? (<>
            <div data-form="1" onKeyDown={v.onEnterSubmit} style={st.stack13}>
              <label style={st.fieldLabel}>{v.T.ePosta}
                <input name="email" onChange={v.onField} type="email" placeholder={v.T.ornekYapiCom} style={st.fieldAuth} />
              </label>
              <label style={st.fieldLabel}>{v.T.sifre}
                <input name="pass" onChange={v.onField} type="password" placeholder="••••••••" style={st.fieldAuth} />
              </label>
              {v.totpNeeded ? (<><label style={st.fieldLabel}>{v.T.dogrulamaKodu}
                <input name="code" onChange={v.onField} autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} maxLength={20} placeholder="000000" style={st.fieldAuth} />
                <span style={css("display:block;margin-top:6px;font-size:12px;font-weight:600;color:var(--muted);line-height:1.5")}>{v.T.kurtarmaGirisNot}</span>
              </label></>) : null}
              <div style={css("display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap")}>
                <button onClick={v.toggleRemember} style={css("display:flex;align-items:center;gap:9px;border:none;background:none;padding:2px 0;cursor:pointer")}>
                  <span style={css(v.rememberCheckStyle)}>{v.rememberMark}</span>
                  <span style={css("font-size:13px;font-weight:700;color:var(--muted)")}>{v.T.oturumumAcikKalsin}</span>
                </button>
                <button onClick={v.showForgot} style={css("border:none;background:none;padding:2px 0;font-size:13px;font-weight:700;color:var(--brandink);cursor:pointer")}>{v.T.sifremiUnuttum}</button>
              </div>
              <button data-submit="1" onClick={v.doLogin} style={st.primaryLarge}>{v.T.girisYap}</button>
            </div>
          </>) : null}

          {v.isRegister ? (<>
            <div data-form="1" onKeyDown={v.onEnterSubmit} style={st.stack13}>
              <label style={st.fieldLabel}>{v.T.adSoyad}
                <input name="name" onChange={v.onField} placeholder={v.T.ayseYildirim} style={st.fieldAuth} />
              </label>
              <label style={st.fieldLabel}>{v.T.ePosta}
                <input name="email" onChange={v.onField} type="email" placeholder={v.T.ornekYapiCom} style={st.fieldAuth} />
              </label>
              {v.domainHint ? (<>
                <div style={css("margin-top:-5px;font-size:12px;font-weight:700;color:var(--muted)")}>{v.domainHint}</div>
              </>) : null}
              <div style={st.rowWrap10}>
                <label style={css("flex:1;min-width:140px;display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:var(--muted)")}>{v.T.telefon}
                  <input name="phone" onChange={v.onField} placeholder="0532 000 00 00" style={st.fieldAuth} />
                </label>
                <label style={css("flex:1;min-width:140px;display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:var(--muted)")}>{v.T.sifre}
                  <input name="pass" onChange={v.onField} type="password" placeholder={v.T.enAz4Karakter} style={st.fieldAuth} />
                </label>
              </div>
              <NoteBox tone="info" extra="padding:11px 12px;font-size:12px;font-weight:600;line-height:1.55">{v.T.kayitTalebinizYetkiliBir}</NoteBox>
              {v.hasNotice ? (
                <div style={css("display:flex;align-items:flex-start;gap:9px")}>
                  <button onClick={v.toggleNotice} role="checkbox" aria-checked={!!v.noticeAccepted} aria-label={v.T.aydinlatmaOnay} style={css(v.noticeCheckStyle)}>{v.noticeMark}</button>
                  <span style={css("font-size:13px;font-weight:600;color:var(--muted);line-height:1.5")}>
                    <button onClick={v.openNotice} style={css("border:none;background:none;padding:0;font-size:13px;font-weight:700;color:var(--brandink);cursor:pointer;text-decoration:underline")}>{v.T.aydinlatmaMetni}</button> {v.T.aydinlatmaOkudum}
                  </span>
                </div>
              ) : null}
              <button data-submit="1" onClick={v.doRegister} style={st.primaryLarge}>{v.T.kayitTalebiGonder}</button>
            </div>
          </>) : null}

          {v.isForgot ? (<>
            <div data-form="1" onKeyDown={v.onEnterSubmit} style={st.stack13}>
              <div style={st.noteParagraph}>{v.T.sifreSifirlamaAciklama}</div>
              <label style={st.fieldLabel}>{v.T.ePosta}
                <input name="fEmail" onChange={v.onField} type="email" placeholder={v.T.ornekYapiCom} style={st.fieldAuth} />
              </label>
              <button data-submit="1" onClick={v.sendForgot} style={st.primaryLarge}>{v.T.baglantiGonder}</button>
              <button onClick={v.showLogin} style={css("align-self:flex-start;border:none;background:none;padding:2px 0;font-size:13px;font-weight:700;color:var(--brandink);cursor:pointer")}>{v.T.giriseDon}</button>
            </div>
          </>) : null}

          {v.isReset ? (<>
            <div data-form="1" onKeyDown={v.onEnterSubmit} style={st.stack13}>
              <div>
                <div style={css("font-size:16px;font-weight:800")}>{v.T.yeniSifreBelirle}</div>
                <div style={css("font-size:13px;color:var(--muted);font-weight:600;margin-top:3px")}>{v.resetForLabel}</div>
              </div>
              <label style={st.fieldLabel}>{v.T.yeniSifreUp}
                <input name="rNew" onChange={v.onField} type="password" placeholder={v.T.enAz4Karakter} style={st.fieldAuth} />
              </label>
              <label style={st.fieldLabel}>{v.T.yeniSifreTekrarUp}
                <input name="rNew2" onChange={v.onField} type="password" placeholder="••••••••" style={st.fieldAuth} />
              </label>
              <button data-submit="1" onClick={v.doResetPass} style={st.primaryLarge}>{v.T.sifreyiSifirla}</button>
              <button onClick={v.showLogin} style={css("align-self:flex-start;border:none;background:none;padding:2px 0;font-size:13px;font-weight:700;color:var(--brandink);cursor:pointer")}>{v.T.giriseDon}</button>
            </div>
          </>) : null}

          {v.authError ? (<>
            <NoteBox tone="err" role="alert">{v.authError}</NoteBox>
          </>) : null}
          {v.authInfo ? (<>
            <NoteBox tone="ok" role="status">{v.authInfo}</NoteBox>
          </>) : null}

          
        </div>

        <div onClick={v.brandTap} style={css("display:flex;justify-content:center;user-select:none")}>
          <PoweredBy mark={v.brandMarkXs} size={14} label={12} />
        </div>

      </div>
    </div>
  </>
  );
}
