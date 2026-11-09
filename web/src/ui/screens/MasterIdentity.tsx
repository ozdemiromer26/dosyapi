import { st } from "../styles";
import React from "react";
import { css } from "../css";
import type { Vals } from "../../vm/types";
import { Btn, Card } from "../parts";

export function MasterIdentity({ v }: { v: Vals }) {
  return (
    <>
          <div style={css("background:var(--mcard);border:1px solid var(--mline);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:13px")}>
            <div style={st.masterTitle}>{v.T.sirketKimligi}</div>
            <div style={st.masterHint}>{v.T.sirketAdiLogoVe}</div>
            <div style={css("display:flex;align-items:center;gap:12px")}>
              {v.hasLogo ? (<>
                <img src={v.logoUrl} alt="Logo" style={css("width:54px;height:54px;border-radius:13px;object-fit:cover;flex:none;background:var(--minput);border:1px solid var(--mline2)")} />
              </>) : null}
              {v.noLogo ? (<>
                <div style={css("width:54px;height:54px;border-radius:13px;background:var(--pri,#2a3180);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;flex:none")}>{v.companyMonogram}</div>
              </>) : null}
              <label style={css("flex:1;height:44px;border:1px dashed var(--mline2);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--mmuted);cursor:pointer")}>
                {v.logoLabel}
                <input onChange={v.onLogoFile} type="file" accept="image/*" style={css("display:none")} />
              </label>
            </div>
            <input name="cName" onChange={v.onField} defaultValue={v.companyName} placeholder={v.T.sirketAdi} style={css("height:44px;border:1px solid var(--mline2);background:var(--minput);border-radius:9px;padding:0 12px;font-size:14px;font-weight:600;color:var(--mink)")} />
            <textarea name="cDesc" onChange={v.onField} defaultValue={v.companyDesc} rows={2} placeholder={v.T.kisaAciklama} style={css("border:1px solid var(--mline2);background:var(--minput);border-radius:9px;padding:10px 12px;font-size:14px;font-weight:500;color:var(--mink);resize:none;line-height:1.5")}></textarea>
            <div style={css("display:flex;gap:14px;flex-wrap:wrap")}>
              <label style={css("display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;color:var(--mmuted)")}>{v.T.anaRenk}
                <input onChange={v.onPriColor} type="color" defaultValue={v.pPri} style={css("width:70px;height:36px;border:1px solid var(--mline2);background:var(--minput);border-radius:8px;padding:2px")} />
              </label>
              <label style={css("display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;color:var(--mmuted)")}>{v.T.vurguRenk}
                <input onChange={v.onAccColor} type="color" defaultValue={v.pAcc} style={css("width:70px;height:36px;border:1px solid var(--mline2);background:var(--minput);border-radius:8px;padding:2px")} />
              </label>
            </div>
            <button onClick={v.saveCompanyMaster} style={css("height:40px;border:none;border-radius:9px;background:var(--pri,#2a3180);color:#fff;font-size:14px;font-weight:700;cursor:pointer")}>{v.T.sirketBilgileriniKaydet}</button>
          </div>
          <div style={css("background:var(--mcard);border:1px solid var(--mline);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:12px")}>
            <div style={st.masterTitle}>{v.T.ePostaAlanAdlari}</div>
            <div style={st.masterHint}>{v.T.alanAdiAciklama}</div>
            <button onClick={v.toggleDomainLock} style={css("display:flex;align-items:center;gap:10px;height:44px;padding:0 12px;border:1px solid var(--mline2);background:var(--minput);border-radius:9px;cursor:pointer;text-align:left")}>
              <span style={css("flex:1;font-size:13px;font-weight:700;color:var(--mink)")}>{v.T.alanAdiKisitlamasi}</span>
              <span style={css(v.domainTrackStyle)}><span style={css(v.domainKnobStyle)}></span></span>
            </button>
            <div style={css("display:flex;gap:7px;flex-wrap:wrap")}>
              {(v.domainList || []).map((d: any, i2: number) => (<React.Fragment key={d?.id ?? d?.key ?? i2}>
                <span style={css("display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 5px 0 11px;border-radius:8px;background:var(--mchip);color:var(--mchiptext);font-size:13px;font-weight:700")}><span>@{d.name}</span>
                  <button onClick={d.onDelete} aria-label={v.T.sil} style={css("width:22px;height:22px;border:none;border-radius:6px;background:transparent;color:var(--mmuted);font-size:12px;font-weight:800;cursor:pointer")}>✕</button>
                </span>
              </React.Fragment>))}
              {v.noDomains ? (<>
                <span style={css("font-size:13px;color:var(--mmuted);font-weight:600")}>{v.T.henuzAlanAdiYok}</span>
              </>) : null}
            </div>
            <div style={st.row8}>
              <div style={css("flex:1;min-width:0;display:flex;align-items:center;height:40px;border:1px solid var(--mline2);background:var(--minput);border-radius:8px;padding-left:11px")}>
                <span style={css("font-size:14px;font-weight:700;color:var(--mmuted)")}>@</span>
                <input name="domName" ref={v.refDomName} onChange={v.onField} placeholder="abc.com" style={css("flex:1;min-width:0;height:40px;border:none;background:transparent;padding:0 10px 0 3px;font-size:13px;font-weight:600;color:var(--mink)")} />
              </div>
              <button onClick={v.addDomain} style={css("height:40px;padding:0 14px;border:none;border-radius:8px;background:var(--pri,#2a3180);color:#fff;font-size:13px;font-weight:700;cursor:pointer")}>{v.T.ekle}</button>
            </div>
            {v.hasDomainConflicts ? (<>
              <div style={css("background:var(--mwarn);border-radius:9px;padding:11px 12px;display:flex;flex-direction:column;gap:6px")}>
                <div style={css("font-size:12px;font-weight:800;color:var(--mwarntext);line-height:1.5")}>{v.domainConflictTitle}</div>
                {(v.domainConflicts || []).map((c: any, i3: number) => (<React.Fragment key={c?.id ?? c?.key ?? i3}>
                  <div style={css("display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--mwarntext)")}>
                    <span style={css("width:5px;height:5px;flex:none;border-radius:50%;background:var(--mwarntext)")}></span>
                    <span style={css("min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{c.email} · {c.name}</span>
                  </div>
                </React.Fragment>))}
              </div>
            </>) : null}
            {v.domainActiveNote ? (<>
              <div style={css("background:var(--ok);border:1px solid var(--okline);color:var(--oktext);border-radius:9px;padding:10px 12px;font-size:12px;font-weight:700;line-height:1.5")}>{v.domainActiveNote}</div>
            </>) : null}
          </div>
      <Card title={v.T.aydinlatmaBaslik} note={v.T.aydinlatmaNot}>
            <textarea name="lgNotice" key={v.noticeKey} onChange={v.onField} defaultValue={v.noticeText} rows={8} aria-label={v.T.aydinlatmaBaslik} style={css("border:1px solid var(--mline2);background:var(--minput);border-radius:9px;padding:10px 12px;font-size:13px;font-weight:500;color:var(--mink);resize:vertical;line-height:1.55")}></textarea>
            <div><Btn onClick={v.saveNotice}>{v.T.kaydet}</Btn></div>
          </Card>
    </>
  );
}
