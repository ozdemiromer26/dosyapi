import React from "react";
import { css } from "../css";
import type { Vals } from "../../vm/types";


/** Hakkında kartı; Sistem paneli ("m" renkleri) ve uygulama içinde ortak. */
export function AboutCard({ v, master }: { v: Vals; master?: boolean }) {
  const c = (name: string) => "var(--" + (master ? "m" : "") + name + ")";
  const ROW = "display:flex;align-items:baseline;gap:12px;padding:11px 0;border-top:1px solid " + (master ? "var(--mline)" : "var(--line2)");
  const KEY = "flex:0 0 150px;font-size:12px;font-weight:700;color:" + (master ? "var(--mmuted)" : "var(--muted)");
  const VAL = "flex:1;min-width:0;font-size:14px;font-weight:700;color:" + (master ? "var(--mink)" : "var(--ink)") + ";overflow-wrap:anywhere";
  const T = v.T;
  const rows: [string, string][] = [
    [T.surumAd, v.sysVersion || "—"],
    [T.sonGuncelleme, v.aboutDate],
    [T.gelistiren, v.aboutDeveloper],
  ];
  return (
    <div style={css("width:100%;box-sizing:border-box;background:" + c("card") + ";border:1px solid " + c("line") + ";border-radius:16px;padding:22px 20px 10px;display:flex;flex-direction:column")}>
      <div style={css("display:flex;align-items:center;gap:16px;padding-bottom:18px")}>
        <div style={css("width:72px;height:72px;border-radius:18px;background:#FFFFFF;border:1px solid " + c("line") + ";display:flex;align-items:center;justify-content:center;flex:none")}>{v.brandMarkAbout}</div>
        <div style={css("min-width:0")}>
          <div style={css("font-size:22px;font-weight:800;letter-spacing:-.4px;color:" + (master ? "var(--mink)" : "var(--ink)"))}>dos<span style={css(master ? "color:var(--logo-b)" : "color:#1E4FD8")}>yapı</span></div>
          <div style={css("font-size:13px;color:" + (master ? "var(--mmuted)" : "var(--muted)") + ";font-weight:600;margin-top:2px")}>{T.dosyapiSlogan}</div>
        </div>
      </div>
      {rows.map(([k, val]) => (
        <div key={k} style={css(ROW)}>
          <div style={css(KEY)}>{k}</div>
          <div style={css(VAL)}>{val}</div>
        </div>
      ))}
    </div>
  );
}

export function MasterAbout({ v }: { v: Vals }) {
  return <AboutCard v={v} master />;
}
