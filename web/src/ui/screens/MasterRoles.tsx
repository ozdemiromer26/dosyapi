import { st } from "../styles";
import React from "react";
import { css } from "../css";
import type { Vals } from "../../vm/types";

export function MasterRoles({ v }: { v: Vals }) {
  return (
    <>
          <div style={css("background:var(--mcard);border:1px solid var(--mline);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:13px")}>
            <div style={st.masterTitle}>{v.T.rollerAmpYetkiler}</div>
            <div style={st.masterHint}>{v.T.kademe1TekVe}</div>
            {(v.mRoles || []).map((r: any, i4: number) => (<React.Fragment key={r?.id ?? r?.key ?? i4}>
              <div style={css("border:1px solid var(--mline);border-radius:12px;padding:13px;background:var(--mcard2);display:flex;flex-direction:column;gap:10px")}>
                <div style={css("display:flex;align-items:center;gap:9px;flex-wrap:wrap")}>
                  <span style={css(r.lvlStyle)}>{v.T.k}{r.level}</span>
                  <input onChange={r.onName} defaultValue={r.name} style={css("flex:1;min-width:120px;height:36px;border:1px solid var(--mline2);background:var(--minput);border-radius:8px;padding:0 10px;font-size:14px;font-weight:700;color:var(--mink)")} />
                  {r.deletable ? (<>
                    <button onClick={r.onDelete} style={css("height:36px;padding:0 11px;border:1px solid var(--merrline);background:var(--merr);color:var(--merrtext);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.sil}</button>
                  </>) : null}
                </div>
                {r.isTop ? (<>
                  <div style={css("background:var(--minput);border:1px solid var(--mline);border-radius:9px;padding:10px;font-size:12px;color:var(--mmuted);font-weight:600;line-height:1.55")}>{v.T.tumYetkilerAcikVe}</div>
                </>) : null}
                {r.editable ? (<>
                  <div style={css("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:10px")}>
                    <label style={css("display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:700;color:var(--mmuted);letter-spacing:.4px")}>{v.T.projeler}
                      <select onChange={r.onProj} value={r.projVal} style={css("height:36px;border:1px solid var(--mline2);background:var(--minput);border-radius:8px;padding:0 9px;font-size:13px;font-weight:700;color:var(--mink);letter-spacing:0")}>
                        {(v.projOptList || []).map((o: any, i5: number) => (<React.Fragment key={o?.id ?? o?.key ?? i5}>
                          <option value={o.id}>{o.label}</option>
                        </React.Fragment>))}
                      </select>
                    </label>
                    <label style={css("display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:700;color:var(--mmuted);letter-spacing:.4px")}>{v.T.muellifMuteahhitKayitlari}
                      <select onChange={r.onRec} value={r.recVal} style={css("height:36px;border:1px solid var(--mline2);background:var(--minput);border-radius:8px;padding:0 9px;font-size:13px;font-weight:700;color:var(--mink);letter-spacing:0")}>
                        {(v.projOptList || []).map((o: any, i6: number) => (<React.Fragment key={o?.id ?? o?.key ?? i6}>
                          <option value={o.id}>{o.label}</option>
                        </React.Fragment>))}
                      </select>
                    </label>
                    <div style={st.stack5}>
                      <span style={css("font-size:11px;font-weight:700;color:var(--mmuted);letter-spacing:.4px")}>{v.T.yetkiler}</span>
                      <div style={css("position:relative")}>
                        <button onClick={r.onFlagsToggle} style={css("width:100%;height:36px;border:1px solid var(--mline2);background:var(--minput);border-radius:8px;padding:0 10px;font-size:13px;font-weight:700;color:var(--mink);cursor:pointer;display:flex;align-items:center;gap:8px;text-align:left")}>
                          <span style={st.fillEllipsis}>{r.flagsSummary}</span>
                          <span style={css("font-size:11px;color:var(--mmuted)")}>▼</span>
                        </button>
                        {r.flagsOpen ? (<>
                          <div style={css("position:absolute;top:41px;left:0;right:0;z-index:25;background:var(--mcard);border:1px solid var(--mline2);border-radius:10px;box-shadow:0 14px 34px rgba(0,0,0,.18);padding:6px;display:flex;flex-direction:column;gap:2px;animation:popIn .14s ease")}>
                            {(r.flags || []).map((f: any, i7: number) => (<React.Fragment key={f?.id ?? f?.key ?? i7}>
                              <button onClick={f.onToggle} style={css(f.rowStyle)}>
                                <span style={css(f.boxStyle)}>{f.mark}</span>
                                <span style={st.fillEllipsis}>{f.label}</span>
                              </button>
                            </React.Fragment>))}
                            <button onClick={v.closeDD} style={css("margin-top:4px;height:32px;border:1px solid var(--mline2);background:var(--mbtn);border-radius:8px;font-size:12px;font-weight:700;color:var(--mtext);cursor:pointer")}>{v.T.kapat}</button>
                          </div>
                        </>) : null}
                      </div>
                    </div>
                    <div style={st.stack5}>
                      <span style={css("font-size:11px;font-weight:700;color:var(--mmuted);letter-spacing:.4px")}>{v.T.hangiAltRolleriYonetebilir}</span>
                      <div style={css("position:relative")}>
                        <button onClick={r.onManageToggle} style={css("width:100%;height:36px;border:1px solid var(--mline2);background:var(--minput);border-radius:8px;padding:0 10px;font-size:13px;font-weight:700;color:var(--mink);cursor:pointer;display:flex;align-items:center;gap:8px;text-align:left")}>
                          <span style={st.fillEllipsis}>{r.manageSummary}</span>
                          <span style={css("font-size:11px;color:var(--mmuted)")}>▼</span>
                        </button>
                        {r.manageOpen ? (<>
                          <div style={css("position:absolute;top:41px;left:0;right:0;z-index:25;background:var(--mcard);border:1px solid var(--mline2);border-radius:10px;box-shadow:0 14px 34px rgba(0,0,0,.18);padding:6px;display:flex;flex-direction:column;gap:2px;animation:popIn .14s ease")}>
                            {(r.manageOpts || []).map((m: any, i8: number) => (<React.Fragment key={m?.id ?? m?.key ?? i8}>
                              <button onClick={m.onToggle} style={css(m.rowStyle)}>
                                <span style={css(m.boxStyle)}>{m.mark}</span>
                                <span style={st.fillEllipsis}>{m.label}</span>
                              </button>
                            </React.Fragment>))}
                            <button onClick={v.closeDD} style={css("margin-top:4px;height:32px;border:1px solid var(--mline2);background:var(--mbtn);border-radius:8px;font-size:12px;font-weight:700;color:var(--mtext);cursor:pointer")}>{v.T.kapat}</button>
                          </div>
                        </>) : null}
                      </div>
                    </div>
                  </div>
                </>) : null}
              </div>
            </React.Fragment>))}
            <div style={css("border-top:1px dashed var(--mline);padding-top:13px;display:flex;gap:8px;flex-wrap:wrap")}>
              <input name="rName" ref={v.refRName} onChange={v.onField} placeholder={v.T.yeniRolAdi} style={css("flex:1;min-width:140px;height:40px;border:1px solid var(--mline2);background:var(--minput);border-radius:8px;padding:0 11px;font-size:14px;font-weight:600;color:var(--mink)")} />
              <input name="rLevel" ref={v.refRLevel} onChange={v.onField} type="number" min="2" placeholder={v.T.kademe2} style={css("width:96px;height:40px;border:1px solid var(--mline2);background:var(--minput);border-radius:8px;padding:0 11px;font-size:14px;font-weight:600;color:var(--mink)")} />
              <button onClick={v.addRole} style={css("height:40px;padding:0 14px;border:none;border-radius:8px;background:var(--pri,#2a3180);color:#fff;font-size:13px;font-weight:700;cursor:pointer")}>{v.T.rolEkle}</button>
            </div>
          </div>
          </>
  );
}
