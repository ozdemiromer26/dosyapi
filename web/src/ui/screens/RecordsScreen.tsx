import { st } from "../styles";
import React from "react";
import { css } from "../css";
import type { Vals } from "../../vm/types";

export function RecordsScreen({ v }: { v: Vals }) {
  return (
    <>
          <div style={st.stack14}>
            <div style={css("display:flex;gap:9px;flex-wrap:wrap;align-items:center")}>
              <div style={css("display:flex;background:var(--soft3);border-radius:10px;padding:4px;gap:4px")}>
                <button onClick={v.recAuthors} style={css(v.recAuthStyle)}>{v.T.muellifler}</button>
                <button onClick={v.recContractors} style={css(v.recContStyle)}>{v.T.muteahhitler}</button>
              </div>
              {v.isAuthorsTab ? (<>
                <select name="projFilter" onChange={v.onProjFilter} style={css("flex:1;min-width:190px;height:40px;border:1px solid var(--line);background:var(--card);border-radius:9px;padding:0 10px;font-size:13px;font-weight:700")}>
                  <option value="">{v.T.tumMuellifler}</option>
                  {(v.projectOptions || []).map((p: any, i42: number) => (<React.Fragment key={p?.id ?? p?.key ?? i42}>
                    <option value={p.id}>{p.name}</option>
                  </React.Fragment>))}
                </select>
              </>) : null}
            </div>

            {v.isAuthorsTab ? (<>
              <div style={st.stack13}>
                <div style={css("display:flex;gap:9px;flex-wrap:wrap;align-items:center")}>
                  <button onClick={v.printAuthors} style={css("height:40px;padding:0 15px;border:none;border-radius:9px;background:var(--pri,#2a3180);color:#fff;font-size:13px;font-weight:700;cursor:pointer")}>{v.T.seciliMuelliflerleBelge} ({v.selCount})</button>
                  <button onClick={v.selectAllAuthors} style={css("height:40px;padding:0 13px;border:1px solid var(--line);background:var(--card);border-radius:9px;font-size:13px;font-weight:700;cursor:pointer")}>{v.selectAllLabel}</button>
                  {v.canWriteRecords ? (<>
                    <button onClick={v.newAuthor} style={css("height:40px;padding:0 15px;border:1px dashed var(--pri,#2a3180);background:var(--tint);border-radius:9px;color:var(--brandink);font-size:13px;font-weight:700;cursor:pointer")}>{v.T.muellifEkle}</button>
                  </>) : null}
                </div>
                <div style={css("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,268px),312px));gap:12px;align-items:start")}>
                  {(v.authorsList || []).map((a: any, i43: number) => (<React.Fragment key={a?.id ?? a?.key ?? i43}>
                    <div style={css(a.cardStyle)}>
                      <div style={css("display:flex;align-items:center;gap:10px")}>
                        <button onClick={a.onSelect} style={css(a.checkStyle)}>{a.checkMark}</button>
                        <div style={css("flex:1;min-width:0")}>
                          <div style={st.title14}>{a.fullName}</div>
                          <div style={st.hintBold}>{a.job} · {a.company}</div>
                        </div>
                        <button onClick={a.onDoc} style={css("height:30px;padding:0 10px;border:1px solid var(--line);background:var(--card);border-radius:8px;font-size:12px;font-weight:700;color:var(--acc,#1d72b8);cursor:pointer")}>{v.T.belge2}</button>
                      </div>
                      <div style={css("display:flex;flex-wrap:wrap;gap:6px;margin-top:10px")}>
                        <span style={st.recordTag}>{v.T.tc} {a.tc}</span>
                        <span style={st.recordTag}>{a.phone}</span>
                        {a.sicilLabel ? (<>
                          <span style={st.recordTag}>{a.sicilLabel}</span>
                        </>) : null}
                        <span style={st.recordTag}>{a.projectLabel}</span>
                      </div>
                      {a.canWrite ? (<>
                        <div style={css("display:flex;gap:7px;margin-top:10px")}>
                          <button onClick={a.onEdit} style={css("flex:1;height:36px;border:1px solid var(--line);background:var(--card);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.duzenle}</button>
                          <button onClick={a.onDelete} style={css("width:48px;height:36px;border:1px solid var(--errline);background:var(--err);color:var(--errtext);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.sil}</button>
                        </div>
                      </>) : null}
                    </div>
                  </React.Fragment>))}
                </div>
              </div>
            </>) : null}

            {v.isContractorsTab ? (<>
              <div style={st.stack13}>
                {v.canWriteRecords ? (<>
                  <button onClick={v.newContractor} style={css("align-self:flex-start;height:40px;padding:0 15px;border:1px dashed var(--pri,#2a3180);background:var(--tint);border-radius:9px;color:var(--brandink);font-size:13px;font-weight:700;cursor:pointer")}>{v.T.muteahhitEkle}</button>
                </>) : null}
                <div style={css("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,268px),312px));gap:12px;align-items:start")}>
                  {(v.contractorsList || []).map((c: any, i44: number) => (<React.Fragment key={c?.id ?? c?.key ?? i44}>
                    <div style={css("background:var(--card);border:1px solid var(--line);border-radius:13px;padding:14px")}>
                      <div style={css("display:flex;align-items:center;gap:10px")}>
                        <div style={css("width:38px;height:38px;border-radius:9px;background:repeating-linear-gradient(135deg,var(--soft3) 0 6px,#e4e4e4 6px 12px);color:var(--muted);font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center")}>{c.initials}</div>
                        <div style={css("flex:1;min-width:0")}>
                          <div style={st.title14}>{c.title}</div>
                          <div style={st.hintBold}>{c.owner} {v.T.sinif} {c.rank}</div>
                        </div>
                        <button onClick={c.onDoc} style={css("height:30px;padding:0 10px;border:1px solid var(--line);background:var(--card);border-radius:8px;font-size:12px;font-weight:700;color:var(--acc,#1d72b8);cursor:pointer")}>{v.T.belge2}</button>
                      </div>
                      <div style={css("display:flex;flex-wrap:wrap;gap:6px;margin-top:10px")}>
                        <span style={st.recordTag}>{v.T.yetkiNo} {c.licence}</span>
                        <span style={st.recordTag}>{c.address}</span>
                      </div>
                      {c.canWrite ? (<>
                        <div style={css("display:flex;gap:7px;margin-top:10px")}>
                          <button onClick={c.onEdit} style={css("flex:1;height:36px;border:1px solid var(--line);background:var(--card);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.duzenle}</button>
                          <button onClick={c.onDelete} style={css("width:48px;height:36px;border:1px solid var(--errline);background:var(--err);color:var(--errtext);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.sil}</button>
                        </div>
                      </>) : null}
                    </div>
                  </React.Fragment>))}
                </div>
              </div>
            </>) : null}
          </div>
        </>
  );
}
