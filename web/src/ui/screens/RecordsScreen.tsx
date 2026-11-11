import { st } from "../styles";
import { css } from "../css";
import type { Vals } from "../../vm/types";

/** Müellifler ve müteahhitler aynı düzende: sekme, süzgeç, kart/liste, seçim, seçililerle belge. */

const ELL = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
const ICON_BTN = "flex:none;width:32px;height:30px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center";
const DOC_BTN = "height:30px;padding:0 10px;border:1px solid var(--line);background:var(--card);border-radius:8px;font-size:12px;font-weight:700;color:var(--brandink);cursor:pointer";
const PENCIL = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" />
  </svg>
);

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div style={css("font-size:13px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums;" + ELL)}>
      <span style={css("color:var(--muted);font-weight:700")}>{k}:</span> {v}
    </div>
  );
}

export function RecordsScreen({ v }: { v: Vals }) {
  const T = v.T, rows: any[] = v.recRows || [], narrow = !!v.recNarrow;
  const docBtn = (
    <button onClick={v.printSelected} style={css("height:40px;padding:0 15px;border:none;border-radius:9px;background:var(--pri,#2a3180);color:#fff;font-size:13px;font-weight:700;cursor:pointer" + (narrow ? ";width:100%" : ""))}>{v.recDocLabel}</button>
  );
  return (
    <div style={st.stack14}>
      <div style={css("display:flex;gap:9px;flex-wrap:wrap;align-items:center")}>
        <div style={css("display:flex;background:var(--soft3);border-radius:10px;padding:4px;gap:4px")}>
          <button onClick={v.recAuthors} style={css(v.recAuthStyle)}>{T.muellifler}</button>
          <button onClick={v.recContractors} style={css(v.recContStyle)}>{T.muteahhitler}</button>
        </div>
        <select name="projFilter" onChange={v.onProjFilter} value={v.projFilterValue} aria-label={v.recFilterAll} style={css("flex:1;min-width:190px;height:40px;border:1px solid var(--line);background:var(--card);border-radius:9px;padding:0 10px;font-size:13px;font-weight:700")}>
          <option value="">{v.recFilterAll}</option>
          {(v.projectOptions || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div style={css("display:flex;gap:6px;flex:none")}>
          <button onClick={v.recSetCard} aria-pressed={v.recIsCard} style={css(v.recCardStyle)}>{T.kart}</button>
          <button onClick={v.recSetList} aria-pressed={v.recIsList} style={css(v.recListStyle)}>{T.liste}</button>
        </div>
      </div>

      <div style={st.stack13}>
        <div style={css("display:flex;gap:9px;flex-wrap:wrap;align-items:center")}>
          {narrow ? null : docBtn}
          <button onClick={v.selectAll} style={css("height:40px;padding:0 13px;border:1px solid var(--line);background:var(--card);border-radius:9px;font-size:13px;font-weight:700;cursor:pointer" + (narrow ? ";flex:1" : ""))}>{v.selectAllLabel}</button>
          {v.canWriteRecords ? (
            <button onClick={v.addRecord} style={css("height:40px;padding:0 15px;border:1px dashed var(--pri,#2a3180);background:var(--tint);border-radius:9px;color:var(--brandink);font-size:13px;font-weight:700;cursor:pointer" + (narrow ? ";flex:1" : ""))}>{v.recAddLabel}</button>
          ) : null}
        </div>

        {v.recNoRows ? <div style={st.note}>{T.kayitYok}</div> : null}

        {!v.recNoRows && v.recIsCard ? (
          <div style={css("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,268px),1fr));gap:12px;align-items:stretch")}>
            {rows.map((r) => (
              <div key={r.id} style={css("height:100%;display:flex;flex-direction:column;background:var(--card);border-radius:13px;padding:14px;border:1px solid " + (r.on ? "var(--pri,#2a3180)" : "var(--line)"))}>
                <div style={css("display:flex;align-items:center;gap:10px")}>
                  <button onClick={r.onSelect} aria-pressed={r.on} aria-label={r.title} style={css(r.checkStyle)}>{r.checkMark}</button>
                  <div style={css("flex:1;min-width:0")}>
                    <div style={st.title14}>{r.title}</div>
                    <div style={st.hintBold}>{r.sub}</div>
                  </div>
                  <button onClick={r.onDoc} style={css(DOC_BTN)}>{T.belge2}</button>
                </div>
                <div style={css("display:flex;flex-direction:column;gap:4px;margin-top:12px;padding-left:34px;min-width:0")}>
                  <KV k={r.k1} v={r.v1} />
                  <KV k={r.k2} v={r.v2} />
                </div>
                {r.canWrite ? (
                  <div style={css("display:flex;gap:7px;margin-top:auto;padding-top:12px")}>
                    <button onClick={r.onEdit} style={css("flex:1;height:36px;border:1px solid var(--line);background:var(--card);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{T.duzenle}</button>
                    <button onClick={r.onDelete} style={css("width:48px;height:36px;border:1px solid var(--errline);background:var(--err);color:var(--errtext);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{T.sil}</button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {!v.recNoRows && v.recIsList && narrow ? (
          <div role="list" style={css("background:var(--card);border:1px solid var(--line);border-radius:13px;overflow:hidden")}>
            {rows.map((r) => (
              <div role="listitem" key={r.id} style={css("display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line2)")}>
                <button onClick={r.onSelect} aria-pressed={r.on} aria-label={r.title} style={css(r.checkStyle)}>{r.checkMark}</button>
                <div style={css("flex:1;min-width:0")}>
                  <div style={st.title14}>{r.title}</div>
                  <div style={st.hintBold}>{r.sub}</div>
                  <div style={css("font-size:12px;font-weight:600;color:var(--ink);margin-top:5px;font-variant-numeric:tabular-nums;" + ELL)}>
                    <span style={css("color:var(--muted);font-weight:700")}>{r.k1}:</span> {r.v1} &nbsp; <span style={css("color:var(--muted);font-weight:700")}>{r.k2s}:</span> {r.v2}
                  </div>
                </div>
                {r.canWrite ? (
                  <div style={css("display:flex;gap:6px;flex:none")}>
                    <button onClick={r.onEdit} aria-label={T.duzenle} title={T.duzenle} style={css(ICON_BTN + ";border:1px solid var(--line);background:var(--card);color:var(--ink)")}>{PENCIL}</button>
                    <button onClick={r.onDelete} aria-label={T.sil} title={T.sil} style={css(ICON_BTN + ";border:1px solid var(--errline);background:var(--err);color:var(--errtext)")}>✕</button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {!v.recNoRows && v.recIsList && !narrow ? (
          <div role="table" style={css("display:grid;grid-template-columns:" + v.recCols + ";column-gap:16px;background:var(--card);border:1px solid var(--line);border-radius:13px;overflow:hidden")}>
            <div role="row" style={css("display:grid;grid-template-columns:subgrid;grid-column:1 / -1;align-items:center;padding:10px 16px;background:var(--soft2);border-bottom:1px solid var(--line2);font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.4px")}>
              <span />
              {(v.recHeads || []).map((h: string) => <span role="columnheader" key={h}>{h}</span>)}
              <span />
            </div>
            {rows.map((r) => (
              <div role="row" key={r.id} style={css("display:grid;grid-template-columns:subgrid;grid-column:1 / -1;align-items:center;row-gap:8px;padding:12px 16px;border-bottom:1px solid var(--line2)")}>
                <button onClick={r.onSelect} aria-pressed={r.on} aria-label={r.title} style={css(r.checkStyle)}>{r.checkMark}</button>
                <div style={st.rowTitle}>{r.title}</div>
                <div style={css("font-size:13px;font-weight:600;color:var(--muted);" + ELL)}>{r.sub}</div>
                <div style={css("font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;" + ELL)}>{r.v1}</div>
                <div style={css("font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;" + ELL)}>{r.v2}</div>
                <div style={css("display:flex;gap:6px;justify-content:flex-end")}>
                  <button onClick={r.onDoc} style={css(DOC_BTN)}>{T.belge2}</button>
                  {r.canWrite ? (<>
                    <button onClick={r.onEdit} style={css("height:30px;padding:0 10px;border:1px solid var(--line);background:var(--card);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{T.duzenle}</button>
                    <button onClick={r.onDelete} style={css("height:30px;padding:0 10px;border:1px solid var(--errline);background:var(--err);color:var(--errtext);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{T.sil}</button>
                  </>) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {narrow ? docBtn : null}
      </div>
    </div>
  );
}
