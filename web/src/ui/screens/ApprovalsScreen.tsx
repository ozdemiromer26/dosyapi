import { st } from "../styles";
import { css } from "../css";
import type { Vals } from "../../vm/types";

/** Onaylar: "Alınan" (karar verilecekler) ve "Gönderilen" (benim taleplerim) sekmeleri, kart / liste. */

const ELL = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
const CARD = "height:100%;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px;display:flex;flex-direction:column;gap:9px";
const GRID = "display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:13px;align-items:stretch";
const LISTBOX = "display:grid;column-gap:16px;background:var(--card);border:1px solid var(--line);border-radius:13px;overflow:hidden";
const HEAD = "display:grid;grid-template-columns:subgrid;grid-column:1 / -1;align-items:center;padding:10px 16px;background:var(--soft2);border-bottom:1px solid var(--line2);font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.4px";
const ROW = "display:grid;grid-template-columns:subgrid;grid-column:1 / -1;align-items:center;row-gap:8px;padding:12px 16px;border-bottom:1px solid var(--line2)";

function DecideButtons({ q, v, h = 40, fs = 13 }: { q: any; v: Vals; h?: number; fs?: number }) {
  return (
    <div style={st.row8}>
      <button onClick={q.onApprove} style={css(`flex:1;height:${h}px;padding:0 12px;border:none;border-radius:9px;background:var(--pri,#2a3180);color:#fff;font-size:${fs}px;font-weight:700;cursor:pointer`)}>{v.T.onayla}</button>
      <button onClick={q.onReject} style={css(`flex:1;height:${h}px;padding:0 12px;border:1px solid var(--errline);background:var(--err);color:var(--errtext);border-radius:9px;font-size:${fs}px;font-weight:700;cursor:pointer`)}>{v.T.reddet}</button>
    </div>
  );
}

function RolePick({ q, v, h = 40 }: { q: any; v: Vals; h?: number }) {
  return (
    <select onChange={q.onRolePick} aria-label={v.T.atanacakRolEnFazla} style={{ ...st.fieldButton, height: h }}>
      {(v.assignableRoles || []).map((r: any) => <option key={r.id} value={r.id}>{v.T.k}{r.level} · {r.name}</option>)}
    </select>
  );
}

function WaitBox({ q }: { q: any }) {
  return <div style={css("background:var(--soft3);border-radius:8px;padding:8px 10px;font-size:12px;font-weight:700;color:var(--muted)")}>{q.waitLabel}</div>;
}

function SentFoot({ q, v }: { q: any; v: Vals }) {
  return (
    <div style={css("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
      <span style={css(q.stateStyle)}>{q.stateLabel}</span>
      {q.onWithdraw ? (
        <button onClick={q.onWithdraw} style={css("margin-left:auto;height:32px;padding:0 11px;border:1px solid var(--line);background:var(--card);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.talebiGeriCek}</button>
      ) : <span style={st.caption}>{q.who}</span>}
    </div>
  );
}

export function ApprovalsScreen({ v }: { v: Vals }) {
  const T = v.T, inbox: any[] = v.pendings || [], sent: any[] = v.sentList || [], narrow = !!v.apNarrow;
  return (
    <div style={st.stack14}>
      <div style={css("display:flex;gap:10px;align-items:center;flex-wrap:wrap")}>
        <div role="tablist" style={css("display:flex;background:var(--soft3);border-radius:10px;padding:4px;gap:4px;flex:none")}>
          {(v.apTabs || []).map((t: any) => (
            <button key={t.id} role="tab" aria-selected={t.on} onClick={t.onClick} style={css(t.style)}>
              {t.label}<span style={css(t.badgeStyle)}>{t.count}</span>
            </button>
          ))}
        </div>
        <div style={css("flex:1")} />
        <div style={css("display:flex;gap:6px;flex:none")}>
          <button onClick={v.apSetCard} aria-pressed={v.apIsCard} style={css(v.apCardStyle)}>{T.kart}</button>
          <button onClick={v.apSetList} aria-pressed={v.apIsList} style={css(v.apListStyle)}>{T.liste}</button>
        </div>
      </div>
      <div style={st.noteParagraph}>{v.approvalsIntro}</div>

      {v.apIn ? (<>
        {v.noPendings ? <div style={css("text-align:center;padding:36px 12px;color:var(--muted);font-size:14px;font-weight:600")}>{T.bekleyenTalepYok}</div> : null}

        {!v.noPendings && v.apIsCard ? (
          <div style={css(GRID)}>
            {inbox.map((q) => (
              <div key={q.id} style={css(CARD)}>
                <div style={st.rowCenter8}><span style={css(q.kindStyle)}>{q.kindLabel}</span><span style={st.hint}>{q.when}</span></div>
                <div style={css("font-size:16px;font-weight:800")}>{q.title}</div>
                <div style={st.noteParagraph}>{q.detail}</div>
                <div style={st.hintBold}>{T.talepEden2} {q.by}</div>
                {q.needsRole ? <div style={st.stack5}><span style={st.hintBold}>{T.atanacakRolEnFazla}</span><RolePick q={q} v={v} /></div> : null}
                <div style={css("margin-top:auto;padding-top:4px")}>{q.canDecide ? <DecideButtons q={q} v={v} /> : <WaitBox q={q} />}</div>
              </div>
            ))}
          </div>
        ) : null}

        {!v.noPendings && v.apIsList && narrow ? (
          <div style={css("background:var(--card);border:1px solid var(--line);border-radius:13px;overflow:hidden")}>
            {inbox.map((q) => (
              <div key={q.id} style={css("display:flex;flex-direction:column;gap:6px;padding:12px 14px;border-bottom:1px solid var(--line2)")}>
                <div style={st.rowCenter8}><span style={css(q.kindStyle)}>{q.kindLabel}</span><span style={st.caption}>{q.when} · {q.by}</span></div>
                <div style={st.rowTitle}>{q.title}</div>
                <div style={css("font-size:12px;color:var(--muted);font-weight:600;" + ELL)}>{q.detail}</div>
                {q.needsRole ? <RolePick q={q} v={v} h={34} /> : null}
                {q.canDecide ? <DecideButtons q={q} v={v} h={34} fs={12} /> : <WaitBox q={q} />}
              </div>
            ))}
          </div>
        ) : null}

        {!v.noPendings && v.apIsList && !narrow ? (
          <div role="table" style={css(LISTBOX + ";grid-template-columns:120px minmax(0,1.1fr) minmax(0,2fr) minmax(0,.9fr) 100px 230px")}>
            <div role="row" style={css(HEAD)}><span>{T.turUp}</span><span>{T.kayitUp}</span><span>{T.degisiklikUp}</span><span>{T.talepEdenUp}</span><span>{T.zamanUp}</span><span /></div>
            {inbox.map((q) => (
              <div role="row" key={q.id} style={css(ROW)}>
                <div><span style={css(q.kindStyle)}>{q.kindLabel}</span></div>
                <div style={st.rowTitle}>{q.title}</div>
                <div style={css("font-size:13px;font-weight:600;color:var(--muted);line-height:1.45")}>
                  {q.detail}
                  {q.needsRole ? <div style={css("margin-top:6px")}><RolePick q={q} v={v} h={32} /></div> : null}
                </div>
                <div style={css("font-size:13px;font-weight:700")}>{q.by}</div>
                <div style={st.hint}>{q.when}</div>
                <div>{q.canDecide ? <DecideButtons q={q} v={v} h={32} fs={12} /> : <WaitBox q={q} />}</div>
              </div>
            ))}
          </div>
        ) : null}

        {v.hasHistory ? <div style={css("font-size:14px;font-weight:800;margin-top:6px")}>{T.gecmis}</div> : null}
        {(v.history || []).map((h: any, i: number) => (
          <div key={h.id ?? i} style={css("display:flex;align-items:center;gap:10px;background:var(--soft2);border-radius:9px;padding:9px 12px")}>
            <span style={css(h.dotStyle)}></span>
            <div style={css("flex:1;font-size:12px;color:var(--muted);font-weight:600")}>{h.text}</div>
            <span style={st.caption}>{h.when}</span>
          </div>
        ))}
      </>) : null}

      {v.apOut ? (<>
        {v.noSent ? <div style={css("text-align:center;padding:36px 12px;color:var(--muted);font-size:14px;font-weight:600")}>{T.gonderilenTalepYok}</div> : null}

        {!v.noSent && v.apIsCard ? (
          <div style={css(GRID)}>
            {sent.map((q) => (
              <div key={q.id} style={css(CARD)}>
                <div style={st.rowCenter8}><span style={css(q.kindStyle)}>{q.kindLabel}</span><span style={st.hint}>{q.when}</span></div>
                <div style={css("font-size:16px;font-weight:800")}>{q.title}</div>
                <div style={st.noteParagraph}>{q.detail}</div>
                <div style={css("margin-top:auto;padding-top:4px")}><SentFoot q={q} v={v} /></div>
              </div>
            ))}
          </div>
        ) : null}

        {!v.noSent && v.apIsList && narrow ? (
          <div style={css("background:var(--card);border:1px solid var(--line);border-radius:13px;overflow:hidden")}>
            {sent.map((q) => (
              <div key={q.id} style={css("display:flex;flex-direction:column;gap:6px;padding:12px 14px;border-bottom:1px solid var(--line2)")}>
                <div style={st.rowCenter8}><span style={css(q.kindStyle)}>{q.kindLabel}</span><span style={st.caption}>{q.when}</span><span style={css("margin-left:auto")}><span style={css(q.stateStyle)}>{q.stateLabel}</span></span></div>
                <div style={st.rowTitle}>{q.title}</div>
                <div style={css("font-size:12px;color:var(--muted);font-weight:600;" + ELL)}>{q.detail}</div>
                {q.onWithdraw ? <button onClick={q.onWithdraw} style={css("align-self:flex-start;height:32px;padding:0 11px;border:1px solid var(--line);background:var(--card);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{T.talebiGeriCek}</button> : <span style={st.caption}>{q.who}</span>}
              </div>
            ))}
          </div>
        ) : null}

        {!v.noSent && v.apIsList && !narrow ? (
          <div role="table" style={css(LISTBOX + ";grid-template-columns:120px minmax(0,1fr) minmax(0,1.6fr) 100px minmax(270px,1.4fr)")}>
            <div role="row" style={css(HEAD)}><span>{T.turUp}</span><span>{T.kayitUp}</span><span>{T.degisiklikUp}</span><span>{T.gonderildiUp}</span><span>{T.durumUp}</span></div>
            {sent.map((q) => (
              <div role="row" key={q.id} style={css(ROW)}>
                <div><span style={css(q.kindStyle)}>{q.kindLabel}</span></div>
                <div style={st.rowTitle}>{q.title}</div>
                <div style={css("font-size:13px;font-weight:600;color:var(--muted);line-height:1.45")}>{q.detail}</div>
                <div style={st.hint}>{q.when}</div>
                <SentFoot q={q} v={v} />
              </div>
            ))}
          </div>
        ) : null}
      </>) : null}
    </div>
  );
}
