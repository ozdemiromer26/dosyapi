import { st } from "./styles";
import React from "react";
import { css } from "./css";

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

export function Note({ tone, children }: { tone: "ok" | "warn" | "err" | "info"; children: React.ReactNode }) {
  const look = {
    ok: "background:var(--ok);border:1px solid var(--okline);color:var(--oktext)",
    warn: "background:var(--mwarn);color:var(--mwarntext)",
    err: "background:var(--merr);border:1px solid var(--merrline);color:var(--merrtext)",
    info: "background:var(--mcard2);border:1px solid var(--mline);color:var(--mtext)",
  }[tone];
  return <div style={css("border-radius:9px;padding:10px 12px;font-size:12px;font-weight:700;line-height:1.55;" + look)}>{children}</div>;
}
