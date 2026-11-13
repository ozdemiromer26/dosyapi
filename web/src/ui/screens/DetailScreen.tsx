import { st } from "../styles";
import React from "react";
import { css } from "../css";
import { NoteBox } from "../parts";
import type { Vals } from "../../vm/types";
import { LOC } from "../../i18n";

const BTN = "height:40px;padding:0 15px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:9px;font-size:13px;font-weight:700;cursor:pointer";
const SMALL = "height:32px;padding:0 12px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer";
const CARD = "background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px";
const HEAD = "display:flex;align-items:center;gap:8px";
const TITLE = "flex:1;min-width:0;margin:0;font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
/** Alan adı: küçük, silik, büyük harf. Değer: okunaklı, orta kalınlıkta. */
const LABEL = "display:block;font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.5px;margin-bottom:4px";
const VALUE = "margin:0;font-size:14px;font-weight:600;line-height:1.5;color:var(--ink);overflow-wrap:anywhere";
const SUB = "margin:2px 0 0;font-size:12px;font-weight:500;line-height:1.45;color:var(--muted);overflow-wrap:anywhere";
/** Satırlar arasındaki silik ayırıcı. */
const RULE = "border-top:1px solid var(--line2)";

/** Proje bilgileri: fotoğraf, iş durumu ve yetkisi olanın yerinde düzenleyebildiği alanlar. */
function InfoCard({ v }: { v: Vals }) {
  const i = v.info;
  const label = (text: string, target?: string) => <label htmlFor={target} style={css(LABEL)}>{text}</label>;
  const input = (name: string, value: string) => <input id={name} name={name} onChange={v.onField} defaultValue={value} style={css("width:100%;height:40px;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:0 11px;font-size:14px;font-weight:600;color:var(--ink)")} />;
  return (
    <section aria-label={v.T.projeBilgileri} style={css(CARD + ";" + i.gridStyle)}>
      <div style={css("grid-column:1 / -1;" + HEAD)}>
        <h2 style={css(TITLE)}>{v.T.projeBilgileri}</h2>
        {i.editing ? (
          <select id="inStatus" name="inStatus" aria-label={v.T.isDurumu} onChange={v.onField} defaultValue={i.form.status} style={css("height:32px;border:1px solid var(--line);background:var(--soft);border-radius:8px;padding:0 8px;font-size:12px;font-weight:700;color:var(--ink);cursor:pointer")}>
            {(i.statusOptions || []).map((o: any) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        ) : <span title={v.T.isDurumu} style={css(i.badgeStyle)}>{i.statusLabel}</span>}
        {i.canEdit ? <button onClick={i.onEdit} style={css(SMALL)}>{v.T.duzenle}</button> : null}
      </div>
      {i.lockedNote ? <NoteBox tone="warn" extra="grid-column:1 / -1">{i.lockedNote}</NoteBox> : null}

      <div style={st.stack11}>
        <div style={css(i.photoBoxStyle)}>
          {i.photoUrl
            ? <img src={i.photoUrl} alt={v.T.projeFotografi} style={css("width:100%;height:100%;object-fit:cover;display:block")} />
            : <div style={css("display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--faint);font-size:12px;font-weight:700")}>
                <span aria-hidden="true">{v.cameraIc}</span>{v.T.fotografYok}
              </div>}
          {i.photoBusy ? <div style={css("position:absolute;inset:0;background:rgba(0,0,0,.35);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700")}>{v.T.yukleniyor}</div> : null}
        </div>
        {i.canPhoto ? (
          <div style={css("display:flex;gap:6px")}>
            <label style={css(SMALL + ";flex:1;display:flex;align-items:center;justify-content:center")}>
              {i.photoAddLabel}
              <input type="file" accept="image/*" onChange={i.onPhoto} style={css("display:none")} />
            </label>
            {i.photoUrl ? <button onClick={i.onPhotoRemove} style={css(SMALL + ";color:var(--errtext)")}>{v.T.kaldir}</button> : null}
          </div>
        ) : null}
      </div>

      <div style={css("min-width:0")}>
        {i.editing ? (<>
          <div style={css(i.formGridStyle)}>
            <div style={css(i.spanAll)}>{label(v.T.insaatAdi, "inName")}{input("inName", i.form.name)}</div>
            <div style={css(i.spanAll)}>
              {label(v.T.muteahhit, "inContractor")}
              <select id="inContractor" name="inContractor" onChange={i.onContractor} defaultValue={i.form.contractorId} style={css("width:100%;height:40px;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:0 10px;font-size:14px;font-weight:600;color:var(--ink)")}>
                {(i.contractorOptions || []).map((o: any) => <option key={o.id} value={o.id}>{o.title}</option>)}
                {i.canAddContractor ? <><option disabled value="">──────────</option><option value="__add__">{v.T.muteahhitEkleArti}</option></> : null}
              </select>
            </div>
            <div style={css(i.spanHalf)}>{label(v.T.mahalle, "inMahalle")}{input("inMahalle", i.form.mahalle)}</div>
            <div style={css(i.spanHalf)}>{label(v.T.caddeSokakVeKapi, "inStreet")}{input("inStreet", i.form.street)}</div>
            <div style={css(i.spanThird)}>{label(v.T.paftaNo, "inPafta")}{input("inPafta", i.form.pafta)}</div>
            <div style={css(i.spanThird)}>{label(v.T.adaNo, "inAda")}{input("inAda", i.form.ada)}</div>
            <div style={css(i.spanThird)}>{label(v.T.parselNo, "inParsel")}{input("inParsel", i.form.parsel)}</div>
            <div style={css(i.spanAll)}>
              {label(v.T.notlar, "inNote")}
              <textarea id="inNote" name="inNote" onChange={v.onField} defaultValue={i.form.note} rows={3} style={css("width:100%;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:10px 11px;font-size:14px;font-weight:500;resize:vertical;line-height:1.5;color:var(--ink)")}></textarea>
            </div>
          </div>
          {i.approvalNote ? <NoteBox tone="info" extra="margin-top:12px">{i.approvalNote}</NoteBox> : null}
          <div style={css("margin-top:14px;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap")}>
            <button onClick={i.onCancel} style={css(BTN)}>{v.T.vazgec}</button>
            <button onClick={i.onSave} style={css("height:40px;padding:0 18px;border:none;background:var(--pri,#2a3180);color:#fff;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer")}>{i.saveLabel}</button>
          </div>
        </>) : (
          <dl style={css("margin:0")}>
            <div style={css("padding:0 0 12px")}>
              <dt style={css(LABEL)}>{v.T.adresUp}</dt>
              <dd style={css(VALUE)}>{i.address}</dd>
            </div>
            <div style={css(RULE + ";padding:12px 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr))")}>
              {(i.plot || []).map((p: any, n: number) => (
                <div key={p.key} style={css(n === 0 ? "min-width:0;padding-right:14px" : "min-width:0;padding:0 14px;border-left:1px solid var(--line2)")}>
                  <dt style={css(LABEL)}>{p.label}</dt>
                  <dd style={css(VALUE)}>{p.value}</dd>
                </div>
              ))}
            </div>
            <div style={css(RULE + ";padding-top:12px")}>
              <dt style={css(LABEL)}>{v.T.notlarUp}</dt>
              <dd style={css(VALUE + ";white-space:pre-wrap;font-weight:500;color:" + (i.noNote ? "var(--faint)" : "var(--ink)"))}>{i.noNote ? "—" : i.note}</dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  );
}

/** Arsa sahipleri ve vekil: proje bilgisinden ayrı, kendi düzenleme penceresiyle. */
function PeopleCard({ v }: { v: Vals }) {
  const p = v.people;
  return (
    <section aria-label={v.T.arsaSahipleriVekiller} style={css(CARD + ";display:flex;flex-direction:column;gap:14px")}>
      <div style={css(HEAD)}>
        <h2 style={css(TITLE)}>{v.T.arsaSahipleriVekiller}</h2>
        {p.showTotal && p.wide ? <span role="status" style={css(p.totalStyle)}>{p.totalText}</span> : null}
        {p.canEdit ? <button onClick={p.onEdit} style={css(SMALL)}>{v.T.duzenle}</button> : null}
      </div>
      {p.showTotal && !p.wide ? <div style={css("display:flex;margin-top:-4px")}><span role="status" style={css(p.totalStyle)}>{p.totalText}</span></div> : null}
      <div style={css(p.bodyStyle)}>
        <div style={css("min-width:0")}>
          <div style={css(LABEL + ";margin-bottom:2px")}>{v.T.arsaSahipleriUp}</div>
          {p.noOwners ? <p style={css(SUB + ";margin-top:6px")}>{v.T.arsaSahibiGirilmemis}</p> : null}
          {(p.owners || []).map((o: any) => (
            <div key={o.id} style={css((o.first ? "" : RULE + ";") + "display:flex;align-items:flex-start;gap:12px;padding:10px 0")}>
              <div style={css("flex:1;min-width:0")}>
                <p style={css(VALUE)}>{o.name}</p>
                {o.meta ? <p style={css(SUB)}>{o.meta}</p> : null}
                {o.address ? <p style={css(SUB)}>{o.address}</p> : null}
              </div>
              <span title={v.T.hisse} style={css("flex:none;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;padding:3px 9px;border-radius:7px;background:var(--soft2);color:var(--ink)")}>{o.share}</span>
            </div>
          ))}
        </div>
        <div style={css(p.proxyColStyle)}>
          <div style={css(LABEL + ";margin-bottom:2px")}>{v.T.vekilUp}</div>
          {p.hasProxy ? (
            <div style={css("padding:10px 0")}>
              <p style={css(VALUE)}>{p.proxy.name}</p>
              {p.proxy.meta ? <p style={css(SUB)}>{p.proxy.meta}</p> : null}
              {p.proxy.address ? <p style={css(SUB)}>{p.proxy.address}</p> : null}
            </div>
          ) : <p style={css(SUB + ";margin-top:6px")}>{v.T.vekilYok}</p>}
        </div>
      </div>
    </section>
  );
}

type NoteState = "idle" | "saving" | "saved" | "error";

/** Kişisel taslak not. Yazarken ~0,8 sn duraklamada ve odak çıkınca kendiliğinden kaydeder;
 *  proje değişir ya da ekran kapanırsa bekleyen değişiklik yine gönderilir. */
function NotesCard({ v }: { v: Vals }) {
  const n = v.personalNote;
  const T = v.T;
  const [text, setText] = React.useState("");
  const [ready, setReady] = React.useState(false);
  const [state, setState] = React.useState<NoteState>("idle");
  const [savedAt, setSavedAt] = React.useState(0);
  const area = React.useRef<HTMLTextAreaElement>(null);
  const saver = React.useRef(n ? n.save : null);
  saver.current = n ? n.save : null;
  const dirty = React.useRef<string | null>(null);
  const timer = React.useRef<number | undefined>(undefined);

  const flush = React.useCallback(() => {
    window.clearTimeout(timer.current);
    const body = dirty.current;
    const save = saver.current;
    if (body === null || !save) return;
    dirty.current = null;
    setState("saving");
    save(body).then(
      (r: any) => { if (dirty.current === null) { setState("saved"); setSavedAt(r && r.updatedAt || 0); } },
      () => { if (dirty.current === null) dirty.current = body; setState("error"); },
    );
  }, []);

  const key = n ? n.key : "";
  React.useEffect(() => {
    if (!n) return;
    let live = true;
    setReady(false); setText(""); setState("idle"); setSavedAt(0);
    n.load().then(
      (r: any) => { if (live) { setText(r.body || ""); setSavedAt(r.updatedAt || 0); setReady(true); } },
      () => { if (live) { setState("error"); setReady(true); } },
    );
    return () => { live = false; flush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  React.useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(132, el.scrollHeight + 2) + "px";
  }, [text, ready]);

  if (!n) return null;
  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const body = e.target.value;
    setText(body);
    dirty.current = body;
    setState("idle");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 800);
  };
  const time = savedAt ? new Date(savedAt * 1000).toLocaleTimeString(LOC(), { hour: "2-digit", minute: "2-digit" }) : "";
  const status =
    state === "saving" ? T.kaydediliyor :
    state === "error" ? T.kaydedilemedi :
    state === "saved" || savedAt ? T.kaydedildi + (time ? " · " + time : "") : "";
  return (
    <section aria-labelledby="pn-title" style={css(CARD + ";display:flex;flex-direction:column;gap:10px")}>
      <div style={css(HEAD)}>
        <span style={css("color:var(--muted);display:flex")}>{n.lockIc}</span>
        <h2 id="pn-title" style={css(TITLE + ";font-size:14px")}>{T.kisiselNotlarim}</h2>
        <span role="status" style={css("flex:none;font-size:12px;font-weight:700;color:" + (state === "error" ? "var(--errtext)" : "var(--muted)"))}>{status}</span>
      </div>
      <div style={css("font-size:12px;font-weight:600;color:var(--muted);margin-top:-6px")}>{T.yalnizcaSizGorursunuz}</div>
      <textarea
        ref={area}
        value={text}
        onChange={onChange}
        onBlur={flush}
        disabled={!ready}
        maxLength={20000}
        aria-labelledby="pn-title"
        placeholder={ready ? T.kisiselNotYer : T.yukleniyor}
        style={css("width:100%;min-height:132px;resize:vertical;border:1px solid var(--line);border-radius:10px;padding:11px 12px;font:inherit;font-size:14px;font-weight:500;line-height:1.55;color:var(--ink);background:var(--warn);box-sizing:border-box;overflow:hidden")}
      />
    </section>
  );
}

export function DetailScreen({ v }: { v: Vals }) {
  return (
    <>
          <div style={css("display:flex;flex-direction:column;gap:15px")}>
            <button onClick={v.goProjects} style={css("align-self:flex-start;border:none;background:none;color:var(--brandink);font-size:13px;font-weight:700;cursor:pointer;padding:0")}>{v.T.projeler3}</button>
            <div style={css("display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap")}>
              <div style={css("flex:1;min-width:200px")}>
                <h1 style={css("margin:0;font-size:21px;font-weight:800;letter-spacing:-.3px")}>{v.detail.name}</h1>
                <div style={css("font-size:13px;color:var(--muted);font-weight:600;margin-top:3px")}>{v.detail.contractor} {v.T.ada} {v.detail.ada} {v.T.parsel3} {v.detail.parsel}</div>
              </div>
              <div style={css("display:flex;gap:8px;flex-wrap:wrap")}>
                <button onClick={v.printBoard} style={css(BTN)}>{v.T.santiyePanosu}</button>
                <button onClick={v.detail.onDoc} style={css("height:40px;padding:0 15px;border:none;background:var(--pri,#2a3180);color:#fff;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer")}>{v.T.belgeOlustur}</button>
              </div>
            </div>

            <InfoCard v={v} />
            <PeopleCard v={v} />

            {v.hasDetailPendings ? (<>
                <div style={css("background:var(--card);border:1px solid var(--warntext);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:11px")}>
                  <div style={css("display:flex;align-items:center;gap:8px")}>
                    <div style={css("flex:1;font-size:14px;font-weight:800")}>{v.T.onayBekleyenDuzenlemeler}</div>
                    <span style={css("font-size:11px;font-weight:800;padding:4px 8px;border-radius:999px;background:var(--warn);color:var(--warntext)")}>{v.detailPendingCount}</span>
                  </div>
                  {(v.detailPendings || []).map((q: any, i32: number) => (<React.Fragment key={q?.id ?? q?.key ?? i32}>
                    <div style={css("background:var(--soft2);border-radius:10px;padding:11px;display:flex;flex-direction:column;gap:5px")}>
                      <div style={st.rowCenter8}>
                        <span style={css(q.kindStyle)}>{q.kindLabel}</span>
                        <span style={st.caption}>{q.when}</span>
                      </div>
                      <div style={css("font-size:13px;font-weight:700")}>{q.title}</div>
                      <div style={st.hint}>{q.detail} {v.T.talepEden} {q.by}</div>
                      {q.canDecide ? (<>
                        <div style={css("display:flex;gap:7px;margin-top:3px")}>
                          <button onClick={q.onApprove} style={css("flex:1;height:36px;border:none;border-radius:8px;background:var(--pri,#2a3180);color:#fff;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.onayla}</button>
                          <button onClick={q.onReject} style={css("flex:1;height:36px;border:1px solid var(--errline);background:var(--err);color:var(--errtext);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.reddet}</button>
                        </div>
                      </>) : null}
                    </div>
                  </React.Fragment>))}
                </div>
              </>) : null}

            <div style={css("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:14px;align-items:start")}>
              <div style={css("display:flex;flex-direction:column;gap:14px;min-width:0")}>
              <div style={st.cardLoose}>
                <div style={css("display:flex;align-items:center;gap:8px")}>
                  <div style={css("flex:1;min-width:0;font-size:14px;font-weight:800")}>{v.T.projeMuellifleri}</div>
                  <span style={css(v.authorStatusStyle)}>{v.authorStatus}</span>
                </div>
                <div style={css("display:flex;flex-direction:column;gap:8px")}>
                  {(v.detailAuthorSlots || []).map((a: any, i33: number) => (<React.Fragment key={a?.id ?? a?.key ?? i33}>
                    <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px")}>
                      <div style={css("flex:0 0 150px;font-size:13px;font-weight:700;color:var(--ink)")}>{a.prof} <span style={css("color:var(--errtext)")}>*</span></div>
                      {a.hasOpts ? (<>
                        <select onChange={a.onPick} value={a.value} style={css(a.selStyle)}>
                          <option value="">{v.T.muellifSecin}</option>
                          {(a.opts || []).map((o: any, i34: number) => (<React.Fragment key={o?.id ?? o?.key ?? i34}>
                            <option value={o.id}>{o.label}</option>
                          </React.Fragment>))}
                          {a.canAdd ? <><option disabled value="">──────────</option><option value="__add__">{v.T.muellifEkleArti}</option></> : null}
                        </select>
                      </>) : null}
                      {a.noOpts ? (<>
                        <div style={css("flex:1 1 220px;min-width:0;display:flex;align-items:center;gap:8px;height:38px;padding:0 6px 0 11px;border:1px dashed var(--errline);border-radius:9px;background:var(--err)")}>
                          <span style={css("flex:1;min-width:0;font-size:12px;font-weight:700;color:var(--errtext);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{v.T.buMeslekteMuellifYok}</span>
                          <button onClick={a.onAdd} style={css("flex:none;height:28px;padding:0 10px;border:none;border-radius:7px;background:var(--pri,#2a3180);color:#fff;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.muellifEkleKisa}</button>
                        </div>
                      </>) : null}
                    </div>
                  </React.Fragment>))}
                </div>
                {v.hasAuthorMissDetail ? (<>
                  <NoteBox tone="err" extra="font-size:12px;padding:9px 11px;line-height:1.45">{v.authorMissDetail}</NoteBox>
                </>) : null}
                <div style={st.hintLine}>{v.T.seciliMuelliflerYapiDenetim}</div>
              </div>
              <NotesCard v={v} />
              </div>

              <div style={st.cardLoose}>
                <div style={css("display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap")}>
                  <div style={css("flex:1;min-width:150px")}>
                    <div style={st.title14}>{v.T.zorunluAmpSecmeliBelgeler}</div>
                    <div style={css("font-size:12px;color:var(--muted);font-weight:600;margin-top:2px;line-height:1.45")}>{v.docSummary}</div>
                  </div>
                  <div style={css("display:flex;gap:4px;flex:none")}>
                    <button onClick={v.docExpandAll} style={css("height:28px;padding:0 9px;border:1px solid var(--line);background:var(--card);border-radius:7px;font-size:12px;font-weight:700;color:var(--muted);cursor:pointer")}>{v.T.tumunuAc}</button>
                    <button onClick={v.docCollapseAll} style={css("height:28px;padding:0 9px;border:1px solid var(--line);background:var(--card);border-radius:7px;font-size:12px;font-weight:700;color:var(--muted);cursor:pointer")}>{v.T.tumunuKapat}</button>
                  </div>
                </div>
                <div style={css("height:6px;border-radius:999px;background:var(--soft3);overflow:hidden")}><div style={css(v.docProgStyle)}></div></div>
                <div style={st.stack6}>
                  {(v.docGroups || []).map((g: any, i29: number) => (<React.Fragment key={g?.id ?? g?.key ?? i29}>
                    <div style={css("display:flex;flex-direction:column")}>
                      <button onClick={g.onToggle} aria-expanded={g.open} style={css("display:flex;align-items:center;gap:8px;width:100%;padding:7px 6px;border:none;background:transparent;border-radius:8px;cursor:pointer;text-align:left;color:var(--ink)")} className="hv0">
                        <span style={css("width:12px;flex:none;font-size:12px;color:var(--muted)")}>{g.caret}</span>
                        <span style={css(g.iconStyle)}>{v.docFolderIc}</span>
                        <span style={css("flex:1;min-width:0;font-size:13px;font-weight:800")}>{g.label}</span>
                        <span style={css(g.countStyle)}>{g.count}</span>
                      </button>
                      {g.open ? (<>
                        <div style={css("margin-left:12px;padding:2px 0 4px 13px;border-left:1px solid var(--line);display:flex;flex-direction:column;gap:6px")}>
                          <div style={css("font-size:11px;color:var(--muted);font-weight:600;line-height:1.4;padding:0 2px")}>{g.hint}</div>
                          {(g.nodes || []).map((d: any, i30: number) => (<React.Fragment key={d?.id ?? d?.key ?? i30}>
                            <div style={css("border:1px solid var(--line2);border-radius:10px;background:var(--soft)")}>
                              <div style={css("display:flex;align-items:center;gap:8px;padding:9px 10px;flex-wrap:wrap")}>
                                <button onClick={d.onToggle} aria-expanded={d.open} style={css("display:flex;align-items:center;gap:8px;flex:1;min-width:160px;border:none;background:transparent;padding:0;cursor:pointer;text-align:left;color:var(--ink)")}>
                                  <span style={css("width:12px;flex:none;font-size:12px;color:var(--muted)")}>{d.caret}</span>
                                  <span style={css(d.iconStyle)}>{v.docFileIc}</span>
                                  <span style={css("flex:1;min-width:0")}>
                                    <span style={css("display:block;font-size:13px;font-weight:800")}>{d.name}</span>
                                    <span style={css("display:block;font-size:11px;color:var(--muted);font-weight:600;margin-top:1px")}>{d.desc}</span>
                                  </span>
                                </button>
                                <span style={css(d.statusStyle)}>{d.statusLabel}</span>
                              </div>
                              {d.open ? (<>
                                <div style={css("margin:0 10px 10px 16px;padding-left:12px;border-left:1px dashed var(--line);display:flex;flex-direction:column;gap:5px")}>
                                  {(d.files || []).map((f: any, i31: number) => (<React.Fragment key={f?.id ?? f?.key ?? i31}>
                                    <div style={css("display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--line2);border-radius:8px;padding:6px 6px 6px 8px;min-width:0")}>
                                      <span style={css("flex:none;min-width:34px;height:22px;padding:0 4px;border-radius:5px;background:var(--tint);color:var(--brandink);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center")}>{f.ext}</span>
                                      <div style={css("flex:1;min-width:0")}>
                                        <div style={css("font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{f.name}</div>
                                        <div style={st.caption}>{f.meta}</div>
                                      </div>
                                      {f.canPreview ? <button onClick={f.onPreview} aria-label={v.T.onizle} title={v.T.onizle} style={css("flex:none;width:30px;height:28px;padding:0;border:1px solid var(--line);background:var(--card);border-radius:7px;color:var(--brandink);cursor:pointer;display:flex;align-items:center;justify-content:center")}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg></button> : null}
                                      <button onClick={f.onDownload} style={css("flex:none;height:28px;padding:0 9px;border:1px solid var(--line);background:var(--card);border-radius:7px;font-size:12px;font-weight:700;color:var(--ink);cursor:pointer")}>{v.T.indir}</button>
                                      {f.canDelete ? (<>
                                        <button onClick={f.onDelete} title={f.delTitle} style={css("flex:none;width:28px;height:28px;padding:0;border:1px solid var(--errline);background:var(--err);border-radius:7px;font-size:14px;font-weight:700;color:var(--errtext);cursor:pointer")}>×</button>
                                      </>) : null}
                                    </div>
                                  </React.Fragment>))}
                                  {d.noFiles ? (<>
                                    <div style={css(d.emptyStyle)}>{d.emptyLabel}</div>
                                  </>) : null}
                                  {d.pendingLabel ? (<>
                                    <div style={css("background:var(--warn);color:var(--warntext);border-radius:8px;padding:6px 9px;font-size:11px;font-weight:800")}>{d.pendingLabel}</div>
                                  </>) : null}
                                  {d.canUpload ? (<>
                                    <label style={css("height:32px;border:1px dashed var(--line);border-radius:8px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;font-weight:700;color:var(--brandink);cursor:pointer;background:var(--card)")}>
                                      + {d.uploadLabel}
                                      <input onChange={d.onUpload} type="file" accept={d.acceptAttr} multiple={d.multi} style={css("display:none")} />
                                    </label>
                                  </>) : null}
                                </div>
                              </>) : null}
                            </div>
                          </React.Fragment>))}
                        </div>
                      </>) : null}
                    </div>
                  </React.Fragment>))}
                </div>
                {v.docsNeedApproval ? (<>
                  <NoteBox tone="info" extra="font-size:12px;padding:9px 11px">{v.T.rolunuzOnayliDuzenlemeYuklediginiz}</NoteBox>
                </>) : null}
              </div>


            </div>

          </div>
        </>
  );
}
