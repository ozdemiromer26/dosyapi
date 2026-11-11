import { st } from "./styles";
import React from "react";
import { css } from "./css";

/** Giriş ve kurulum zemini: beyaza yakın, ana renge çok hafif çalan geçiş. */
export const AUTH_BG = "background:linear-gradient(180deg,var(--card) 0%,color-mix(in oklab,var(--pri,#2a3180) 3%,var(--card)) 100%)";

const CITY: [number, number, number][] = [[300, 40, 22], [326, 58, 18], [348, 34, 26], [378, 72, 14], [396, 48, 22], [422, 30, 30], [456, 62, 16], [476, 44, 24], [504, 82, 12], [520, 52, 20], [544, 36, 28], [576, 66, 18], [598, 46, 22], [624, 28, 34]];
const tone = (p: number) => `color-mix(in oklab,var(--pri,#2a3180) ${p}%,var(--card))`;

/** Giriş ve kurulum ekranının arkasındaki tek renkli sade manzara (tepeler, ufukta silik şehir).
 *  Tüm tonlar ana renkle kartın karışımı; koyu temada kendiliğinden koyulaşır. */
export function AuthBackdrop() {
  return (
    <div aria-hidden="true" style={css("position:absolute;inset:0;pointer-events:none;overflow:hidden")}>
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" style={css("position:absolute;inset:0;width:100%;height:100%")}>
        <circle cx="1180" cy="300" r="70" style={{ fill: tone(5) }} />
        <g style={{ fill: tone(6) }}>
          {CITY.map(([x, h, w]) => <rect key={x} x={x + 420} y={560 - h} width={w} height={h + 20} />)}
        </g>
        <path d="M0 600 C180 540 360 520 560 560 S920 610 1100 560 1420 500 1600 540 V900 H0Z" style={{ fill: tone(7) }} />
        <path d="M0 680 C220 620 420 640 640 670 S1040 700 1240 650 1500 620 1600 640 V900 H0Z" style={{ fill: tone(10) }} />
        <path d="M0 770 C260 720 520 740 780 770 S1220 800 1600 740 V900 H0Z" style={{ fill: tone(14) }} />
      </svg>
    </div>
  );
}

/** "powered by dosyapı" imzası: kenar çubuğu, mobil menü ve giriş ekranının altında. */
export function PoweredBy({ mark, size = 13, label = 11 }: { mark: React.ReactNode; size?: number; label?: number }) {
  return (
    <div style={css("display:flex;align-items:center;gap:6px")}>
      <span style={css(`font-size:${label}px;font-weight:500;color:var(--faint)`)}>powered by</span>
      {mark}
      <span className="wm" style={css(`font-size:${size}px;line-height:1;color:var(--logo-a)`)}>dos<span style={css("color:var(--logo-b)")}>yapı</span></span>
    </div>
  );
}

/** Sistem paneli ekranlarının ortak yapı taşları (tasarımdaki kart ve form stilleri). */

export function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={css("background:var(--mcard);border:1px solid var(--mline);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:11px")}>
      <div style={st.masterTitle}>{title}</div>
      {note ? <div style={st.masterHint}>{note}</div> : null}
      {children}
    </div>
  );
}

const INPUT = "height:40px;border:1px solid var(--mline2);background:var(--minput);border-radius:8px;padding:0 11px;font-size:13px;font-weight:600;color:var(--mink)";

export function Field({ label, name, type, value, placeholder, onChange }: { label: string; name: string; type?: string; value?: string | number; placeholder?: string; onChange: (e: any) => void }) {
  return (
    <label style={css("flex:1;min-width:160px;display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:var(--mmuted)")}>
      {label}
      <input name={name} type={type || "text"} defaultValue={value} placeholder={placeholder} onChange={onChange} autoComplete="off" style={css(INPUT)} />
    </label>
  );
}

export function Select({ label, name, value, options, onChange }: { label: string; name: string; value: string; options: { id: string; label: string }[]; onChange: (e: any) => void }) {
  return (
    <label style={css("flex:1;min-width:160px;display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:var(--mmuted)")}>
      {label}
      <select name={name} defaultValue={value} onChange={onChange} style={css(INPUT)}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div style={css("display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end")}>{children}</div>;
}

export function Btn({ onClick, children, kind, disabled }: { onClick: () => void; children: React.ReactNode; kind?: "primary" | "danger"; disabled?: boolean }) {
  const look =
    kind === "primary" ? "border:none;background:var(--pri,#1E4FD8);color:#fff"
      : kind === "danger" ? "border:none;background:#B3261E;color:#fff"
        : "border:1px solid var(--mline2);background:var(--mbtn);color:var(--mtext)";
  return (
    <button onClick={onClick} disabled={disabled} style={css("height:40px;padding:0 14px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;" + look + (disabled ? ";opacity:.55" : ""))}>
      {children}
    </button>
  );
}

export type Tone = "ok" | "warn" | "err" | "info";

/** Bildirim kutusu ikonları: 16px, 1.9 çizgi, metnin ilk satırıyla hizalı. */
const NOTE_ICON: Record<Tone, React.ReactNode[]> = {
  err: [<circle key="a" cx="12" cy="12" r="9" />, <line key="b" x1="12" y1="7.5" x2="12" y2="12.5" />, <line key="c" x1="12" y1="16" x2="12" y2="16.2" />],
  ok: [<circle key="a" cx="12" cy="12" r="9" />, <polyline key="b" points="8,12.3 10.8,15 16,9.5" />],
  info: [<circle key="a" cx="12" cy="12" r="9" />, <line key="b" x1="12" y1="11" x2="12" y2="16.5" />, <line key="c" x1="12" y1="7.6" x2="12" y2="7.8" />],
  warn: [<path key="a" d="M12 3.5 21.5 20h-19z" />, <line key="b" x1="12" y1="10" x2="12" y2="14" />, <line key="c" x1="12" y1="17" x2="12" y2="17.2" />],
};
export function NoteIcon({ tone }: { tone: Tone }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", marginTop: 2 }}>
      {NOTE_ICON[tone]}
    </svg>
  );
}

const APP_TONE: Record<Tone, string> = {
  ok: "background:var(--ok);border:1px solid var(--okline);color:var(--oktext)",
  warn: "background:var(--warn);border:1px solid var(--warnline);color:var(--warntext)",
  err: "background:var(--err);border:1px solid var(--errline);color:var(--errtext)",
  info: "background:var(--tint);border:1px solid var(--tintline);color:var(--brandink)",
};

/** Uygulama içi bildirim kutusu: başta ikon, ortak ölçü (13/700, 10px 12px, kenarlı).
 *  `extra` yalnızca yerleşim içindir (ör. grid-column, margin-top, küçük punto). */
export function NoteBox({ tone, children, extra = "", role }: { tone: Tone; children: React.ReactNode; extra?: string; role?: string }) {
  return (
    <div role={role} style={css("display:flex;gap:8px;align-items:flex-start;border-radius:9px;padding:10px 12px;font-size:13px;font-weight:700;line-height:1.5;" + APP_TONE[tone] + ";" + extra)}>
      <NoteIcon tone={tone} />
      <div style={css("flex:1;min-width:0")}>{children}</div>
    </div>
  );
}

/** Sistem paneli bildirim kutusu (m- renkleri). */
export function Note({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const look = {
    ok: "background:var(--ok);border:1px solid var(--okline);color:var(--oktext)",
    warn: "background:var(--mwarn);border:1px solid var(--mwarnline);color:var(--mwarntext)",
    err: "background:var(--merr);border:1px solid var(--merrline);color:var(--merrtext)",
    info: "background:var(--mcard2);border:1px solid var(--mline);color:var(--mtext)",
  }[tone];
  return (
    <div style={css("display:flex;gap:8px;align-items:flex-start;border-radius:9px;padding:10px 12px;font-size:12px;font-weight:700;line-height:1.55;" + look)}>
      <NoteIcon tone={tone} />
      <div style={css("flex:1;min-width:0")}>{children}</div>
    </div>
  );
}
