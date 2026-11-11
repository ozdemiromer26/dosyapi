import React from "react";
import { css } from "../css";
import type { Vals } from "../../vm/types";
import { AuthScreen } from "./AuthScreen";
import { SetupScreen } from "./SetupScreen";
import { MasterPanel } from "./MasterPanel";
import { AppShell } from "./AppShell";
import { Sheets } from "./Sheets";

export function Root({ v }: { v: Vals }) {
  return (
    <><div ref={v.rootRef} data-theme={v.theme} style={css(`--pri:${v.pPri};--acc:${v.pAcc};min-height:100vh;display:flex;flex-direction:column;background:var(--bg);color:var(--ink)`)}>

  {v.isLoading ? <div style={css("flex:1")} /> : null}
  {v.isSetup ? <SetupScreen v={v} /> : null}
  {v.isAuth ? <AuthScreen v={v} /> : null}

  {v.isMaster ? <MasterPanel v={v} /> : null}

  {v.isApp ? <AppShell v={v} /> : null}

  {v.sheetOpen ? <Sheets v={v} /> : null}

  {v.genOpen ? (<>
    <div style={css("position:fixed;inset:0;background:rgba(16,16,24,.5);z-index:62;display:flex;align-items:center;justify-content:center;padding:14px")}>
      <div ref={v.dialogRef} role="dialog" aria-modal="true" aria-label={v.T.belgeOlustur} tabIndex={-1} onKeyDown={v.dialogKeys} style={css("outline:none;width:100%;max-width:1180px;height:min(94vh,1000px);background:var(--card);border-radius:18px;display:flex;flex-direction:column;overflow:hidden;animation:sheetIn .22s ease;box-shadow:0 24px 60px rgba(0,0,0,.35)")}>
        <div style={css("flex:none;padding:14px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--line2)")}>
          <div style={css("flex:1;min-width:0")}>
            <div style={css("font-size:16px;font-weight:800")}>{v.T.belgeOlustur}</div>
            <div style={css("font-size:12px;color:var(--muted);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{v.genSubject}</div>
          </div>
          <button onClick={v.closeGen} aria-label={v.T.kapat} style={css("width:30px;height:30px;flex:none;border-radius:50%;border:1px solid var(--line);background:var(--soft);color:var(--muted);font-size:14px;font-weight:700;cursor:pointer")}>✕</button>
        </div>
        <div style={css(v.genBodyStyle)}>
          <div style={css(v.genSideStyle)}>
            {v.isDesktop ? (<>
              <div style={css("font-size:11px;font-weight:800;letter-spacing:.5px;color:var(--muted);padding:0 2px 4px")}>{v.T.sablonUp}</div>
            </>) : null}
            {(v.genTpls || []).map((t: any, i95: number) => (<React.Fragment key={t?.id ?? t?.key ?? i95}>
              <button onClick={t.onPick} style={css(t.style)}>{t.name}</button>
            </React.Fragment>))}
            {v.genNoTpl ? (<>
              <div style={css("display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--muted);font-weight:600;line-height:1.5")}>
                <span>{v.T.buAlanIcinSablonYok}</span>
                {v.canTpl ? (<>
                  <button onClick={v.goTemplatesFromGen} style={css("align-self:flex-start;height:36px;padding:0 12px;border:1px dashed var(--pri,#2a3180);background:var(--tint);border-radius:8px;color:var(--brandink);font-size:13px;font-weight:700;cursor:pointer")}>{v.T.sablonOlustur}</button>
                </>) : null}
              </div>
            </>) : null}
          </div>
          <div style={css("flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;background:var(--soft3)")}>
            <div style={css("flex:none;display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid var(--line2);background:var(--card);flex-wrap:wrap")}>
              <span style={css("flex:1;min-width:120px;font-size:12px;font-weight:700;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{v.genPaperLabel}</span>
              <div style={css("display:flex;align-items:center;gap:4px")}>
                <button onClick={v.zOutGen} aria-label="zoom out" style={css("width:30px;height:30px;border:1px solid var(--line);background:var(--card);border-radius:7px;font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center")}>−</button>
                <span style={css("min-width:48px;text-align:center;font-size:13px;font-weight:800")}>{v.zLblGen}</span>
                <button onClick={v.zInGen} aria-label="zoom in" style={css("width:30px;height:30px;border:1px solid var(--line);background:var(--card);border-radius:7px;font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center")}>+</button>
                <button onClick={v.zFitGen} style={css(v.zFitGenStyle)}>{v.T.sigdir}</button>
                <button onClick={v.z100Gen} aria-label="%100" style={css("height:30px;padding:0 9px;border:1px solid var(--line);background:var(--card);border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap")}>%100</button>
              </div>
            </div>
            <div data-zarea="1" style={css("flex:1;min-height:0;overflow:auto;padding:22px 16px")}>
              <div ref={v.genPaperRef}></div>
            </div>
          </div>
        </div>
        {v.genHasTpl ? (<>
          {v.isMobile ? (
            /* Mobil: tek satır, eşit sütunlar, kısa etiketler. Kaydet yoksa üç sütun. */
            <div style={css("flex:none;padding:10px 12px;border-top:1px solid var(--line2);display:flex;flex-direction:column;gap:6px")}>
              {v.genBusyLabel ? <span role="status" style={css("font-size:12px;font-weight:700;color:var(--brandink);text-align:center")}>{v.genBusyLabel}</span> : null}
              <div style={css("display:grid;gap:6px;grid-template-columns:repeat(" + (v.genCanSave ? 4 : 3) + ",minmax(0,1fr))")}>
                {v.genCanSave ? <button onClick={v.genSave} aria-label={v.T.projeyeKaydet} style={css("height:40px;padding:0 4px;border:1px dashed var(--pri,#2a3180);background:var(--tint);border-radius:9px;font-size:13px;font-weight:700;color:var(--brandink);cursor:pointer;white-space:nowrap")}>{v.T.kaydet}</button> : null}
                <button onClick={v.genWord} aria-label={v.T.wordIndir} style={css("height:40px;padding:0 4px;border:1px solid var(--line);background:var(--card);border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap")}>Word</button>
                <button onClick={v.genPrint} style={css("height:40px;padding:0 4px;border:1px solid var(--line);background:var(--card);border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap")}>{v.T.yazdir}</button>
                <button onClick={v.genPdf} aria-label={v.T.pdfIndir} style={css("height:40px;padding:0 4px;border:none;background:var(--pri,#2a3180);color:#fff;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap")}>PDF</button>
              </div>
            </div>
          ) : (
                    <div style={css("flex:none;padding:12px 18px;border-top:1px solid var(--line2);display:flex;gap:8px;align-items:center;flex-wrap:wrap")}>
              {v.genBusyLabel ? (<>
                <span style={css("font-size:13px;font-weight:700;color:var(--brandink)")}>{v.genBusyLabel}</span>
              </>) : null}
              <div style={css("flex:1")}></div>
              {v.genCanSave ? (<>
                <button onClick={v.genSave} style={css("height:40px;padding:0 14px;border:1px dashed var(--pri,#2a3180);background:var(--tint);border-radius:9px;font-size:13px;font-weight:700;color:var(--brandink);cursor:pointer;white-space:nowrap")}>{v.T.projeyeKaydet}</button>
              </>) : null}
              <button onClick={v.genWord} style={css("height:40px;padding:0 14px;border:1px solid var(--line);background:var(--card);border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap")}>{v.T.wordIndir}</button>
              <button onClick={v.genPrint} style={css("height:40px;padding:0 14px;border:1px solid var(--line);background:var(--card);border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap")}>{v.T.yazdir}</button>
              <button onClick={v.genPdf} style={css("height:40px;padding:0 16px;border:none;background:var(--pri,#2a3180);color:#fff;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap")}>{v.T.pdfIndir}</button>
            </div>
          )}
        </>) : null}
      </div>
    </div>
  </>) : null}

  {v.undoLabel ? (
    <div role="status" style={css("position:fixed;left:50%;transform:translateX(-50%);bottom:76px;z-index:81;max-width:calc(100vw - 24px);display:flex;align-items:center;gap:14px;background:var(--ink);color:var(--card);border-radius:11px;padding:8px 8px 8px 16px;font-size:13px;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.3);animation:popIn .2s ease")}>
      <span style={css("min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{v.undoLabel}</span>
      <button onClick={v.undoDelete} style={css("flex:none;height:36px;padding:0 12px;border:none;border-radius:8px;background:var(--card);color:var(--ink);font-size:13px;font-weight:800;cursor:pointer")}>{v.T.geriAl}</button>
    </div>
  ) : null}
  {v.toast ? (<>
    <div style={css("position:fixed;left:50%;transform:translateX(-50%);bottom:26px;z-index:80;pointer-events:none;max-width:420px;background:var(--ink);color:var(--card);border-radius:11px;padding:12px 16px;font-size:13px;font-weight:600;line-height:1.45;box-shadow:0 10px 30px rgba(0,0,0,.3);animation:popIn .2s ease")}>{v.toast}</div>
  </>) : null}
</div></>
  );
}
