import { st } from "../styles";
import React from "react";
import { css } from "../css";
import type { Vals } from "../../vm/types";
import { AuthBackdrop, AUTH_BG, NoteBox } from "../parts";

/** İlk kurulum: dört adımlı sihirbaz (belirteç → şirket → sistem paneli → ilk yönetici) ve özet.
 *  Adımlar yalnızca istemci durumudur; kurulum son adımda tek istekle (`/setup`) yapılır. */

const LABEL = "display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:var(--muted)";
const INPUT = "height:44px;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:0 12px;font-size:14px;font-weight:600;color:var(--ink)";
const MIN = 12;

type F = { sToken: string; sCompany: string; sMaster: string; sMaster2: string; sAdminName: string; sAdminEmail: string; sAdminPass: string; sAdminPass2: string };
const EMPTY: F = { sToken: "", sCompany: "", sMaster: "", sMaster2: "", sAdminName: "", sAdminEmail: "", sAdminPass: "", sAdminPass2: "" };

/** Kaba güç tahmini (yalnızca gösterge; asıl denetimi sunucu yapar). 0–4 parça. */
function strength(p: string) {
  if (!p) return 0;
  const classes = [/[a-zçğıöşü]/, /[A-ZÇĞİÖŞÜ]/, /\d/, /[^\wçğıöşüÇĞİÖŞÜ]/].filter((r) => r.test(p)).length;
  let n = p.length >= MIN ? 2 : p.length >= 8 ? 1 : 0;
  if (classes >= 3) n++;
  if (p.length >= 16 && classes >= 2) n++;
  return Math.min(4, n);
}

const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toLocaleUpperCase("tr") || "?";

export function SetupScreen({ v }: { v: Vals }) {
  const T = v.T;
  const done = v.setupDone;
  const [step, setStep] = React.useState(1);
  const [f, setF] = React.useState<F>(EMPTY);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof F) => (e: React.ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: e.target.value }); setErr(""); };
  const field = (k: keyof F, label: string, type = "text", hint = "", extra = "") => (
    <label style={css(LABEL + extra)}>
      {label}
      <input name={k} type={type} value={f[k]} onChange={set(k)} placeholder={hint} autoComplete={type === "password" ? "new-password" : "off"}
        style={css(INPUT + (k === "sToken" ? ";font-family:var(--mono);font-weight:500;letter-spacing:.04em" : ""))} />
    </label>
  );

  // Her adımın kendi alanları ilerlemeden önce denetlenir.
  const check = (): string => {
    if (step === 1 && !f.sToken.trim()) return T.setupTokenGerekli;
    if (step === 2 && !f.sCompany.trim()) return T.setupSirketGerekli;
    if (step === 3) {
      if (f.sMaster.length < MIN) return T.setupSifreKisa;
      if (f.sMaster !== f.sMaster2) return T.setupMasterUyusmuyor;
    }
    if (step === 4) {
      if (!f.sAdminName.trim() || !/^\S+@\S+\.\S+$/.test(f.sAdminEmail.trim())) return T.setupYoneticiGerekli;
      if (f.sAdminPass.length < MIN) return T.setupSifreKisa;
      if (f.sAdminPass !== f.sAdminPass2) return T.setupSifreUyusmuyor;
      if (f.sAdminPass === f.sMaster) return T.setupSifreAyniOlamaz;
    }
    return "";
  };
  const next = async () => {
    const problem = check();
    if (problem) return setErr(problem);
    if (step < 4) { setStep(step + 1); v.clearAuthError(); return; }
    setBusy(true);
    const result = await v.completeSetupWith(f);
    setBusy(false);
    if (result === "token") setStep(1);
  };
  const back = () => { setErr(""); v.clearAuthError(); setStep(Math.max(1, step - 1)); };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); next(); } };

  const steps = [T.setupAdimBelirtec, T.setupAdimSirket, T.setupAdimPanel, T.setupAdimYonetici];
  const cur = done ? 5 : step;
  const stepper = (
    <ol aria-label={T.kurulumBaslik} style={css("list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr))")}>
      {steps.map((n: string, i: number) => {
        const k = i + 1, isDone = k < cur, isCur = k === cur;
        const dot = isDone ? "background:var(--pri,#2a3180);color:#fff;border:2px solid var(--pri,#2a3180)" : isCur ? "background:var(--card);color:var(--brandink);border:2px solid var(--pri,#2a3180)" : "background:var(--soft3);color:var(--muted);border:2px solid var(--soft3)";
        return (
          <li key={n} aria-current={isCur ? "step" : undefined} style={css("position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0")}>
            {i < 3 ? <span aria-hidden="true" style={css("position:absolute;top:13px;left:calc(50% + 17px);right:calc(-50% + 17px);height:2px;border-radius:2px;background:" + (k < cur ? "var(--pri,#2a3180)" : "var(--line2)"))} /> : null}
            <span style={css("width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;" + dot)}>{isDone ? "✓" : k}</span>
            <span style={css("font-size:11.5px;font-weight:" + (isCur ? 800 : 700) + ";color:" + (isCur ? "var(--ink)" : "var(--muted)") + ";white-space:nowrap")}>{n}</span>
          </li>
        );
      })}
    </ol>
  );
  const head = (t: string, d: React.ReactNode) => (
    <div>
      <div style={css("font-size:17px;font-weight:800")}>{t}</div>
      <div style={css("font-size:13px;color:var(--muted);font-weight:600;line-height:1.55;margin-top:4px")}>{d}</div>
    </div>
  );
  const power = strength(f.sMaster);
  const powerLabel = [T.setupGucZayif, T.setupGucZayif, T.setupGucOrta, T.setupGucIyi, T.setupGucGuclu][power];

  let body: React.ReactNode = null;
  if (done) {
    body = (<>
      <div style={css("display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:6px 0 2px")}>
        <span style={css("width:52px;height:52px;border-radius:50%;background:var(--ok);color:var(--oktext);display:flex;align-items:center;justify-content:center")}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6,12.5 10.5,17 18,8" /></svg>
        </span>
        <div role="status" style={css("font-size:18px;font-weight:800")}>{T.kurulumTamamlandi}</div>
        <div style={css("font-size:13px;color:var(--muted);font-weight:600;line-height:1.55;max-width:340px")}>{done.company} {T.setupHazirMetin}</div>
      </div>
      <div style={css("display:flex;flex-direction:column;border:1px solid var(--line2);border-radius:10px")}>
        {[[T.setupOzetSirket, done.company], [T.setupOzetYonetici, done.adminName + " · " + done.adminEmail], [T.setupOzetPanel, T.setupMasterBelirlendi]].map((r: string[], i: number) => (
          <div key={r[0]} style={css("display:flex;gap:12px;padding:10px 12px;" + (i ? "border-top:1px solid var(--line2)" : ""))}>
            <span style={css("flex:0 0 110px;" + "font-size:12px;color:var(--muted);font-weight:700")}>{r[0]}</span>
            <span style={css("flex:1;min-width:0;font-size:13px;font-weight:700;overflow-wrap:anywhere")}>{r[1]}</span>
          </div>
        ))}
      </div>
    </>);
  } else if (step === 1) {
    body = (<>
      {head(T.kurulumBelirteciBaslik, <>{T.setupBelirtecAciklama} <code style={css("font-family:var(--mono);font-size:12px;background:var(--soft3);padding:1px 5px;border-radius:5px")}>sudo dosyapi-ctl token</code></>)}
      {field("sToken", T.kurulumBelirteci, "text", T.kurulumBelirteciIpucu)}
    </>);
  } else if (step === 2) {
    body = (<>
      {head(T.setupSirketBaslik, T.setupSirketAciklama)}
      {field("sCompany", T.sirketAdiUp, "text", T.setupSirketOrnek)}
      <div style={css("display:flex;align-items:center;gap:12px;background:var(--soft2);border-radius:10px;padding:10px 12px")}>
        <div aria-hidden="true" style={css("width:40px;height:40px;border-radius:10px;background:var(--pri,#2a3180);color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;flex:none")}>{initials(f.sCompany)}</div>
        <div style={css("min-width:0")}>
          <div style={st.title14}>{f.sCompany.trim() || T.setupSirketOrnek}</div>
          <div style={st.caption}>{T.setupLogoNot}</div>
        </div>
      </div>
      <div style={st.hintParagraph}>{T.setupRenkNot}</div>
    </>);
  } else if (step === 3) {
    body = (<>
      {head(T.setupPanelBaslik, T.setupPanelAciklama)}
      {field("sMaster", T.masterSifreUp, "password", T.enAz12)}
      <div aria-hidden="true" style={css("display:flex;gap:4px")}>
        {[1, 2, 3, 4].map((x) => <span key={x} style={css("flex:1;height:4px;border-radius:999px;background:" + (x <= power ? (power >= 3 ? "var(--okdot)" : "var(--warntext)") : "var(--line2)"))} />)}
      </div>
      {f.sMaster ? <div aria-live="polite" style={css("font-size:12px;font-weight:700;margin-top:-6px;color:" + (power >= 3 ? "var(--oktext)" : "var(--warntext)"))}>{powerLabel}</div> : null}
      {field("sMaster2", T.setupMasterTekrar, "password")}
      <div style={st.hintParagraph}>{T.setupSakla}</div>
    </>);
  } else {
    body = (<>
      {head(T.ilkYoneticiBaslik, T.setupYoneticiAciklama)}
      {field("sAdminName", T.adSoyadUp)}
      {field("sAdminEmail", T.ePostaUp, "email")}
      <div style={st.rowWrap10}>
        {field("sAdminPass", T.sifreUp, "password", T.enAz12, ";flex:1;min-width:140px")}
        {field("sAdminPass2", T.sifreTekrarUp, "password", "", ";flex:1;min-width:140px")}
      </div>
    </>);
  }

  const fwdLabel = done ? T.girisEkraninaGit : step === 4 ? T.kurulumuTamamla : T.devam;
  return (
    <div style={css("flex:1;position:relative;display:flex;align-items:center;justify-content:center;padding:32px 16px;" + AUTH_BG)}>
      <AuthBackdrop />
      <div style={css("position:absolute;top:16px;right:16px;z-index:2;display:flex;align-items:center;gap:8px")}>
        <button onClick={v.toggleLang} aria-label={T.dil} style={css(v.langBtnStyle)}>{v.langLabel}</button>
        <button onClick={v.toggleTheme} aria-label={T.karanlikMod2} style={css(v.themeIconBtnStyle)}>{v.themeIcon}</button>
      </div>
      <div onKeyDown={onKey} style={css("position:relative;z-index:1;width:100%;max-width:480px;display:flex;flex-direction:column;gap:18px")}>
        <div style={css("display:flex;flex-direction:column;align-items:center;gap:10px")}>
          {v.brandMarkLg}
          <div className="wm" style={css("font-size:24px;color:var(--logo-a)")}>dos<span style={css("color:var(--logo-b)")}>yapı</span></div>
        </div>
        <div style={css("background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:16px;box-shadow:0 2px 10px rgba(0,0,0,.05)")}>
          {done ? null : (<>{stepper}<div style={css("height:1px;background:var(--line2)")} /></>)}
          {body}
          {err ? <NoteBox tone="err" role="alert">{err}</NoteBox> : null}
          {!err && v.authError && !done ? <NoteBox tone="err" role="alert">{v.authError}</NoteBox> : null}
          <div style={css("display:flex;gap:8px;align-items:center")}>
            {!done && step > 1 ? <button onClick={back} style={css("height:44px;padding:0 18px;border:1px solid var(--line);background:var(--card);border-radius:10px;font-size:14px;font-weight:700;color:var(--ink);cursor:pointer")}>{T.geri}</button> : null}
            <button onClick={done ? v.finishSetup : next} disabled={busy} style={{ ...st.primaryLarge, flex: 1, opacity: busy ? 0.6 : 1 }}>{fwdLabel}</button>
          </div>
          {done ? null : <div style={css("text-align:center;font-size:12px;font-weight:700;color:var(--muted);margin-top:-4px")}>{T.adim} {step} / 4</div>}
        </div>
      </div>
    </div>
  );
}
