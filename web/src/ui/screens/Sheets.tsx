import { st } from "../styles";
import React from "react";
import { css } from "../css";
import type { Vals } from "../../vm/types";

export function Sheets({ v }: { v: Vals }) {
  return (
    <>
    <div style={css("position:fixed;inset:0;background:rgba(16,16,24,.45);z-index:60;display:flex;align-items:center;justify-content:center;padding:18px;overflow-y:auto")}>
      <div ref={v.dialogRef} role="dialog" aria-modal="true" aria-label={v.sheetTitle} tabIndex={-1} onKeyDown={v.dialogKeys} style={css("outline:none;width:100%;max-width:520px;background:var(--card);border-radius:18px;display:flex;flex-direction:column;max-height:92vh;animation:sheetIn .22s ease;box-shadow:0 20px 50px rgba(0,0,0,.3)")}>
        <div style={css("flex:none;padding:15px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line2)")}>
          <div style={css("flex:1;font-size:16px;font-weight:800")}>{v.sheetTitle}</div>
          <button onClick={v.closeSheet} aria-label={v.T.kapat} style={css("width:30px;height:30px;border-radius:50%;border:1px solid var(--line);background:var(--soft);color:var(--muted);font-size:14px;font-weight:700;cursor:pointer")}>✕</button>
        </div>
        <div style={css("flex:1;overflow-y:auto;padding:16px 18px 20px;display:flex;flex-direction:column;gap:12px")}>

          {v.sheetIsProject || v.sheetIsPeople ? (<>
            <div style={st.stack11}>
              {v.sheetIsProject ? (<>
              <input name="prName" onChange={v.onField} defaultValue={v.draft.name} placeholder={v.T.insaatAdi} style={st.field} />
              <select name="prContractor" onChange={v.onField} defaultValue={v.draft.contractorId} style={st.fieldButton}>
                <option value="">{v.T.muteahhitSec}</option>
                {(v.contractorOptions || []).map((c: any, i89: number) => (<React.Fragment key={c?.id ?? c?.key ?? i89}>
                  <option value={c.id}>{c.title}</option>
                </React.Fragment>))}
              </select>
              <input name="prMahalle" onChange={v.onField} defaultValue={v.draft.mahalle} placeholder={v.T.mahalle} style={st.field} />
              <input name="prStreet" onChange={v.onField} defaultValue={v.draft.street} placeholder={v.T.caddeSokakVeKapi} style={st.field} />
              <div style={st.rowWrap10}>
                <input name="prAda" onChange={v.onField} defaultValue={v.draft.ada} placeholder={v.T.adaNo} style={st.fieldGrow} />
                <input name="prParsel" onChange={v.onField} defaultValue={v.draft.parsel} placeholder={v.T.parselNo} style={st.fieldGrow} />
                <input name="prPafta" onChange={v.onField} defaultValue={v.draft.pafta} placeholder={v.T.paftaNo} style={st.fieldGrow} />
              </div>
              <select name="prStatus" onChange={v.onField} defaultValue={v.draft.status} style={st.fieldButton}>
                <option value="">{v.T.projeDurumuSec}</option>
                {(v.statusOptions || []).map((o: any, i90: number) => (<React.Fragment key={o?.id ?? o?.key ?? i90}>
                  <option value={o.id}>{o.label}</option>
                </React.Fragment>))}
              </select>
              <textarea name="prNote" onChange={v.onField} defaultValue={v.draft.note} rows={3} placeholder={v.T.ekstraNotIstegeBagli} style={css("border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:10px 11px;font-size:14px;font-weight:500;resize:none;line-height:1.5")}></textarea>
              <div style={st.hintLine}>{v.T.notAlaniDisindakiTum}</div>
              </>) : null}
              <div style={css(v.sheetIsProject ? "border-top:1px solid var(--line2);padding-top:11px;display:flex;flex-direction:column;gap:8px" : "display:flex;flex-direction:column;gap:8px")}>
                <div style={css("display:flex;align-items:center;gap:8px")}>
                  <div style={css("flex:1;font-size:11px;font-weight:800;letter-spacing:.5px;color:var(--muted)")}>{v.T.arsaSahipleriUp}</div>
                  {v.shareTotal.show ? <span role="status" style={css(v.shareTotal.style)}>{v.shareTotal.text}</span> : null}
                </div>
                {(v.draftOwners || []).map((o: any, i91: number) => (<React.Fragment key={o?.id ?? o?.key ?? i91}>
                  <div style={css("display:flex;align-items:center;gap:9px;background:var(--soft2);border-radius:9px;padding:8px 10px")}>
                    <div style={css("flex:1;min-width:0")}>
                      <div style={st.title13}>{o.name}</div>
                      <div style={css("font-size:11px;color:var(--muted);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{o.meta}</div>
                    </div>
                    <input value={o.share} onChange={o.onShare} aria-label={o.shareLabel} placeholder="1/2" inputMode="numeric" style={css("width:84px;flex:none;height:32px;border:1px solid " + (o.shareOk ? "var(--line)" : "var(--errline)") + ";background:var(--card);border-radius:7px;padding:0 8px;font-size:13px;font-weight:700;text-align:center;color:var(--ink)")} />
                    <button onClick={o.onRemove} aria-label={v.T.sil} style={css("width:30px;height:30px;flex:none;border:1px solid var(--errline);background:var(--err);color:var(--errtext);border-radius:7px;font-size:12px;font-weight:700;cursor:pointer")}>✕</button>
                  </div>
                </React.Fragment>))}
                <div style={css("display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px")}>
                  <input name="owName" ref={v.refOwName} onChange={v.onField} placeholder={v.T.adSoyadUnvan} style={css("grid-column:1 / -1;min-width:0;height:40px;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:0 11px;font-size:13px;font-weight:600")} />
                  <input name="owTc" ref={v.refOwTc} onChange={v.onField} placeholder={v.T.tcVergiNo} style={st.fieldCompact} />
                  <input name="owPhone" ref={v.refOwPhone} onChange={v.onField} placeholder={v.T.telefonPh} style={st.fieldCompact} />
                  <input name="owShare" ref={v.refOwShare} onChange={v.onField} placeholder={v.T.hissePh} style={st.fieldCompact} />
                  <input name="owAddr" ref={v.refOwAddr} onChange={v.onField} placeholder={v.T.adresPh} style={st.fieldCompact} />
                </div>
                <button onClick={v.addDraftOwner} style={css("height:40px;border:1px dashed var(--pri,#2a3180);background:var(--tint);border-radius:9px;color:var(--brandink);font-size:13px;font-weight:700;cursor:pointer")}>{v.T.arsaSahibiEkle}</button>
              </div>
              <div style={css("border-top:1px solid var(--line2);padding-top:11px;display:flex;flex-direction:column;gap:8px")}>
                <div style={st.overline}>{v.T.vekilUp}</div>
                <div style={css("display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px")}>
                  <input name="prxName" onChange={v.onField} defaultValue={v.draftProxy.name} placeholder={v.T.vekilAdi} style={css("grid-column:1 / -1;min-width:0;height:40px;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:0 11px;font-size:13px;font-weight:600")} />
                  <input name="prxTc" onChange={v.onField} defaultValue={v.draftProxy.tc} placeholder={v.T.tcVergiNo} style={st.fieldCompact} />
                  <input name="prxPhone" onChange={v.onField} defaultValue={v.draftProxy.phone} placeholder={v.T.telefonPh} style={st.fieldCompact} />
                  <input name="prxAddr" onChange={v.onField} defaultValue={v.draftProxy.address} placeholder={v.T.adresPh} style={css("grid-column:1 / -1;min-width:0;height:40px;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:0 11px;font-size:13px;font-weight:600")} />
                </div>
              </div>
              {v.needsApproval ? (<>
                <div style={css("background:var(--tint);border:1px solid var(--tintline);color:var(--brandink);border-radius:9px;padding:10px 12px;font-size:12px;font-weight:700;line-height:1.55")}>{v.T.rolunuzDogrudanDuzenlemeyeKapali}</div>
              </>) : null}
              <button onClick={v.saveProject} style={st.primary}>{v.saveLabel}</button>
            </div>
          </>) : null}

          {v.sheetIsAuthor ? (<>
            <div style={st.stack11}>
              <input name="auTc" onChange={v.onField} defaultValue={v.draft.tc} placeholder={v.T.tcKimlikNumarasi} style={st.field} />
              <div style={st.rowWrap10}>
                <input name="auFirst" onChange={v.onField} defaultValue={v.draft.first} placeholder={v.T.isim} style={st.fieldGrow} />
                <input name="auLast" onChange={v.onField} defaultValue={v.draft.last} placeholder={v.T.soyisim} style={st.fieldGrow} />
              </div>
              <input name="auPhone" onChange={v.onField} defaultValue={v.draft.phone} placeholder={v.T.telefon2} style={st.field} />
              <input name="auCompany" onChange={v.onField} defaultValue={v.draft.company} placeholder={v.T.sirket} style={st.field} />
              <input name="auSicil" onChange={v.onField} defaultValue={v.draft.sicil} placeholder={v.T.odaSicilNo} style={st.field} />
              <input name="auAddress" onChange={v.onField} defaultValue={v.draft.address} placeholder={v.T.adresPh} style={st.field} />
              <select name="auJob" onChange={v.onField} defaultValue={v.draft.job} style={st.fieldButton}>
                <option value="">{v.T.meslekSec}</option>
                {(v.professionOptions || []).map((p: any, i92: number) => (<React.Fragment key={p?.id ?? p?.key ?? i92}>
                  <option value={p.name}>{p.name}</option>
                </React.Fragment>))}
              </select>
              {v.needsApproval ? (<>
                <div style={css("background:var(--tint);border:1px solid var(--tintline);color:var(--brandink);border-radius:9px;padding:10px 12px;font-size:12px;font-weight:700")}>{v.T.kayitUstKademeOnayina}</div>
              </>) : null}
              <button onClick={v.saveAuthor} style={st.primary}>{v.saveLabel}</button>
            </div>
          </>) : null}

          {v.sheetIsContractor ? (<>
            <div style={st.stack11}>
              <input name="coTitle" onChange={v.onField} defaultValue={v.draft.title} placeholder={v.T.firmaUnvani} style={st.field} />
              <input name="coOwner" onChange={v.onField} defaultValue={v.draft.owner} placeholder={v.T.yetkiliIsimSoyisim} style={st.field} />
              <div style={st.rowWrap10}>
                <input name="coLicence" onChange={v.onField} defaultValue={v.draft.licence} placeholder={v.T.yetkiBelgeNo} style={css("flex:1;min-width:130px;height:40px;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:0 11px;font-size:14px;font-weight:600")} />
                <input name="coRank" onChange={v.onField} defaultValue={v.draft.rank} placeholder={v.T.sinifiBC} style={css("flex:1;min-width:110px;height:40px;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:0 11px;font-size:14px;font-weight:600")} />
              </div>
              <input name="coAddress" onChange={v.onField} defaultValue={v.draft.address} placeholder={v.T.adres} style={st.field} />
              <button onClick={v.saveContractor} style={st.primary}>{v.saveLabel}</button>
            </div>
          </>) : null}

          {v.sheetIsDoc ? (<>
            <div style={css("display:flex;flex-direction:column;gap:12px")}>
              <div style={css("background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px 16px")}>
                <div style={css("display:flex;align-items:center;gap:10px;border-bottom:2px solid var(--pri,#2a3180);padding-bottom:10px")}>
                  {v.hasLogo ? (<>
                    <img src={v.logoUrl} alt="Logo" style={css("width:32px;height:32px;border-radius:8px;object-fit:cover;flex:none")} />
                  </>) : null}
                  {v.noLogo ? (<>
                    <div style={css("width:32px;height:32px;border-radius:8px;background:var(--pri,#2a3180);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex:none")}>{v.companyMonogram}</div>
                  </>) : null}
                  <div style={css("flex:1")}>
                    <div style={st.title14}>{v.companyName}</div>
                    <div style={css("font-size:11px;color:var(--muted);font-weight:700")}>{v.docKindLabel}</div>
                  </div>
                  <div style={css("font-size:11px;color:var(--muted);font-weight:700;text-align:right")}>{v.docNo}<br />{v.todayLabel}</div>
                </div>
                {(v.docRows || []).map((r: any, i93: number) => (<React.Fragment key={r?.id ?? r?.key ?? i93}>
                  <div style={css("display:flex;gap:10px;padding:8px 0;border-bottom:1px dotted var(--line)")}>
                    <div style={css("width:130px;flex:none;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.3px")}>{r.k}</div>
                    <div style={css("flex:1;font-size:13px;font-weight:600")}>{r.v}</div>
                  </div>
                </React.Fragment>))}
                <div style={css("display:flex;justify-content:flex-end;margin-top:24px")}>
                  <div style={css("text-align:center;font-size:11px;color:var(--muted);font-weight:700;border-top:1px solid var(--ink);padding-top:5px;width:140px")}>{v.T.kaseImza}</div>
                </div>
              </div>
              <button onClick={v.printDoc} style={st.primary}>{v.T.belgeyiYazdirPdf}</button>
            </div>
          </>) : null}

          {v.sheetIsTplLeave ? (<>
            <div style={st.stack14}>
              <div style={css("font-size:14px;color:var(--muted);font-weight:600;line-height:1.6")}>{v.T.kaydedilmemisDegisiklik}</div>
              <div style={st.rowWrap8}>
                <button onClick={v.closeSheet} aria-label={v.T.kapat} style={css("flex:1;min-width:110px;height:44px;border:1px solid var(--line);background:var(--soft);border-radius:10px;font-size:14px;font-weight:700;cursor:pointer")}>{v.T.vazgec}</button>
                <button onClick={v.tplLeaveDiscard} style={css("flex:1;min-width:130px;height:44px;border:1px solid var(--errline);background:var(--err);color:var(--errtext);border-radius:10px;font-size:14px;font-weight:700;cursor:pointer")}>{v.T.kaydetmedenCik}</button>
                <button onClick={v.tplLeaveSave} style={css("flex:1;min-width:130px;height:44px;border:none;background:var(--pri,#2a3180);color:#fff;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer")}>{v.T.kaydetVeCik}</button>
              </div>
            </div>
          </>) : null}

          {v.sheetIsConfirm ? (<>
            <div style={st.stack14}>
              <div style={css("font-size:14px;color:var(--muted);font-weight:600;line-height:1.6")}>{v.confirmText}</div>
              <div style={css("display:flex;gap:10px")}>
                <button onClick={v.closeSheet} aria-label={v.T.kapat} style={css("flex:1;height:44px;border:1px solid var(--line);background:var(--soft);border-radius:10px;font-size:14px;font-weight:700;cursor:pointer")}>{v.T.vazgec}</button>
                <button onClick={v.confirmAction} style={css("flex:1;height:44px;border:none;background:#B3261E;color:#fff;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer")}>{v.confirmCta}</button>
              </div>
            </div>
          </>) : null}

          {v.sheetIsNotice ? <div style={css("font-size:13px;line-height:1.65;font-weight:500;white-space:pre-wrap")}>{v.noticeText}</div> : null}

          {v.sheetIsMail ? (<>
            <div style={css("display:flex;flex-direction:column;gap:12px")}>
              <div style={st.noteParagraph}>{v.T.baglantiNot}</div>
              <div style={st.hintBold}>{v.T.kime} {v.mailTo}</div>
              <div style={css("font-family:var(--mono);font-size:12px;background:var(--soft3);border-radius:9px;padding:10px 12px;word-break:break-all;user-select:all")}>{v.mailLink}</div>
              <button onClick={v.copyLink} style={css("align-self:flex-start;height:40px;padding:0 14px;border:none;border-radius:9px;background:var(--pri,#2a3180);color:#fff;font-size:13px;font-weight:700;cursor:pointer")}>{v.T.kopyala}</button>
            </div>
          </>) : null}

          {v.sheetIsMenu ? (<>
            <div style={css("display:flex;flex-direction:column;gap:7px")}>
              {(v.menuItems || []).map((n: any, i94: number) => (<React.Fragment key={n?.id ?? n?.key ?? i94}>
                <button onClick={n.onClick} style={css(n.sideStyle)}>
                  {n.icon}
                  <span>{n.label}</span>
                  {n.hasBadge ? (<>
                    <span style={css(n.badgeStyle)}>{n.badgeText}</span>
                  </>) : null}
                </button>
              </React.Fragment>))}
              <div style={css("display:flex;flex-direction:column;gap:9px;border-top:1px solid var(--line2);padding-top:11px;margin-top:4px")}>
                <div style={css("display:flex;align-items:center;gap:10px;height:44px;padding:0 11px;background:var(--soft);border:1px solid var(--line);border-radius:10px")}>
                  <span style={css("flex:1;font-size:13px;font-weight:700;color:var(--ink)")}>{v.T.karanlikMod2}</span>
                  <button onClick={v.toggleTheme} aria-label={v.T.karanlikMod2} style={css(v.themeIconBtnStyle)}>{v.themeIcon}</button>
                </div>
                <div style={css("display:flex;align-items:center;gap:10px;height:44px;padding:0 11px;background:var(--soft);border:1px solid var(--line);border-radius:10px")}>
                  <span style={css("flex:1;font-size:13px;font-weight:700;color:var(--ink)")}>{v.T.dil}</span>
                  <button onClick={v.toggleLang} aria-label={v.T.dil} style={css(v.langBtnStyle)}>{v.langLabel}</button>
                </div>
                <button onClick={v.logout} style={css("height:44px;border:1px solid var(--errline);background:var(--err);border-radius:10px;font-size:13px;font-weight:800;color:var(--errtext);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px")}>{v.logoutIcon}{v.T.cikis}</button>
                <div style={css("display:flex;align-items:center;justify-content:center;gap:6px;padding:2px 0")}>
                  <span style={css("font-size:11px;font-weight:500;color:var(--faint)")}>powered by</span>
                  {v.brandMarkXs}
                  <span style={css("font-size:13px;font-weight:700;letter-spacing:-.3px;line-height:1;color:var(--logo-a)")}>dos<span style={css("color:var(--logo-b)")}>yapı</span></span>
                </div>
              </div>
            </div>
          </>) : null}
        </div>
      </div>
    </div>
  </>
  );
}
