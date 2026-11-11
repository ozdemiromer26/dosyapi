import { st } from "../styles";
import React from "react";
import { css } from "../css";
import { NoteBox } from "../parts";
import type { Vals } from "../../vm/types";

export function ProjectsScreen({ v }: { v: Vals }) {
  return (
    <>
          <div style={st.stack14}>
            <div style={css("display:flex;gap:9px;flex-wrap:wrap;align-items:center")}>
              <input name="q" onChange={v.onSearch} placeholder={v.T.projeMuteahhitVeyaMahalle} style={css("flex:1;min-width:180px;height:40px;border:1px solid var(--line);background:var(--card);border-radius:10px;padding:0 12px;font-size:14px;font-weight:600")} />
              <div style={css("position:relative;min-width:210px")}>
                <button onClick={v.toggleFilterMenu} style={css("width:100%;height:40px;border:1px solid var(--line);background:var(--card);border-radius:10px;padding:0 12px;font-size:13px;font-weight:700;color:var(--ink);cursor:pointer;display:flex;align-items:center;gap:8px;text-align:left")}>
                  <span style={st.fillEllipsis}>{v.activeFilterLabel}</span>
                  <span style={css("font-size:11px;color:var(--muted)")}>▼</span>
                </button>
                {v.filterMenuOpen ? (<>
                  <div style={css("position:absolute;top:48px;left:0;width:264px;max-width:86vw;max-height:330px;overflow-y:auto;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 14px 34px rgba(0,0,0,.16);padding:8px;display:flex;flex-direction:column;gap:2px;z-index:35;animation:popIn .14s ease")}>
                    {(v.filterOptions || []).map((f: any, i22: number) => (<React.Fragment key={f?.id ?? f?.key ?? i22}>
                      <button onClick={f.onToggle} style={css(f.rowStyle)}>
                        <span style={css(f.boxStyle)}>{f.mark}</span>
                        <span style={st.fillEllipsis}>{f.label}</span>
                        <span style={css("font-size:11px;font-weight:800;color:var(--muted)")}>{f.count}</span>
                      </button>
                    </React.Fragment>))}
                    <button onClick={v.closeFilterMenu} style={css("margin-top:4px;height:36px;border:1px solid var(--line);background:var(--soft);border-radius:9px;font-size:13px;font-weight:700;color:var(--muted);cursor:pointer")}>{v.T.kapat}</button>
                  </div>
                </>) : null}
              </div>
              <div style={css("display:flex;gap:6px")}>
                <button onClick={v.setCardView} style={css(v.cardViewStyle)}>{v.T.kart}</button>
                <button onClick={v.setListView} style={css(v.listViewStyle)}>{v.T.liste}</button>
              </div>
              {v.canWriteProjects ? (<>
                <button onClick={v.newProject} style={css("height:40px;padding:0 16px;border:none;border-radius:10px;background:var(--pri,#2a3180);color:#fff;font-size:14px;font-weight:700;cursor:pointer")}>{v.T.yeniProje}</button>
              </>) : null}
            </div>
            {v.permNotice ? (<>
              <NoteBox tone="info">{v.permNotice}</NoteBox>
            </>) : null}

            <div style={css("display:flex;gap:16px;align-items:flex-start")}>
              <div style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:13px")}>

            {v.isCardView ? (<>
            <div style={css(v.cardGridStyle)}>
              {(v.visibleProjects || []).map((p: any, i23: number) => (<React.Fragment key={p?.id ?? p?.key ?? i23}>
                <div style={css("height:100%;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px;display:flex;flex-direction:column;gap:11px;box-shadow:0 1px 3px rgba(0,0,0,.05)")}>
                  <div style={css("display:flex;align-items:flex-start;gap:10px")}>
                    <div style={css("flex:1;min-width:0")}>
                      <div style={css("font-size:16px;font-weight:800;line-height:1.3;height:39px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden")}>{p.name}</div>
                      <div style={css("font-size:13px;color:var(--muted);font-weight:600;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{p.contractor}</div>
                      <div style={css("font-size:12px;color:var(--muted);font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{p.locationLabel}</div>
                    </div>
                    <span style={css(p.badgeStyle)}>{p.statusLabel}</span>
                  </div>
                  <div style={css("display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px")}>
                    <div style={css("min-width:0;background:var(--soft3);border-radius:8px;padding:7px 9px")}>
                      <div style={css("font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{v.T.ada2}</div>
                      <div style={st.rowTitle}>{p.ada}</div>
                    </div>
                    <div style={css("min-width:0;background:var(--soft3);border-radius:8px;padding:7px 9px")}>
                      <div style={css("font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{v.T.parsel2}</div>
                      <div style={st.rowTitle}>{p.parsel}</div>
                    </div>
                    <div style={css("min-width:0;background:var(--soft3);border-radius:8px;padding:7px 9px")}>
                      <div style={css("font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{v.T.belge}</div>
                      <div style={st.rowTitle}>{p.docLabel}</div>
                    </div>
                  </div>
                  <div style={css("display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--line2);padding-top:10px")}>
                    <div style={css("font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.4px")}>{v.T.muelliflerUp}</div>
                    {(p.authorChips || []).map((a: any, i24: number) => (<React.Fragment key={a?.id ?? a?.key ?? i24}>
                      <div style={css("display:flex;align-items:center;gap:8px;min-width:0")}>
                        <span style={css("width:6px;height:6px;flex:none;border-radius:50%;background:var(--brandink)")}></span>
                        <span style={css("flex:1;min-width:0;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{a.label}</span>
                        <span style={css("flex:none;font-size:11px;font-weight:600;color:var(--muted)")}>{a.job}</span>
                      </div>
                    </React.Fragment>))}
                    {p.noAuthors ? (<>
                      <div style={css("font-size:13px;font-weight:600;color:var(--faint)")}>{v.T.muellifAtanmamis}</div>
                    </>) : null}
                    {p.hasAuthorMiss ? (<>
                      <div style={css("font-size:12px;font-weight:700;color:var(--errtext);line-height:1.4")}>{p.authorMiss}</div>
                    </>) : null}
                  </div>
                  {p.hasDocWarn ? (<>
                    <div style={css("background:var(--err);border-radius:8px;padding:9px 10px;display:flex;flex-direction:column;gap:5px")}>
                      <div style={css("font-size:11px;font-weight:800;color:var(--errtext);letter-spacing:.4px")}>{v.T.bekleyenBelgelerUp}</div>
                      {(p.missingList || []).map((m: any, i25: number) => (<React.Fragment key={m?.id ?? m?.key ?? i25}>
                        <div style={css("display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--errtext)")}>
                          <span style={css("width:5px;height:5px;flex:none;border-radius:50%;background:var(--errtext)")}></span>
                          <span>{m.name}</span>
                        </div>
                      </React.Fragment>))}
                    </div>
                  </>) : null}
                  {p.locked ? (<>
                    <div style={css("font-size:12px;font-weight:700;color:var(--errtext);background:var(--err);border-radius:8px;padding:7px 9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{v.T.onayBekleyenDegisiklikVar}</div>
                  </>) : null}
                  <div style={css("margin-top:auto;display:flex;gap:7px;flex-wrap:wrap")}>
                    <button onClick={p.onOpen} style={css("flex:1;min-width:88px;height:36px;border:1px solid var(--line);background:var(--card);border-radius:9px;font-size:13px;font-weight:700;cursor:pointer")}>{v.T.detay}</button>
                    <button onClick={p.onDoc} style={css("flex:1;min-width:88px;height:36px;border:1px solid var(--line);background:var(--card);border-radius:9px;font-size:13px;font-weight:700;color:var(--brandink);cursor:pointer")}>{v.T.belge2}</button>
                    {p.canWrite ? (<>
                      <button onClick={p.onDelete} style={css("width:52px;height:36px;border:1px solid var(--errline);background:var(--err);border-radius:9px;font-size:13px;font-weight:700;color:var(--errtext);cursor:pointer")}>{v.T.sil}</button>
                    </>) : null}
                  </div>
                </div>
              </React.Fragment>))}
            </div>
            </>) : null}

            {v.isListView ? (<>
              <div role="table" aria-label={v.T.lhProje} style={css(v.listBoxStyle)}>
                <div role="row" style={css(v.listHeadStyle)}>
                  <span role="columnheader">{v.T.lhProje}</span>
                  {v.listWide ? (<>
                    <span role="columnheader">{v.T.adaParselUp}</span>
                    <span role="columnheader">{v.T.durumUp}</span>
                    <span role="columnheader">{v.T.muelliflerUp}</span>
                    <span role="columnheader">{v.T.belgeUp}</span>
                    <span role="columnheader" aria-label={v.T.islemler}></span>
                  </>) : (<>
                    <span role="columnheader">{v.T.durumUp}</span>
                  </>)}
                </div>
                {(v.visibleProjects || []).map((p: any, i26: number) => {
                  const info = (
                    <div role="cell" style={css("min-width:0")}>
                      <div style={css("font-size:14px;font-weight:800;line-height:1.35")}>{p.name}</div>
                      <div style={css("font-size:12px;color:var(--muted);font-weight:600;margin-top:3px;line-height:1.45")}>{p.contractor}</div>
                      <div style={css("font-size:12px;color:var(--muted);font-weight:600;line-height:1.45")}>{p.locationLabel}</div>
                    </div>
                  );
                  const status = <div role="cell" style={css("min-width:0;display:flex")}><span style={css(p.badgeStyle)}>{p.statusLabel}</span></div>;
                  const label = (text: string) => v.listNarrow ? <div style={css("font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.4px;margin-bottom:4px")}>{text}</div> : null;
                  const plot = (
                    <div role="cell" style={css("min-width:0")}>
                      {label(v.T.adaParselUp)}
                      <div style={css("font-size:13px;font-weight:700")}>{p.ada} / {p.parsel}</div>
                    </div>
                  );
                  const authors = (
                    <div role="cell" style={css(v.listNarrow ? "min-width:0;grid-column:1 / -1;display:flex;flex-direction:column;gap:4px" : "min-width:0;display:flex;flex-direction:column;gap:4px")}>
                      {label(v.T.muelliflerUp)}
                      {(p.authorChips || []).map((a: any, i27: number) => (<React.Fragment key={a?.id ?? i27}>
                        <div style={css("font-size:13px;font-weight:700;line-height:1.35")}>{a.label}<span style={st.caption}> · {a.job}</span></div>
                      </React.Fragment>))}
                      {p.noAuthors ? <div style={css("font-size:13px;font-weight:600;color:var(--faint)")}>—</div> : null}
                      {p.hasAuthorMiss ? <div style={css("font-size:11px;font-weight:700;color:var(--errtext);line-height:1.35")}>{p.authorMiss}</div> : null}
                    </div>
                  );
                  const docs = (
                    <div role="cell" style={css("min-width:0;display:flex;flex-direction:column;gap:4px")}>
                      {label(v.T.belgeUp)}
                      <div style={st.title13}>{p.docLabel}</div>
                      {(p.missingList || []).map((m: any, i28: number) => (<React.Fragment key={m?.id ?? i28}>
                        <div style={css("display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:var(--errtext)")}>
                          <span style={css("width:5px;height:5px;flex:none;border-radius:50%;background:var(--errtext)")}></span>
                          <span>{m.name}</span>
                        </div>
                      </React.Fragment>))}
                    </div>
                  );
                  const actions = (
                    <div role="cell" style={css(v.listActStyle)}>
                      <button onClick={p.onOpen} style={css("height:32px;padding:0 11px;border:1px solid var(--line);background:var(--card);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.detay}</button>
                      <button onClick={p.onDoc} style={css("height:32px;padding:0 11px;border:1px solid var(--line);background:var(--card);border-radius:8px;font-size:12px;font-weight:700;color:var(--brandink);cursor:pointer")}>{v.T.belge2}</button>
                    </div>
                  );
                  return (
                    <div key={p?.id ?? i26} role="row" style={css(v.listRowStyle)}>
                      {v.listWide ? (<>{info}{plot}{status}{authors}{docs}{actions}</>) : (<>
                        {info}{status}
                        <div style={css(v.listMoreStyle)}>{plot}{docs}{authors}{actions}</div>
                      </>)}
                    </div>
                  );
                })}
              </div>
            </>) : null}

            {v.noProjects ? (<>
              <div style={css("text-align:center;padding:36px 12px;color:var(--muted);font-size:14px;font-weight:600")}>{v.T.kayitBulunamadi}</div>
            </>) : null}
              </div>
            </div>
          </div>
        </>
  );
}
