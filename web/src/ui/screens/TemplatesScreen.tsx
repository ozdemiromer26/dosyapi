import { st } from "../styles";
import React from "react";
import { css } from "../css";
import type { Vals } from "../../vm/types";
import { TableMenu } from "./TableMenu";

export function TemplatesScreen({ v }: { v: Vals }) {
  return (
    <>
          <div style={st.stack14}>
            {v.tplListMode ? (<>
              <div style={st.stack14}>
                <div style={css("display:flex;gap:12px;align-items:center;flex-wrap:wrap")}>
                  <div style={css("flex:1;min-width:240px;font-size:13px;color:var(--muted);font-weight:600;line-height:1.55;text-wrap:pretty")}>{v.T.tplIntro}</div>
                  <button onClick={v.newTpl} style={css("height:40px;padding:0 16px;border:none;border-radius:10px;background:var(--pri,#2a3180);color:#fff;font-size:14px;font-weight:700;cursor:pointer")}>{v.T.yeniSablon}</button>
                </div>
                <div style={css("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr));gap:13px;align-items:stretch")}>
                  {(v.tplCards || []).map((t: any, i49: number) => (<React.Fragment key={t?.id ?? t?.key ?? i49}>
                    <div style={css("background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px;display:flex;flex-direction:column;gap:11px;box-shadow:0 1px 3px rgba(0,0,0,.05)")}>
                      <div style={css("display:flex;gap:11px;align-items:flex-start")}>
                        <div style={css("width:38px;height:38px;flex:none;border-radius:10px;background:var(--tint);color:var(--brandink);display:flex;align-items:center;justify-content:center")}>{t.icon}</div>
                        <div style={css("flex:1;min-width:0")}>
                          <div style={css("font-size:14px;font-weight:800;line-height:1.35")}>{t.name}</div>
                          <div style={css("font-size:12px;color:var(--muted);font-weight:600;margin-top:3px")}>{t.meta}</div>
                        </div>
                      </div>
                      <div style={css("display:flex;gap:6px;flex-wrap:wrap")}>
                        {(t.ctxChips || []).map((c: any, i50: number) => (<React.Fragment key={c?.id ?? c?.key ?? i50}>
                          <span style={css("font-size:11px;font-weight:800;padding:4px 8px;border-radius:6px;background:var(--soft3);color:var(--muted)")}>{c.label}</span>
                        </React.Fragment>))}
                      </div>
                      <div style={css("margin-top:auto;display:flex;gap:7px")}>
                        <button onClick={t.onEdit} style={css("flex:1;height:36px;border:1px solid var(--line);background:var(--card);border-radius:9px;font-size:13px;font-weight:700;cursor:pointer")}>{v.T.duzenle}</button>
                        <button onClick={t.onDup} style={css("height:36px;padding:0 12px;border:1px solid var(--line);background:var(--card);border-radius:9px;font-size:13px;font-weight:700;cursor:pointer")}>{v.T.kopyala}</button>
                        <button onClick={t.onDelete} style={css("width:52px;height:36px;border:1px solid var(--errline);background:var(--err);border-radius:9px;font-size:13px;font-weight:700;color:var(--errtext);cursor:pointer")}>{v.T.sil}</button>
                      </div>
                    </div>
                  </React.Fragment>))}
                </div>
                {v.noTpls ? (<>
                  <div style={css("text-align:center;padding:36px 12px;color:var(--muted);font-size:14px;font-weight:600")}>{v.T.henuzSablonYok}</div>
                </>) : null}
              </div>
            </>) : null}

            {v.tplEditMode ? (<>
              <div style={css("display:flex;flex-direction:column;gap:12px")}>
                <div style={css("display:flex;gap:10px;align-items:center;flex-wrap:wrap")}>
                  <button onClick={v.tplBack} style={css("border:none;background:none;color:var(--brandink);font-size:13px;font-weight:700;cursor:pointer;padding:0;white-space:nowrap")}>{v.T.sablonlaraDon}</button>
                  <input name="tplName" onChange={v.onTplName} defaultValue={v.tplDraft.name} placeholder={v.T.sablonAdi} style={css("flex:1;min-width:200px;height:40px;border:1px solid var(--line);background:var(--card);border-radius:9px;padding:0 12px;font-size:16px;font-weight:800")} />
                  <div style={css("display:flex;background:var(--soft3);border-radius:9px;padding:3px;gap:3px")}>
                    <button onClick={v.tplModeEdit} style={css(v.tplModeEditStyle)}>{v.T.etiketler}</button>
                    <button onClick={v.tplModePreview} style={css(v.tplModePrevStyle)}>{v.T.ornekVeri}</button>
                  </div>
                  {v.tplDirty ? (<>
                    <span style={css("font-size:12px;font-weight:800;color:var(--warntext);background:var(--warn);border-radius:999px;padding:5px 10px;white-space:nowrap")}>{v.T.kaydedilmedi}</span>
                  </>) : null}
                  <button onClick={v.saveTpl} style={css("height:40px;padding:0 18px;border:none;border-radius:9px;background:var(--pri,#2a3180);color:#fff;font-size:14px;font-weight:700;cursor:pointer")}>{v.T.kaydetBtn}</button>
                </div>
                <div style={css("display:flex;gap:7px;align-items:center;flex-wrap:wrap")}>
                  <span style={css("font-size:11px;font-weight:800;letter-spacing:.5px;color:var(--muted);margin-right:3px")}>{v.T.kullanimYerleriUp}</span>
                  <div data-rb="1" style={css("position:relative;display:flex;min-width:0")}>
                    <button onClick={v.tplCtxMenu} aria-haspopup="listbox" aria-expanded={v.tplCtxOpen} style={css(v.tplCtxBtnStyle)} className="hv1"><span style={css("flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left")}>{v.tplCtxSummary}</span>{v.tplCtxCountShow ? (<><span style={css("flex:none;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:var(--pri,#2a3180);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center")}>{v.tplCtxCount}</span></>) : null}<span style={css("flex:none;font-size:11px;color:var(--muted)")}>▾</span></button>
                    {v.tplCtxOpen ? (<>
                      <div role="listbox" aria-multiselectable="true" style={css("position:absolute;top:calc(100% + 4px);left:0;z-index:40;background:var(--card);border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.16);padding:6px;min-width:100%;width:max-content;max-width:calc(100vw - 28px);display:flex;flex-direction:column;gap:2px")}>
                        {(v.tplCtxOpts || []).map((c: any, i51: number) => (<React.Fragment key={c?.id ?? c?.key ?? i51}>
                          <button role="option" aria-selected={c.on} onClick={c.onToggle} style={css(c.rowStyle)} className="hv2"><span style={css(c.boxStyle)}>{c.mark}</span><span style={css("white-space:nowrap")}>{c.label}</span></button>
                        </React.Fragment>))}
                        <div style={css("height:1px;background:var(--line2);margin:4px 2px")}></div>
                        <button onClick={v.tplCtxAll} style={css("height:30px;padding:0 10px;border:none;border-radius:7px;background:transparent;color:var(--brandink);font-size:13px;font-weight:700;cursor:pointer;text-align:left")} className="hv2">{v.tplCtxAllLabel}</button>
                      </div>
                    </>) : null}
                  </div>
                  {v.tplIsPreview ? (<>
                    <select onChange={v.onTplSample} value={v.tplSampleVal} style={css("margin-left:auto;min-width:220px;max-width:100%;height:36px;border:1px solid var(--line);background:var(--card);border-radius:8px;padding:0 9px;font-size:13px;font-weight:700")}>
                      {(v.tplSampleOpts || []).map((o: any, i52: number) => (<React.Fragment key={o?.id ?? o?.key ?? i52}>
                        <option value={o.id}>{o.label}</option>
                      </React.Fragment>))}
                    </select>
                  </>) : null}
                </div>

                <div style={css("background:var(--card);border:1px solid var(--line);border-radius:14px;display:flex;flex-direction:column")}>
                  <div data-stickbar="1" style={css("position:sticky;top:var(--hdr-h,59px);z-index:9;background:var(--card);border-bottom:1px solid var(--line);border-radius:14px 14px 0 0;box-shadow:0 4px 12px rgba(0,0,0,.05)")}>
                    <div style={css("display:flex;flex-wrap:wrap;align-items:flex-end;gap:2px;padding:6px 8px 0;background:var(--soft);border-bottom:1px solid var(--line);border-radius:14px 14px 0 0")}>
                      <div style={css("display:flex;align-items:center;gap:1px;padding:0 6px 5px 0;margin-right:6px;border-right:1px solid var(--line2);align-self:center")}>
                        
                        <button onMouseDown={v.tbKeep} onClick={v.rbUndo} title={`${v.T.geriAl} (Ctrl+Z)`} style={css(v.undoStyle)}>{v.ri.undo}</button>
                        <button onMouseDown={v.tbKeep} onClick={v.rbRedo} title={`${v.T.yinele} (Ctrl+Y)`} style={css(v.redoStyle)}>{v.ri.redo}</button>
                      </div>
                      {(v.rbTabs || []).map((t: any, i53: number) => (<React.Fragment key={t?.id ?? t?.key ?? i53}>
                        <button onMouseDown={v.tbKeep} onClick={t.onPick} style={css(t.style)}>{t.label}</button>
                      </React.Fragment>))}
                    </div>
                    <div style={css(v.rbBodyStyle)}>
{v.rbHome ? (<><div style={st.toolRow}>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInCol)}><div style={st.toolGroup}><select onChange={v.tbBlock} aria-label={v.T.stil} style={css("height:28px;width:96px;border:1px solid var(--line);background:var(--card);border-radius:6px;padding:0 6px;font-size:12px;font-weight:600;color:var(--ink);margin-right:3px")}><option value="">{v.T.stil}</option><option value="p">{v.T.paragraf}</option><option value="h1">{v.T.baslik1}</option><option value="h2">{v.T.baslik2}</option><option value="h3">{v.T.baslik3}</option></select><select onChange={v.rbFont} value={v.fmtFont} title={v.T.rbYaziTipi} style={css(v.rbFontSel)}><option value="">—</option>{(v.fontOpts || []).map((f: any, i54: number) => (<React.Fragment key={f?.id ?? f?.key ?? i54}><option value={f.id}>{f.label}</option></React.Fragment>))}</select>
<select onChange={v.rbSize} value={v.fmtSize} title={v.T.boyut} style={css("height:28px;border:1px solid var(--line);background:var(--card);border-radius:6px;padding:0 6px;font-size:12px;font-weight:600;color:var(--ink);width:62px;margin-left:3px")}><option value="">—</option>{(v.rbSizes || []).map((z: any, i55: number) => (<React.Fragment key={z?.id ?? z?.key ?? i55}><option value={z.v}>{z.v}</option></React.Fragment>))}</select>
{v.rbDesk ? (<><button onMouseDown={v.tbKeep} onClick={v.rbGrow} title={v.T.rbBuyut} style={css("height:28px;min-width:28px;padding:0 5px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--ink);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;flex:none;font-size:12px;font-weight:700;white-space:nowrap;margin-left:3px")} className="hv2"><span style={st.title14}>A</span><span style={css("font-size:9px;margin-left:-4px;margin-top:-7px")}>▲</span></button>
<button onMouseDown={v.tbKeep} onClick={v.rbShrink} title={v.T.rbKucult} style={st.toolButton} className="hv2"><span style={css("font-size:11.5px;font-weight:800")}>A</span><span style={css("font-size:8px;margin-left:-4px;margin-top:-6px")}>▼</span></button>
<button onMouseDown={v.tbKeep} onClick={v.tbClear} title={v.T.bicimiTemizle} style={css("height:28px;min-width:28px;padding:0 5px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--ink);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;flex:none;font-size:12px;font-weight:700;white-space:nowrap;color:var(--muted)")} className="hv2">T<span style={css("font-size:9px;margin-left:-4px")}>x</span></button></>) : null}</div><div style={st.toolGroup}><button onMouseDown={v.tbKeep} onClick={v.tbBold} title={v.T.kalin} style={css(v.stB)}>B</button><button onMouseDown={v.tbKeep} onClick={v.tbItalic} title={v.T.italik} style={css(v.stI)}>I</button><button onMouseDown={v.tbKeep} onClick={v.tbUnder} title={v.T.altiCizili} style={css(v.stU)}>U</button>{v.rbDesk ? (<><button onMouseDown={v.tbKeep} onClick={v.tbStrike} title={v.T.rbUstuCizili} style={css(v.stS)}>ab</button><button onMouseDown={v.tbKeep} onClick={v.tbSub} title={v.T.rbAltSimge} style={css(v.stSub)}>x<sub style={css("font-size:9px")}>2</sub></button><button onMouseDown={v.tbKeep} onClick={v.tbSup} title={v.T.rbUstSimge} style={css(v.stSup)}>x<sup style={css("font-size:9px")}>2</sup></button></>) : null}
<span style={css("width:1px;height:18px;background:var(--line2);margin:0 3px")}></span>
<div data-rb="1" style={css("position:relative;display:flex")}><button onMouseDown={v.tbKeep} onClick={v.rbFcApply} title={v.T.yaziRengi} style={css("height:28px;min-width:28px;padding:0 5px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--ink);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;flex:none;font-size:12px;font-weight:700;white-space:nowrap;border-radius:6px 0 0 6px;padding:0 4px")} className="hv2"><span style={css(v.fcBarStyle)}>A</span></button><button onMouseDown={v.tbKeep} onClick={v.mnFc} title={v.T.yaziRengi} style={css("height:28px;min-width:28px;padding:0 5px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--ink);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;flex:none;font-size:12px;font-weight:700;white-space:nowrap;min-width:15px;padding:0 2px;border-radius:0 6px 6px 0")} className="hv2"><span style={st.toolNote}>▾</span></button>{v.mFc ? (<><div style={st.dropdownFit}><div style={st.menuHeading}>{v.T.yaziRengiUp}</div><div style={css("display:grid;grid-template-columns:repeat(8,22px);gap:5px;padding:4px 9px 6px")}>{(v.fcColors || []).map((c: any, i56: number) => (<React.Fragment key={c?.id ?? c?.key ?? i56}><button onMouseDown={v.tbKeep} onClick={c.onPick} title={c.hex} style={css(c.style)}></button></React.Fragment>))}</div><button onMouseDown={v.tbKeep} onClick={v.rbFcAuto} style={st.menuItem} className="hv3">{v.T.rbOtomatik}</button></div></>) : null}</div>
{v.rbDesk ? (<><div data-rb="1" style={css("position:relative;display:flex")}><button onMouseDown={v.tbKeep} onClick={v.rbHlApply} title={v.T.rbVurgu} style={css("height:28px;min-width:28px;padding:0 5px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--ink);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;flex:none;font-size:12px;font-weight:700;white-space:nowrap;border-radius:6px 0 0 6px;padding:0 4px")} className="hv2"><span style={css(v.hlBarStyle)}>ab</span></button><button onMouseDown={v.tbKeep} onClick={v.mnHl} title={v.T.rbVurgu} style={css("height:28px;min-width:28px;padding:0 5px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--ink);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;flex:none;font-size:12px;font-weight:700;white-space:nowrap;min-width:15px;padding:0 2px;border-radius:0 6px 6px 0")} className="hv2"><span style={st.toolNote}>▾</span></button>{v.mHl ? (<><div style={st.dropdownFit}><div style={st.menuHeading}>{v.T.rbVurguUp}</div><div style={css("display:grid;grid-template-columns:repeat(8,22px);gap:5px;padding:4px 9px 6px")}>{(v.hlColors || []).map((c: any, i57: number) => (<React.Fragment key={c?.id ?? c?.key ?? i57}><button onMouseDown={v.tbKeep} onClick={c.onPick} title={c.hex} style={css(c.style)}></button></React.Fragment>))}</div><button onMouseDown={v.tbKeep} onClick={v.rbHlNone} style={st.menuItem} className="hv3">{v.T.rbRenkYok}</button></div></>) : null}</div></>) : null}</div></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbYaziTipi}</div></>) : null}</div>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInCol)}><div style={st.toolGroup}><button onMouseDown={v.tbKeep} onClick={v.tbUL} title={v.T.rbMadde} style={css(v.stUL)}>{v.tbI.ul}</button><button onMouseDown={v.tbKeep} onClick={v.tbOL} title={v.T.rbNumara} style={css(v.stOL)}>{v.tbI.ol}</button>{v.rbDesk ? (<><span style={css("width:1px;height:18px;background:var(--line2);margin:0 3px")}></span><button onMouseDown={v.tbKeep} onClick={v.tbOut} title={v.T.rbGirintiAzalt} style={st.toolButton} className="hv2">{v.ri.outdent}</button><button onMouseDown={v.tbKeep} onClick={v.tbIn} title={v.T.rbGirintiArtir} style={st.toolButton} className="hv2">{v.ri.indent}</button><div data-rb="1" style={css("position:relative;display:flex")}><button onMouseDown={v.tbKeep} onClick={v.mnLs} title={v.T.rbSatirAraligi} style={st.toolButton} className="hv2">{v.ri.spacing}<span style={st.toolNote}>▾</span></button>{v.mLs ? (<><div style={st.dropdown}><div style={st.menuHeading}>{v.T.rbSatirAraligiUp}</div>{(v.lsOpts || []).map((o: any, i58: number) => (<React.Fragment key={o?.id ?? o?.key ?? i58}><button onMouseDown={v.tbKeep} onClick={o.onPick} style={st.menuItem} className="hv3"><span style={st.menuMark}>{o.mark}</span><span style={css("flex:1")}>{o.label}</span></button></React.Fragment>))}<div style={css("height:1px;background:var(--line2);margin:4px 0")}></div><button onMouseDown={v.tbKeep} onClick={v.rbSpAdd} style={st.menuItem} className="hv3"><span style={st.menuMark}></span>{v.T.rbSonraEkle}</button><button onMouseDown={v.tbKeep} onClick={v.rbSpDel} style={st.menuItem} className="hv3"><span style={st.menuMark}></span>{v.T.rbSonraKaldir}</button></div></>) : null}</div></>) : null}</div><div style={st.toolGroup}><button onMouseDown={v.tbKeep} onClick={v.tbAL} title={v.T.rbSola} style={css(v.stAL)}>{v.tbI.al}</button><button onMouseDown={v.tbKeep} onClick={v.tbAC} title={v.T.rbOrtala} style={css(v.stAC)}>{v.tbI.ac}</button><button onMouseDown={v.tbKeep} onClick={v.tbAR} title={v.T.rbSaga} style={css(v.stAR)}>{v.tbI.ar}</button><button onMouseDown={v.tbKeep} onClick={v.tbAJ} title={v.T.rbIkiYana} style={css(v.stAJ)}>{v.tbI.aj}</button></div></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.paragraf}</div></>) : null}</div>
</div></>) : null}
{v.rbInsert ? (<><div style={st.toolRow}>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInRow)}><div data-rb="1" style={css("position:relative;display:flex")}><button onMouseDown={v.tbKeep} onClick={v.mnTbl} style={css(v.rbBB)} className="hv2">{v.ri.table}<span>{v.T.tablo} ▾</span></button>{v.mTbl ? <TableMenu v={v} /> : null}</div></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbTablolar}</div></>) : null}</div>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInRow)}><button onMouseDown={v.tbKeep} onClick={v.tbLogo} style={css(v.rbBB)} className="hv2">{v.ri.logo}<span>{v.T.sirketLogosu}</span></button><label style={css(v.rbBB)} className="hv2">{v.ri.image}<span>{v.T.rbResim}</span><input type="file" accept="image/*" onChange={v.tbImgFile} style={css("display:none")} /></label></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbCizimler}</div></>) : null}</div>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInRow)}><div data-rb="1" style={css("position:relative;display:flex")}><button onMouseDown={v.tbKeep} onClick={v.mnSig} style={css(v.rbBB)} className="hv2">{v.ri.sig}<span>{v.T.rbImzaBlogu} ▾</span></button>{v.mSig ? (<><div style={st.dropdown}>{(v.sigOpts || []).map((o: any, i60: number) => (<React.Fragment key={o?.id ?? o?.key ?? i60}><button onMouseDown={v.tbKeep} onClick={o.onPick} style={st.menuItem} className="hv3"><span style={st.menuMark}>{o.mark}</span><span style={css("flex:1")}>{o.label}</span></button></React.Fragment>))}</div></>) : null}</div></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.imzaAlani}</div></>) : null}</div>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInRow)}><button onMouseDown={v.tbKeep} onClick={v.tbPB} style={css(v.rbBB)} className="hv2">{v.ri.pb}<span>{v.T.sayfaSonu}</span></button><button onMouseDown={v.tbKeep} onClick={v.tbHr} style={css(v.rbBB)} className="hv2">{v.ri.hr}<span>{v.T.rbYatayCizgi}</span></button></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbSayfalar}</div></>) : null}</div>
</div></>) : null}
{v.rbVars ? (<><div style={st.toolRow}>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInRow)}><div data-rb="1" style={css("position:relative;display:flex")}><input name="varQ" onChange={v.onVarQ} onFocus={v.onVarFocus} defaultValue={v.varQ} placeholder={v.T.degiskenAra} style={css("height:30px;width:200px;border:1px solid var(--line);background:var(--soft);border-radius:7px;padding:0 10px;font-size:12px;font-weight:600")} />{v.mQ ? (<><div style={css("position:absolute;top:calc(100% + 4px);left:0;z-index:40;background:var(--card);border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.16);padding:6px;max-width:calc(100vw - 28px);display:flex;flex-direction:column;gap:2px;min-width:200px;min-width:260px")}><div style={css("max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:1px")}>{(v.varHits || []).map((v: any, i61: number) => (<React.Fragment key={v?.id ?? v?.key ?? i61}><button onMouseDown={v.tbKeep} onClick={v.onInsert} style={st.menuItem} className="hv3"><span style={css("flex:1")}>{v.label}</span><span style={css("font-size:10px;font-weight:700;color:var(--muted)")}>{v.group}</span></button></React.Fragment>))}</div>{v.noVarHits ? (<><div style={css("font-size:12px;color:var(--muted);font-weight:600;padding:6px 9px")}>{v.T.eslesenDegiskenYok}</div></>) : null}</div></>) : null}</div></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbBul}</div></>) : null}</div>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInRow)}><div style={css("display:grid;grid-auto-flow:column;grid-template-rows:repeat(2,auto);gap:4px 4px")}>{(v.varDD || []).map((g: any, i62: number) => (<React.Fragment key={g?.id ?? g?.key ?? i62}><div data-rb="1" style={css("position:relative;display:flex")}><button onMouseDown={v.tbKeep} onClick={g.onMenu} style={css(g.btnStyle)}>{g.label} <span style={css("font-size:10px;font-weight:800;color:var(--muted)")}>{g.count}</span><span style={st.toolNote}>▾</span></button>
{g.open ? (<><div style={st.dropdown}><div style={st.menuHeading}>{g.up}</div><div style={css("max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:1px")}>{(g.items || []).map((v: any, i63: number) => (<React.Fragment key={v?.id ?? v?.key ?? i63}><button onMouseDown={v.tbKeep} onClick={v.onInsert} style={st.menuItem} className="hv3"><span style={css("flex:1")}>{v.label}</span><span style={css("font-size:10px;font-weight:800;color:var(--brandink);border:1px solid var(--tintline);border-radius:5px;padding:1px 6px")}>+</span></button></React.Fragment>))}</div></div></>) : null}</div></React.Fragment>))}</div></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbAlanlar}</div></>) : null}</div>
{v.hasListDefs ? (<><div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInRow)}>{(v.listDD || []).map((l: any, i64: number) => (<React.Fragment key={l?.id ?? l?.key ?? i64}><div data-rb="1" style={css("position:relative;display:flex")}><button onMouseDown={v.tbKeep} onClick={l.onMenu} style={css(v.rbBB)} className="hv2">{v.ri.list}<span>{l.label} ▾</span></button>{l.menuOpen ? (<><div style={st.dropdown}><div style={css("padding:8px 6px 6px;display:flex;flex-direction:column;gap:14px;width:310px;white-space:normal")}>
<div style={css("display:flex;flex-direction:column;gap:7px")}><div style={css("display:flex;align-items:center;gap:7px")}><span style={css("width:18px;height:18px;flex:none;border-radius:50%;background:var(--pri,#2a3180);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center")}>1</span><span style={st.title13}>{v.T.tabloOlarakEkle}</span></div>
<div style={css("font-size:12px;color:var(--muted);font-weight:600;line-height:1.5;padding-left:25px")}>{v.T.sutunSecHint}</div>
<div style={css("display:flex;gap:5px;flex-wrap:wrap;padding-left:25px")}>{(l.cols || []).map((c: any, i65: number) => (<React.Fragment key={c?.id ?? c?.key ?? i65}><button onMouseDown={v.tbKeep} onClick={c.onToggle} style={css(c.style)}>{c.mark} {c.label}</button></React.Fragment>))}</div>
<div style={css("padding-left:25px")}><button onMouseDown={v.tbKeep} onClick={l.onTableC} style={css("width:100%;height:34px;border:none;border-radius:8px;background:var(--pri,#2a3180);color:#fff;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.tabloyuEkle}</button></div></div>
<div style={css("display:flex;flex-direction:column;gap:7px")}><div style={css("display:flex;align-items:center;gap:7px")}><span style={css("width:18px;height:18px;flex:none;border-radius:50%;background:var(--pri,#2a3180);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center")}>2</span><span style={st.title13}>{v.T.tekrarliBolgeEkle}</span></div>
<div style={css("font-size:12px;color:var(--muted);font-weight:600;line-height:1.5;padding-left:25px")}>{v.T.tekrarliHint}</div>
<div style={css("padding-left:25px")}><button onMouseDown={v.tbKeep} onClick={l.onRepeatC} style={css("width:100%;height:34px;border:1px dashed var(--pri,#2a3180);background:var(--tint);color:var(--brandink);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.bolgeyiEkle}</button></div></div>
<div style={st.stack5}><div style={css("display:flex;align-items:center;gap:7px")}><span style={css("width:18px;height:18px;flex:none;border-radius:50%;background:var(--soft3);color:var(--muted);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center")}>·</span><span style={st.title13}>{v.T.satirAlanlariBaslik}</span></div>
<div style={css("font-size:12px;color:var(--muted);font-weight:600;line-height:1.5;padding-left:25px")}>{v.T.satirAlanlariAciklama}</div>
<div style={css("display:flex;flex-direction:column;gap:1px;padding-left:19px")}>{(l.fields || []).map((f: any, i66: number) => (<React.Fragment key={f?.id ?? f?.key ?? i66}><button onMouseDown={v.tbKeep} onClick={f.onInsert} style={st.menuItem} className="hv3"><span style={css("flex:1")}>{f.label}</span><span style={css("font-size:10px;font-weight:800;color:var(--brandink);border:1px dashed var(--tintline);border-radius:5px;padding:1px 6px")}>+</span></button></React.Fragment>))}</div></div>
</div></div></>) : null}</div></React.Fragment>))}</div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbListeler}</div></>) : null}</div></>) : null}
{v.rbDesk ? (<><div style={css("display:flex;align-items:center;padding:6px 12px;max-width:260px")}><div style={css("font-size:11px;color:var(--muted);font-weight:600;line-height:1.5")}>{v.T.imlecinOlduguYere}</div></div></>) : null}
</div></>) : null}
{v.rbLayout ? (<><div style={st.toolRow}>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInRow)}><div data-rb="1" style={css("position:relative;display:flex")}><button onMouseDown={v.tbKeep} onClick={v.mnMg} style={css(v.rbBB)} className="hv2">{v.ri.margins}<span>{v.T.rbKenarBosluklari} ▾</span></button>{v.mMg ? (<><div style={css("position:absolute;top:calc(100% + 4px);left:0;z-index:40;background:var(--card);border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.16);padding:6px;max-width:calc(100vw - 28px);display:flex;flex-direction:column;gap:2px;min-width:200px;min-width:290px")}>{(v.mgPresets || []).map((o: any, i67: number) => (<React.Fragment key={o?.id ?? o?.key ?? i67}><button onMouseDown={v.tbKeep} onClick={o.onPick} style={st.menuItem} className="hv3"><span style={st.menuMark}>{o.mark}</span><span style={css("flex:1;font-weight:700")}>{o.label}</span><span style={st.caption}>{o.sub}</span></button></React.Fragment>))}<div style={css("height:1px;background:var(--line2);margin:4px 0")}></div><div style={st.menuHeading}>{v.T.kenarUp}</div><div style={css("display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:4px 9px 8px")}><label style={st.toolFieldLabel}>{v.T.ust}<input name="mgT" type="number" min="0" max="60" step="0.1" onChange={v.onMargin} defaultValue={v.tplDraft.margins.t} style={st.toolField} /></label><label style={st.toolFieldLabel}>{v.T.sag}<input name="mgR" type="number" min="0" max="60" step="0.1" onChange={v.onMargin} defaultValue={v.tplDraft.margins.r} style={st.toolField} /></label><label style={st.toolFieldLabel}>{v.T.alt}<input name="mgB" type="number" min="0" max="60" step="0.1" onChange={v.onMargin} defaultValue={v.tplDraft.margins.b} style={st.toolField} /></label><label style={st.toolFieldLabel}>{v.T.sol}<input name="mgL" type="number" min="0" max="60" step="0.1" onChange={v.onMargin} defaultValue={v.tplDraft.margins.l} style={st.toolField} /></label></div></div></>) : null}</div><div data-rb="1" style={css("position:relative;display:flex")}><button onMouseDown={v.tbKeep} onClick={v.mnOr} style={css(v.rbBB)} className="hv2">{v.ri.orient}<span>{v.T.rbYonlendirme} ▾</span></button>{v.mOr ? (<><div style={st.dropdown}>{(v.orOpts || []).map((o: any, i68: number) => (<React.Fragment key={o?.id ?? o?.key ?? i68}><button onMouseDown={v.tbKeep} onClick={o.onPick} style={st.menuItem} className="hv3"><span style={st.menuMark}>{o.mark}</span><span style={css("flex:1")}>{o.label}</span></button></React.Fragment>))}</div></>) : null}</div><div data-rb="1" style={css("position:relative;display:flex")}><button onMouseDown={v.tbKeep} onClick={v.mnSz} style={css(v.rbBB)} className="hv2">{v.ri.size}<span>{v.T.boyut} ▾</span></button>{v.mSz ? (<><div style={css("position:absolute;top:calc(100% + 4px);left:0;z-index:40;background:var(--card);border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.16);padding:6px;max-width:calc(100vw - 28px);display:flex;flex-direction:column;gap:2px;min-width:200px;min-width:230px")}>{(v.szOpts || []).map((o: any, i69: number) => (<React.Fragment key={o?.id ?? o?.key ?? i69}><button onMouseDown={v.tbKeep} onClick={o.onPick} style={st.menuItem} className="hv3"><span style={st.menuMark}>{o.mark}</span><span style={css("flex:1;font-weight:700")}>{o.label}</span><span style={st.caption}>{o.sub}</span></button></React.Fragment>))}</div></>) : null}</div></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbSayfaYapisi}</div></>) : null}</div>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInRow)}><div data-rb="1" style={css("position:relative;display:flex")}><button onMouseDown={v.tbKeep} onClick={v.mnPn} style={css(v.rbBB)} className="hv2">{v.ri.pageno}<span>{v.T.rbSayfaNo} ▾</span></button>{v.mPn ? (<><div style={st.dropdown}><div style={css("padding:6px;display:flex;flex-direction:column;gap:8px;width:250px;white-space:normal")}><button onClick={v.togglePageNo} style={css("display:flex;align-items:center;gap:10px;height:38px;padding:0 10px;border:1px solid var(--line);background:var(--soft);border-radius:9px;cursor:pointer;text-align:left")}><span style={css("flex:1;font-size:12.5px;font-weight:700;color:var(--ink)")}>{v.T.sayfaNoGoster}</span><span style={css(v.pnTrackStyle)}><span style={css(v.pnKnobStyle)}></span></span></button>{v.tplPageNo ? (<><div style={css("display:flex;gap:5px;flex-wrap:wrap")}>{(v.pnPos || []).map((o: any, i72: number) => (<React.Fragment key={o?.id ?? o?.key ?? i72}><button onClick={o.onPick} style={css(o.style)}>{o.label}</button></React.Fragment>))}</div></>) : null}<div style={css("font-size:11px;color:var(--muted);font-weight:600;line-height:1.55")}>{v.T.ustAltNot}</div></div></div></>) : null}</div></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbUstAlt}</div></>) : null}</div>
</div></>) : null}
{v.rbTD ? (<><div style={st.toolRow}>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInCol)}>{(v.tsOpts || []).map((o: any, i73: number) => (<React.Fragment key={o?.id ?? o?.key ?? i73}><button onMouseDown={v.tbKeep} onClick={o.onToggle} style={css("display:flex;align-items:center;gap:7px;height:22px;padding:0 4px;border:none;background:transparent;cursor:pointer;font-size:12px;font-weight:600;color:var(--ink)")}><span style={css(o.boxStyle)}>{o.mark}</span>{o.label}</button></React.Fragment>))}</div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbStilSecenek}</div></>) : null}</div>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInRow)}><div data-rb="1" style={css("position:relative;display:flex")}><button onMouseDown={v.tbKeep} onClick={v.rbShApply} style={css("display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;min-width:58px;height:64px;padding:6px 7px 4px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--ink);cursor:pointer;font-size:11px;font-weight:700;line-height:1.15;text-align:center;flex:none;border-radius:7px 0 0 7px;padding-right:3px")} className="hv2">{v.ri.shade}<span style={css(v.shBarStyle)}>{v.T.rbGolge}</span></button><button onMouseDown={v.tbKeep} onClick={v.mnSh} aria-label={v.T.rbHucreGolgesiUp} style={css("display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;min-width:58px;height:64px;padding:6px 7px 4px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--ink);cursor:pointer;font-size:11px;font-weight:700;line-height:1.15;text-align:center;flex:none;min-width:16px;padding:0 2px;justify-content:center;border-radius:0 7px 7px 0")} className="hv2"><span style={st.toolNote}>▾</span></button>{v.mSh ? (<><div style={st.dropdownFit}><div style={st.menuHeading}>{v.T.rbHucreGolgesiUp}</div><div style={css("display:grid;grid-template-columns:repeat(6,22px);gap:5px;padding:4px 9px 6px")}>{(v.shColors || []).map((c: any, i74: number) => (<React.Fragment key={c?.id ?? c?.key ?? i74}><button onMouseDown={v.tbKeep} onClick={c.onPick} title={c.hex} style={css(c.style)}></button></React.Fragment>))}</div><button onMouseDown={v.tbKeep} onClick={v.rbShNone} style={st.menuItem} className="hv3">{v.T.rbRenkYok}</button></div></>) : null}</div></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbGolge}</div></>) : null}</div>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInCol)}><div style={st.toolGroup}><div data-rb="1" style={css("position:relative;display:flex")}><button onMouseDown={v.tbKeep} onClick={v.mnBm} style={css("height:28px;padding:0 8px;border:1px solid var(--line);background:var(--card);border-radius:6px;font-size:12px;font-weight:700;color:var(--ink);cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;flex:none")}>{v.ri.borders}{v.T.rbKenarlik}<span style={st.toolNote}>▾</span></button>{v.mBm ? (<><div style={st.dropdown}>{(v.bmOpts || []).map((o: any, i75: number) => (<React.Fragment key={o?.id ?? o?.key ?? i75}><button onMouseDown={v.tbKeep} onClick={o.onPick} style={st.menuItem} className="hv3"><span style={st.menuMark}>{o.mark}</span><span style={css("flex:1")}>{o.label}</span></button></React.Fragment>))}</div></>) : null}</div><select onChange={v.onBw} value={v.fmtBw} title={v.T.rbKalinlik} style={css("height:28px;border:1px solid var(--line);background:var(--card);border-radius:6px;padding:0 6px;font-size:12px;font-weight:600;color:var(--ink);width:74px;margin-left:4px")}>{(v.bwOpts || []).map((o: any, i76: number) => (<React.Fragment key={o?.id ?? o?.key ?? i76}><option value={o.v}>{o.label}</option></React.Fragment>))}</select></div><div style={st.toolGroup}><div data-rb="1" style={css("position:relative;display:flex")}><button onMouseDown={v.tbKeep} onClick={v.mnBc} style={css("height:28px;padding:0 8px;border:1px solid var(--line);background:var(--card);border-radius:6px;font-size:12px;font-weight:700;color:var(--ink);cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;flex:none")}><span style={css(v.bcBarStyle)}>✎</span>{v.T.rbKenarlikRengi}<span style={st.toolNote}>▾</span></button>{v.mBc ? (<><div style={st.dropdownFit}><div style={st.menuHeading}>{v.T.rbKenarlikRengiUp}</div><div style={css("display:grid;grid-template-columns:repeat(8,22px);gap:5px;padding:4px 9px 6px")}>{(v.bcColors || []).map((c: any, i77: number) => (<React.Fragment key={c?.id ?? c?.key ?? i77}><button onMouseDown={v.tbKeep} onClick={c.onPick} title={c.hex} style={css(c.style)}></button></React.Fragment>))}</div></div></>) : null}</div></div></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbKenarlik}</div></>) : null}</div>
</div></>) : null}
{v.rbTL ? (<><div style={st.toolRow}>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInRow)}><div style={css("display:grid;grid-template-columns:auto auto;gap:3px 4px")}><button onMouseDown={v.tbKeep} onClick={v.tbRowA} style={st.toolMenuButton} className="hv2">{v.ri.rowA}{v.T.rbYukariEkle}</button><button onMouseDown={v.tbKeep} onClick={v.tbColL} style={st.toolMenuButton} className="hv2">{v.ri.colL}{v.T.rbSolaEkle}</button><button onMouseDown={v.tbKeep} onClick={v.tbRowAdd} style={st.toolMenuButton} className="hv2">{v.ri.rowB}{v.T.rbAsagiEkle}</button><button onMouseDown={v.tbKeep} onClick={v.tbColAdd} style={st.toolMenuButton} className="hv2">{v.ri.colR}{v.T.rbSagaEkle}</button></div></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbSatirSutun}</div></>) : null}</div>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInRow)}><div data-rb="1" style={css("position:relative;display:flex")}><button onMouseDown={v.tbKeep} onClick={v.mnDel} style={css(v.rbBB)} className="hv2">{v.ri.del}<span>{v.T.sil} ▾</span></button>{v.mDel ? (<><div style={st.dropdown}><button onMouseDown={v.tbKeep} onClick={v.tbRowDelC} style={st.menuItem} className="hv3">{v.T.rbSatiriSil}</button><button onMouseDown={v.tbKeep} onClick={v.tbColDelC} style={st.menuItem} className="hv3">{v.T.rbSutunuSil}</button><button onMouseDown={v.tbKeep} onClick={v.tbTblDelC} style={css("display:flex;align-items:center;gap:9px;width:100%;min-height:32px;padding:5px 9px;border:none;border-radius:7px;background:transparent;color:var(--ink);font-size:12px;font-weight:600;cursor:pointer;text-align:left;white-space:nowrap;color:var(--errtext)")} className="hv3">{v.T.tabloyuSil}</button></div></>) : null}</div></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.sil}</div></>) : null}</div>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInRow)}><button onMouseDown={v.tbKeep} onClick={v.tbMerge} style={css(v.rbBB)} className="hv2">{v.ri.merge}<span>{v.T.rbHucreBirlestir}</span></button><button onMouseDown={v.tbKeep} onClick={v.tbSplit} style={css(v.rbBB)} className="hv2">{v.ri.split}<span>{v.T.rbHucreBol}</span></button></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbBirlestir}</div></>) : null}</div>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInCol)}><button onMouseDown={v.tbKeep} onClick={v.tbDist} style={st.toolMenuButton} className="hv2">{v.ri.dist}{v.T.rbEsitDagit}</button><div data-rb="1" style={css("position:relative;display:flex")}><button onMouseDown={v.tbKeep} onClick={v.mnTw} style={st.toolMenuButton} className="hv2">{v.ri.width}{v.T.rbTabloGenisligi}<span style={st.toolNote}>▾</span></button>{v.mTw ? (<><div style={st.dropdown}>{(v.twOpts || []).map((o: any, i78: number) => (<React.Fragment key={o?.id ?? o?.key ?? i78}><button onMouseDown={v.tbKeep} onClick={o.onPick} style={st.menuItem} className="hv3"><span style={st.menuMark}>{o.mark}</span><span style={css("flex:1")}>{o.label}</span></button></React.Fragment>))}</div></>) : null}</div><div data-rb="1" style={css("position:relative;display:flex")}><button onMouseDown={v.tbKeep} onClick={v.mnPad} style={st.toolMenuButton} className="hv2">{v.ri.pad}{v.T.rbHucreBoslugu}<span style={st.toolNote}>▾</span></button>{v.mPad ? (<><div style={st.dropdown}>{(v.padOpts || []).map((o: any, i79: number) => (<React.Fragment key={o?.id ?? o?.key ?? i79}><button onMouseDown={v.tbKeep} onClick={o.onPick} style={st.menuItem} className="hv3"><span style={st.menuMark}>{o.mark}</span><span style={css("flex:1")}>{o.label}</span></button></React.Fragment>))}</div></>) : null}</div></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbHucreBoyutu}</div></>) : null}</div>
<div style={css(v.rbGrpStyle)} title={v.T.rbSurukleIpucu}>
<div style={css(v.rbInCol)}><div style={css("display:flex;align-items:center;gap:3px")}><span title={v.T.rbSutunGen} style={css("display:flex;align-items:center;gap:4px;min-width:58px;font-size:11.5px;font-weight:600;color:var(--muted);white-space:nowrap")}>{v.ri.colw}{v.T.rbSutunKisa}</span><button onMouseDown={v.tbKeep} onClick={v.tbColNar} title={v.T.rbDaralt} style={css(v.stepBtn)} className="hv2">−</button><span style={css("min-width:50px;text-align:center;font-size:12px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap")}>{v.fmtColW}</span><button onMouseDown={v.tbKeep} onClick={v.tbColWid} title={v.T.rbGenislet} style={css(v.stepBtn)} className="hv2">+</button></div><div style={css("display:flex;align-items:center;gap:3px")}><span title={v.T.rbSatirYuk} style={css("display:flex;align-items:center;gap:4px;min-width:58px;font-size:11.5px;font-weight:600;color:var(--muted);white-space:nowrap")}>{v.ri.rowh}{v.T.rbSatirKisa}</span><button onMouseDown={v.tbKeep} onClick={v.tbRowDec} title={v.T.rbAzalt} style={css(v.stepBtn)} className="hv2">−</button><span style={css("min-width:50px;text-align:center;font-size:12px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap")}>{v.fmtRowH}</span><button onMouseDown={v.tbKeep} onClick={v.tbRowInc} title={v.T.rbArtir} style={css(v.stepBtn)} className="hv2">+</button><button onMouseDown={v.tbKeep} onClick={v.tbRowAuto} title={v.T.rbOtoYuk} style={css(v.stepBtn)} className="hv2">↺</button></div></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbBoyut}</div></>) : null}</div>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInCol)}><div style={st.toolGroup}><button onMouseDown={v.tbKeep} onClick={v.tbVaT} title={v.T.rbUsteHizala} style={css(v.stVaT)}>{v.ri.vt}</button><button onMouseDown={v.tbKeep} onClick={v.tbVaM} title={v.T.rbOrtayaHizala} style={css(v.stVaM)}>{v.ri.vm}</button><button onMouseDown={v.tbKeep} onClick={v.tbVaB} title={v.T.rbAltaHizala} style={css(v.stVaB)}>{v.ri.vb}</button></div><div style={st.toolGroup}><button onMouseDown={v.tbKeep} onClick={v.tbAL} title={v.T.rbSola} style={css(v.stAL)}>{v.tbI.al}</button><button onMouseDown={v.tbKeep} onClick={v.tbAC} title={v.T.rbOrtala} style={css(v.stAC)}>{v.tbI.ac}</button><button onMouseDown={v.tbKeep} onClick={v.tbAR} title={v.T.rbSaga} style={css(v.stAR)}>{v.tbI.ar}</button></div></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbHizalama}</div></>) : null}</div>
</div></>) : null}
{v.rbImg ? (<><div style={st.toolRow}>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInRow)}>{(v.imgWidths || []).map((w: any, i80: number) => (<React.Fragment key={w?.id ?? w?.key ?? i80}><button onMouseDown={v.tbKeep} onClick={w.onPick} style={css("height:28px;min-width:28px;padding:0 5px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--ink);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;flex:none;font-size:12px;font-weight:700;white-space:nowrap;border:1px solid var(--line);background:var(--card);padding:0 9px")} className="hv2">{w.label}</button></React.Fragment>))}</div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.boyut}</div></>) : null}</div>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInRow)}>{(v.imgAligns || []).map((w: any, i81: number) => (<React.Fragment key={w?.id ?? w?.key ?? i81}><button onMouseDown={v.tbKeep} onClick={w.onPick} style={css("height:28px;min-width:28px;padding:0 5px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--ink);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;flex:none;font-size:12px;font-weight:700;white-space:nowrap;border:1px solid var(--line);background:var(--card);padding:0 9px")} className="hv2">{w.label}</button></React.Fragment>))}</div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbKonum}</div></>) : null}</div>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInRow)}>{(v.imgBorders || []).map((w: any, i82: number) => (<React.Fragment key={w?.id ?? w?.key ?? i82}><button onMouseDown={v.tbKeep} onClick={w.onPick} style={css("height:28px;min-width:28px;padding:0 5px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--ink);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;flex:none;font-size:12px;font-weight:700;white-space:nowrap;border:1px solid var(--line);background:var(--card);padding:0 9px")} className="hv2">{w.label}</button></React.Fragment>))}</div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.rbKenarlik}</div></>) : null}</div>
<div style={css(v.rbGrpStyle)}>
<div style={css(v.rbInRow)}><button onMouseDown={v.tbKeep} onClick={v.tbImgDel} style={css(v.rbBB)} className="hv2">{v.ri.del}<span>{v.T.gorselSil}</span></button></div>
{v.rbDesk ? (<><div style={st.toolGroupLabel}>{v.T.sil}</div></>) : null}</div>
</div></>) : null}
                    </div>
                  </div>
                  <div data-zarea="1" style={css("overflow-x:auto;padding:24px 16px;background:var(--soft3)")}>
                  {v.tplIsEdit ? (<>
                    <div ref={v.zWrapTpl}>
                    <div style={css(v.paperEditStyle)}>
                      <div style={css("position:relative;border-bottom:1px dashed #c9cbd6;padding-bottom:6px;margin-bottom:12px")}>
                        <span style={css("position:absolute;top:-17px;left:0;font-family:var(--sans);font-size:8.5px;font-weight:800;letter-spacing:.6px;color:#9a9cab")}>{v.T.ustBilgiUp}</span>
                        <div ref={v.zHeader} style={css("outline:none;min-height:24px")}></div>
                      </div>
                      <div ref={v.zBody} style={css("flex:1;outline:none;min-height:320px")}></div>
                      <div style={css("position:relative;border-top:1px dashed #c9cbd6;padding-top:6px;margin-top:12px")}>
                        <div ref={v.zFooter} style={css("outline:none;min-height:24px")}></div>
                        {v.tplPageNo ? (<>
                          <div style={css(v.pageNoMockStyle)}>{v.pageNoMock}</div>
                        </>) : null}
                        <span style={css("position:absolute;bottom:-17px;left:0;font-family:var(--sans);font-size:8.5px;font-weight:800;letter-spacing:.6px;color:#9a9cab")}>{v.T.altBilgiUp}</span>
                      </div>
                    </div>
                    </div>
                  </>) : null}
                  {v.tplIsPreview ? (<>
                    <div ref={v.tplPrevRef}></div>
                  </>) : null}
                  </div>
                  <div data-edbar="1" style={css(v.edBarStyle)}>
                    <span style={css("flex:1;min-width:120px;font-size:12px;font-weight:700;color:var(--muted)")}>{v.tplPaperLabel}</span>
                    <div style={css("display:flex;align-items:center;gap:4px")}>
                      <button onClick={v.zOutTpl} aria-label="zoom out" style={css("width:28px;height:28px;border:1px solid var(--line);background:var(--card);border-radius:7px;font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center")}>−</button>
                      <span style={css("min-width:48px;text-align:center;font-size:13px;font-weight:800")}>{v.zLblTpl}</span>
                      <button onClick={v.zInTpl} aria-label="zoom in" style={css("width:28px;height:28px;border:1px solid var(--line);background:var(--card);border-radius:7px;font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center")}>+</button>
                      <button onClick={v.zFitTpl} style={css(v.zFitTplStyle)}>{v.T.sigdir}</button>
                      <button onClick={v.z100Tpl} aria-label="%100" style={css("height:28px;padding:0 9px;border:1px solid var(--line);background:var(--card);border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap")}>%100</button>
                    </div>
                  </div>
                </div>
              </div>
            </>) : null}
          </div>
        </>
  );
}
