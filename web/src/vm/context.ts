// Görünüm modeli: context
import type { Ctx, Vals } from "./types";
import { setLang } from "../i18n";
import { CHECK, CHIP, DCHIP, TAB } from "./chips";
/*IMPORTS*/

export function buildContext(c: Ctx): () => Vals {
  const app = c.app;
  /*TOP*/
    setLang(app.state.lang);
    const s = app.state, me = app.me(), lvl = app.lvl(), top = app.top();
    const pm = app.projMode(), rm = app.recMode();
    const canWriteProjects = pm === "edit" || pm === "approve";
    const directProjects = pm === "edit";
    const canWriteRecords = rm === "edit" || rm === "approve";
    const directRecords = rm === "edit";

    const chip = (on) => CHIP + (on ? "background:var(--pri,#2a3180);color:#fff;border:1px solid var(--pri,#2a3180)" : "background:var(--card);color:var(--muted);border:1px solid var(--line)");
    const dchip = (on) => DCHIP + (on ? "background:var(--pri,#2a3180);color:#fff;border:1px solid var(--pri,#2a3180)" : "background:var(--minput);color:var(--mmuted);border:1px solid var(--mline2)");
    const tabStyle = (on) => TAB + (on ? "background:var(--card);color:var(--brandink);box-shadow:0 1px 3px rgba(0,0,0,.1)" : "background:transparent;color:var(--muted)");
    const navStyle = (on) => "height:36px;padding:0 14px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;flex:none;" + (on ? "background:var(--pri,#2a3180);color:#fff;border:1px solid var(--pri,#2a3180)" : "background:var(--card);color:var(--muted);border:1px solid var(--line)");
    const badge = (done) => "flex:none;white-space:nowrap;font-size:11px;font-weight:800;padding:5px 9px;border-radius:999px;" + (done ? "background:var(--soft3);color:var(--ink)" : "background:var(--tint);color:var(--brandink)");
    const check = (on) => CHECK + (on ? "background:var(--pri,#2a3180);color:#fff;border:1px solid var(--pri,#2a3180)" : "background:var(--card);color:transparent;border:1px solid var(--line)");
    const dot = (ok) => "width:8px;height:8px;flex:none;border-radius:50%;background:" + (ok ? "var(--okdot)" : "var(--line)");
    Object.assign(c, { s, me, lvl, top, pm, rm, canWriteProjects, directProjects, canWriteRecords, directRecords, chip, dchip, tabStyle, navStyle, badge, check, dot });
  return () => {
    /*LATE*/
    return {

    };
  };
}
