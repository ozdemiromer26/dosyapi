import { st } from "./styles";
import React from "react";
import { css } from "./css";
import type { Vals } from "../vm/types";
import { tx } from "../i18n";

/** Giriş ve kurulum zemini: beyaza yakın, ana renge çok hafif çalan geçiş. */
export const AUTH_BG = "background:linear-gradient(180deg,var(--card) 0%,color-mix(in oklab,var(--pri,#2a3180) 3%,var(--card)) 100%)";

const tone = (p: number) => `color-mix(in oklab,var(--pri,#2a3180) ${p}%,var(--card))`;

/** Giriş ve kurulum ekranının arkasındaki tek renkli sade manzara (güneş ve tepeler).
 *  Tüm tonlar ana renkle kartın karışımı; koyu temada kendiliğinden koyulaşır. */
export function AuthBackdrop() {
  return (
    <div aria-hidden="true" style={css("position:absolute;inset:0;pointer-events:none;overflow:hidden")}>
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" style={css("position:absolute;inset:0;width:100%;height:100%")}>
        <circle cx="1180" cy="300" r="70" style={{ fill: tone(5) }} />
        <path d="M0 600 C180 540 360 520 560 560 S920 610 1100 560 1420 500 1600 540 V900 H0Z" style={{ fill: tone(7) }} />
        <path d="M0 680 C220 620 420 640 640 670 S1040 700 1240 650 1500 620 1600 640 V900 H0Z" style={{ fill: tone(10) }} />
        <path d="M0 770 C260 720 520 740 780 770 S1220 800 1600 740 V900 H0Z" style={{ fill: tone(14) }} />
      </svg>
    </div>
  );
}

/** Şifre kutusu: sağda göster/gizle düğmesi. Dış yerleşim (flex, genişlik) sarmalayıcıya taşınır. */
export const PassInput = React.forwardRef<HTMLInputElement, any>(function PassInput({ style, ...rest }, ref) {
  const [show, setShow] = React.useState(false);
  const { flex, width, minWidth, maxWidth, gridColumn, margin, marginTop, alignSelf, ...inner } = (style || {}) as any;
  const label = show ? tx("Şifreyi gizle") : tx("Şifreyi göster");
  return (
    <div style={{ position: "relative", display: "flex", flex, width, minWidth, maxWidth, gridColumn, margin, marginTop, alignSelf }}>
      <input {...rest} ref={ref} type={show ? "text" : "password"} style={{ ...inner, width: "100%", minWidth: 0, boxSizing: "border-box", paddingRight: 42 }} />
      <button type="button" onClick={() => setShow((x) => !x)} aria-label={label} title={label} aria-pressed={show}
        style={css("position:absolute;right:5px;top:50%;transform:translateY(-50%);width:32px;height:32px;border:none;background:transparent;color:var(--muted,#777);cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:7px;padding:0")}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{show ? <path d="M3 3l18 18" /> : null}
        </svg>
      </button>
    </div>
  );
});

/** Çoklu seçimli açılır liste (combobox). Seçilenler kutuda çip olarak durur; çipteki × ile
 *  ya da listeden yeniden tıklayarak çıkarılır. Klavye: ↑/↓ gezinir, Enter/Boşluk seçer, Esc kapatır. */
export function MultiSelect({ options, value, onChange, placeholder, label }: { options: string[]; value: string[]; onChange: (v: string[]) => void; placeholder: string; label: string }) {
  const [open, setOpen] = React.useState(false);
  const [sel, setSel] = React.useState<string[]>(value || []);
  const [active, setActive] = React.useState(0);
  const box = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();
  React.useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  const toggle = (o: string) => {
    const next = sel.indexOf(o) > -1 ? sel.filter((x) => x !== o) : [...sel, o];
    setSel(next); onChange(next);
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); e.stopPropagation();
      if (!open) return setOpen(true);
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) % Math.max(1, options.length));
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && (e.target as HTMLElement).getAttribute("role") === "combobox") {
      e.preventDefault(); e.stopPropagation();
      if (!open) setOpen(true); else if (options[active]) toggle(options[active]);
    }
  };
  return (
    <div ref={box} style={css("position:relative")} onKeyDown={key}>
      <div role="combobox" tabIndex={0} aria-label={label} aria-expanded={open} aria-haspopup="listbox" aria-controls={listId}
        aria-activedescendant={open && options[active] ? listId + "-" + active : undefined}
        onClick={(e) => { (e.currentTarget as HTMLElement).focus(); setOpen((x) => !x); }}
        style={css("min-height:40px;border:1px solid " + (open ? "var(--pri,#2a3180)" : "var(--line)") + ";background:var(--card);border-radius:9px;padding:5px 34px 5px 8px;display:flex;flex-wrap:wrap;gap:5px;align-items:center;cursor:pointer;position:relative")}>
        {sel.length ? sel.map((o) => (
          <span key={o} style={css("display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 4px 0 9px;border-radius:999px;background:var(--tint);color:var(--brandink);font-size:12px;font-weight:700")}>
            {o}
            <button type="button" aria-label={o + " — " + tx("kaldır")} onClick={(e) => { e.stopPropagation(); toggle(o); }}
              style={css("width:20px;height:20px;border:none;border-radius:50%;background:transparent;color:inherit;cursor:pointer;font-size:14px;line-height:1;padding:0")}>×</button>
          </span>
        )) : <span style={css("font-size:13px;font-weight:600;color:var(--muted);padding-left:3px")}>{placeholder}</span>}
        <span aria-hidden="true" style={css("position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:11px")}>{open ? "▲" : "▼"}</span>
      </div>
      {open ? (
        <ul id={listId} role="listbox" aria-multiselectable="true" aria-label={label}
          style={css("margin:4px 0 0;padding:5px;list-style:none;background:var(--card);border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 28px rgba(0,0,0,.14);max-height:220px;overflow:auto")}
          ref={(el) => { if (el) el.scrollIntoView({ block: "nearest" }); }}>
          {options.map((o, i) => {
            const on = sel.indexOf(o) > -1;
            return (
              <li key={o} id={listId + "-" + i} role="option" aria-selected={on} onMouseDown={(e) => e.preventDefault()} onClick={() => toggle(o)} onMouseEnter={() => setActive(i)}
                style={css("display:flex;align-items:center;gap:9px;padding:8px 9px;border-radius:7px;cursor:pointer;font-size:13px;font-weight:700;color:var(--ink);" + (i === active ? "background:var(--soft2)" : ""))}>
                <span aria-hidden="true" style={css("width:18px;height:18px;flex:none;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;" + (on ? "background:var(--pri,#2a3180);border:1px solid var(--pri,#2a3180)" : "background:var(--card);border:1px solid var(--line)"))}>{on ? "✓" : ""}</span>
                {o}
              </li>
            );
          })}
        </ul>
      ) : null}
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
      {type === "password"
        ? <PassInput name={name} defaultValue={value} placeholder={placeholder} onChange={onChange} autoComplete="new-password" style={css(INPUT)} />
        : <input name={name} type={type || "text"} defaultValue={value} placeholder={placeholder} onChange={onChange} autoComplete="off" style={css(INPUT)} />}
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

/** Süresi geçen görev uyarısı (Özet ve Görevler ekranlarının üstünde). */
export function OverdueNotes({ v, link }: { v: Vals; link?: boolean }) {
  if (!v.hasMyOverdue && !v.hasAssignedOverdue) return null;
  return (
    <NoteBox tone="err" role="alert">
      <div style={css("display:flex;flex-direction:column;gap:3px")}>
        {v.hasMyOverdue ? <span>{v.myOverdueNote}</span> : null}
        {v.hasAssignedOverdue ? <span>{v.assignedOverdueNote}</span> : null}
      </div>
      {link ? <button onClick={v.goTasks} style={css("margin-top:7px;height:30px;padding:0 11px;border:1px solid var(--errline);background:var(--card);color:var(--errtext);border-radius:8px;font-size:12px;font-weight:800;cursor:pointer")}>{v.T.gorevlereGit}</button> : null}
    </NoteBox>
  );
}
