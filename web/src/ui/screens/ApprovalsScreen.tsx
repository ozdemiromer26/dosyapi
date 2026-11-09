import { st } from "../styles";
import React from "react";
import { css } from "../css";
import type { Vals } from "../../vm/types";

export function ApprovalsScreen({ v }: { v: Vals }) {
  return (
    <>
          <div style={st.stack14}>
            <div style={st.noteParagraph}>{v.approvalsIntro}</div>
            <div style={css("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),360px));gap:13px;align-items:start")}>
              {(v.pendings || []).map((q: any, i45: number) => (<React.Fragment key={q?.id ?? q?.key ?? i45}>
                <div style={css("background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px;display:flex;flex-direction:column;gap:9px")}>
                  <div style={st.rowCenter8}>
                    <span style={css(q.kindStyle)}>{q.kindLabel}</span>
                    <span style={st.hint}>{q.when}</span>
                  </div>
                  <div style={css("font-size:16px;font-weight:800")}>{q.title}</div>
                  <div style={st.noteParagraph}>{q.detail}</div>
                  <div style={st.hintBold}>{v.T.talepEden2} {q.by}</div>
                  {q.needsRole ? (<>
                    <div style={st.stack5}>
                      <span style={st.hintBold}>{v.T.atanacakRolEnFazla}</span>
                      <select onChange={q.onRolePick} style={st.fieldButton}>
                        {(v.assignableRoles || []).map((r: any, i46: number) => (<React.Fragment key={r?.id ?? r?.key ?? i46}>
                          <option value={r.id}>{v.T.k}{r.level} · {r.name}</option>
                        </React.Fragment>))}
                      </select>
                    </div>
                  </>) : null}
                  {q.canDecide ? (<>
                    <div style={st.row8}>
                      <button onClick={q.onApprove} style={css("flex:1;height:40px;border:none;border-radius:9px;background:var(--pri,#2a3180);color:#fff;font-size:13px;font-weight:700;cursor:pointer")}>{v.T.onayla}</button>
                      <button onClick={q.onReject} style={css("flex:1;height:40px;border:1px solid var(--errline);background:var(--err);color:var(--errtext);border-radius:9px;font-size:13px;font-weight:700;cursor:pointer")}>{v.T.reddet}</button>
                    </div>
                  </>) : null}
                  {q.waiting ? (<>
                    <div style={css("background:var(--soft3);border-radius:8px;padding:8px 10px;font-size:12px;font-weight:700;color:var(--muted)")}>{q.waitLabel}</div>
                  </>) : null}
                </div>
              </React.Fragment>))}
            </div>
            {v.noPendings ? (<>
              <div style={css("text-align:center;padding:36px 12px;color:var(--muted);font-size:14px;font-weight:600")}>{v.T.bekleyenTalepYok}</div>
            </>) : null}
            {v.hasHistory ? (<>
              <div style={css("font-size:14px;font-weight:800;margin-top:6px")}>{v.T.gecmis}</div>
            </>) : null}
            {(v.history || []).map((h: any, i47: number) => (<React.Fragment key={h?.id ?? h?.key ?? i47}>
              <div style={css("display:flex;align-items:center;gap:10px;background:var(--soft2);border-radius:9px;padding:9px 12px")}>
                <span style={css(h.dotStyle)}></span>
                <div style={css("flex:1;font-size:12px;color:var(--muted);font-weight:600")}>{h.text}</div>
                <span style={st.caption}>{h.when}</span>
              </div>
            </React.Fragment>))}
          </div>
        </>
  );
}
