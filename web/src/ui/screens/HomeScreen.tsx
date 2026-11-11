import { st } from "../styles";
import React from "react";
import { css } from "../css";
import type { Vals } from "../../vm/types";
import { OverdueNotes } from "../parts";

export function HomeScreen({ v }: { v: Vals }) {
  return (
    <>
          <div style={css("display:flex;flex-direction:column;gap:18px")}>
            <div>
              <div style={css("font-size:21px;font-weight:800;letter-spacing:-.4px")}>{v.T.merhaba} {v.meFirstName}</div>
              <div style={css("font-size:13px;color:var(--muted);margin-top:3px;font-weight:600")}>{v.todayLabel} · {v.meRoleLabel} {v.T.kademe} {v.meLevel}</div>
            </div>
            <OverdueNotes v={v} link />
            <div style={css("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,132px),1fr));gap:11px")}>
              {(v.stats || []).map((s: any, i18: number) => (<React.Fragment key={s?.id ?? s?.key ?? i18}>
                <button onClick={s.onClick} className="hv1" style={css(s.cardStyle)}>
                  <div style={css(s.labelStyle)}>{s.label}</div>
                  <div style={css(s.valueStyle)}>{s.value}</div>
                </button>
              </React.Fragment>))}
            </div>

            <div style={css("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:14px;align-items:stretch")}>
              <div style={st.card}>
                <div style={css("display:flex;align-items:baseline;justify-content:space-between")}>
                  <div style={st.title14}>{v.T.banaAtananGorevler}</div>
                  <button onClick={v.goTasks} style={css("border:none;background:none;color:var(--brandink);font-size:12px;font-weight:700;cursor:pointer;padding:0")}>{v.T.tumu}</button>
                </div>
                {(v.myTasksPreview || []).map((t: any, i19: number) => (<React.Fragment key={t?.id ?? t?.key ?? i19}>
                  <div style={css(t.rowStyle + ";padding:10px 11px")}>
                    <button onClick={t.onToggle} style={css(t.checkStyle)}>{t.checkMark}</button>
                    <div style={css("flex:1;min-width:0")}>
                      <div style={css(t.titleStyle)}>{t.title}</div>
                      <div style={st.caption}>{t.meta}</div>
                    </div>
                    <span style={css(t.dueStyle)}>{t.dueLabel}</span>
                  </div>
                </React.Fragment>))}
                {v.noMyTasks ? (<>
                  <div style={css("font-size:13px;color:var(--muted);padding:8px 0;font-weight:600")}>{v.T.atanmisGorevYok}</div>
                </>) : null}
              </div>

              <div style={st.card}>
                <div style={css("display:flex;align-items:baseline;justify-content:space-between")}>
                  <div style={st.title14}>{v.T.sonProjeler}</div>
                  <button onClick={v.goProjects} style={css("border:none;background:none;color:var(--brandink);font-size:12px;font-weight:700;cursor:pointer;padding:0")}>{v.T.tumu}</button>
                </div>
                {(v.recentProjects || []).map((p: any, i20: number) => (<React.Fragment key={p?.id ?? p?.key ?? i20}>
                  <div onClick={p.onOpen} style={css("display:flex;align-items:center;gap:10px;background:var(--soft2);border-radius:10px;padding:11px;cursor:pointer")}>
                    <div style={css("flex:1;min-width:0")}>
                      <div style={st.rowTitle}>{p.name}</div>
                      <div style={st.caption}>{p.contractor} {v.T.ada} {p.ada}{v.T.parsel} {p.parsel}</div>
                    </div>
                    <span style={css(p.badgeStyle)}>{p.statusLabel}</span>
                  </div>
                </React.Fragment>))}
              </div>

              <div style={st.card}>
                <div style={css("display:flex;align-items:baseline;justify-content:space-between")}>
                  <div style={st.title14}>{v.T.bekleyenBelgeler2}</div>
                  <button onClick={v.goProjects} style={css("border:none;background:none;color:var(--brandink);font-size:12px;font-weight:700;cursor:pointer;padding:0")}>{v.T.projeler2}</button>
                </div>
                {(v.docPendingList || []).map((p: any, i21: number) => (<React.Fragment key={p?.id ?? p?.key ?? i21}>
                  <div onClick={p.onOpen} style={css("display:flex;align-items:center;gap:10px;background:var(--err);border-radius:10px;padding:11px;cursor:pointer")}>
                    <div style={css("flex:1;min-width:0")}>
                      <div style={css("font-size:14px;font-weight:700")}>{p.name}</div>
                      <div style={css("font-size:11px;color:var(--errtext);font-weight:700;margin-top:2px")}>{p.docWarn}</div>
                    </div>
                    <span style={css("flex:none;font-size:11px;font-weight:800;padding:5px 9px;border-radius:999px;background:var(--card);color:var(--errtext)")}>{p.docLabel}</span>
                  </div>
                </React.Fragment>))}
                {v.hasDocPending ? (<>
                  <div style={st.hintLine}>{v.T.zorunluBelgelerYuklenmedenProje}</div>
                </>) : null}
                {v.noDocPending ? (<>
                  <div style={st.note}>{v.T.eksikZorunluBelgeYok}</div>
                </>) : null}
              </div>
            </div>
          </div>
        </>
  );
}
