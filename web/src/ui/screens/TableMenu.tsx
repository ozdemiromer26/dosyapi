import { st } from "../styles";
import React, { useLayoutEffect, useRef, useState } from "react";
import { css } from "../css";
import type { Vals } from "../../vm/types";

const HEADING = "font-size:10px;font-weight:800;letter-spacing:.5px;color:var(--muted);padding:6px 9px 3px";
const ROW = "min-height:36px;padding:0 9px;border:none;background:transparent;border-radius:7px;text-align:left;font-size:13px;font-weight:700;color:var(--ink);cursor:pointer";
const STEP = "width:44px;height:44px;flex:none;border:1px solid var(--line);background:var(--card);border-radius:10px;font-size:20px;font-weight:700;color:var(--ink);cursor:pointer";
const INPUT = "width:72px;height:36px;border:1px solid var(--line);background:var(--soft);border-radius:7px;padding:0 7px;font-size:12px;font-weight:600";

function Stepper({ label, value, set, max }: { label: string; value: number; set: (n: number) => void; max: number }) {
  return (
    <div style={css("display:flex;align-items:center;gap:10px")}>
      <span style={css("flex:1;font-size:13px;font-weight:700")}>{label}</span>
      <button aria-label={label + " −"} onClick={() => set(Math.max(1, value - 1))} style={css(STEP)}>−</button>
      <span style={css("width:34px;text-align:center;font-size:16px;font-weight:800")}>{value}</span>
      <button aria-label={label + " +"} onClick={() => set(Math.min(max, value + 1))} style={css(STEP)}>+</button>
    </div>
  );
}

/** Telefonda ızgara yerine sayı seçici: önce seçilir, sonra onaylanır; yanlışlıkla tablo eklenmez. */
function MobileSizer({ v }: { v: Vals }) {
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(4);
  const [header, setHeader] = useState(true);
  const preview = Array.from({ length: Math.min(rows, 6) }, (_, r) => r);
  return (
    <div style={css("display:flex;flex-direction:column;gap:10px;padding:4px 9px 10px")}>
      <Stepper label={v.T.sutunSayisi} value={cols} set={setCols} max={30} />
      <Stepper label={v.T.satirSayisi} value={rows} set={setRows} max={200} />
      <div aria-hidden="true" style={css("display:flex;flex-direction:column;gap:2px;padding:6px 0")}>
        {preview.map((r) => (
          <div key={r} style={css("display:flex;gap:2px")}>
            {Array.from({ length: Math.min(cols, 12) }, (_, c) => (
              <span key={c} style={css("flex:1;height:10px;border-radius:2px;background:" + (header && r === 0 ? "var(--tintline)" : "var(--soft3)"))} />
            ))}
          </div>
        ))}
      </div>
      <button onClick={() => setHeader(!header)} style={css("display:flex;align-items:center;gap:10px;height:40px;padding:0 2px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:700;color:var(--ink)")}>
        <span style={css("width:20px;height:20px;border-radius:5px;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;" + (header ? "background:var(--pri,#2a3180);color:#fff" : "border:1px solid var(--line);color:transparent"))}>✓</span>
        {v.T.baslikSatiri}
      </button>
      <button onClick={() => v.tblInsert(cols, rows, header)} style={st.primary}>{v.T.tabloyuEkle}</button>
    </div>
  );
}

function DesktopSizer({ v }: { v: Vals }) {
  return (
    <>
      <div style={css(HEADING)}>{v.gridLabel}</div>
      <div style={css("display:grid;grid-template-columns:repeat(10,17px);gap:3px;padding:4px 9px 8px")} onMouseLeave={v.gridLeave}>
        {(v.gridCells || []).map((g: any, i: number) => (
          <button key={i} onMouseDown={v.tbKeep} onMouseEnter={g.onEnter} onClick={g.onPick} aria-label={g.label} style={css(g.style)} />
        ))}
      </div>
      <div style={css("border-top:1px solid var(--line2);" + HEADING)}>{v.T.ozelBoyut}</div>
      <div style={css("display:flex;gap:6px;align-items:center;padding:2px 9px 6px")}>
        <input name="tcCols" type="number" min="1" max="30" placeholder={v.T.sutunSayisi} aria-label={v.T.sutunSayisi} onChange={v.onField} style={css(INPUT)} />
        <input name="tcRows" type="number" min="1" max="200" placeholder={v.T.satirSayisi} aria-label={v.T.satirSayisi} onChange={v.onField} style={css(INPUT)} />
        <button onMouseDown={v.tbKeep} onClick={v.tblCustom} style={css("height:36px;padding:0 12px;border:none;border-radius:7px;background:var(--pri,#2a3180);color:#fff;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.ekle}</button>
      </div>
    </>
  );
}

function Presets({ v }: { v: Vals }) {
  return (
    <>
      <div style={css("border-top:1px solid var(--line2);" + HEADING)}>{v.T.hazirTablolar}</div>
      {(v.tblPresets || []).map((p: any) => (
        <button key={p.id} onMouseDown={v.tbKeep} onClick={p.onPick} className="hv2" style={css(ROW)}>{p.label}</button>
      ))}
    </>
  );
}

function DataTables({ v }: { v: Vals }) {
  const lists = v.listDD || [];
  if (!lists.length) return <div style={css("padding:8px 9px;font-size:12px;color:var(--muted);font-weight:600")}>{v.T.veridenTabloYok}</div>;
  return (
    <>
      <div style={css("padding:4px 9px 6px;font-size:12px;color:var(--muted);font-weight:600;line-height:1.5")}>{v.T.sutunSecHint}</div>
      {lists.map((l: any) => (
        <div key={l.key} style={css("display:flex;flex-direction:column;gap:6px;padding:6px 9px;border-top:1px solid var(--line2)")}>
          <div style={st.title13}>{l.label}</div>
          <div style={css("display:flex;flex-wrap:wrap;gap:5px")}>
            {(l.cols || []).map((c: any, i: number) => (
              <button key={i} onMouseDown={v.tbKeep} onClick={c.onToggle} style={css(c.style)}>{c.mark} {c.label}</button>
            ))}
          </div>
          <button onMouseDown={v.tbKeep} onClick={l.onTableC} style={css("height:36px;border:none;border-radius:7px;background:var(--pri,#2a3180);color:#fff;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.tabloOlarakEkle}</button>
        </div>
      ))}
    </>
  );
}

/** Ekle › Tablo: boş tablo ve veriden tablo tek menüde. */
export function TableMenu({ v }: { v: Vals }) {
  const [tab, setTab] = useState<"blank" | "data">("blank");
  const [alignRight, setAlignRight] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const mobile = !!v.rbMob;

  useLayoutEffect(() => {
    if (!mobile && box.current && box.current.getBoundingClientRect().right > window.innerWidth - 8) setAlignRight(true);
  }, [mobile, tab]);

  const place = mobile
    ? "position:fixed;left:0;right:0;bottom:0;z-index:70;border-radius:16px 16px 0 0;max-height:82vh;overflow-y:auto;padding:10px 8px calc(14px + env(safe-area-inset-bottom));animation:sheetIn .18s ease"
    : "position:absolute;top:calc(100% + 4px);" + (alignRight ? "right:0" : "left:0") + ";z-index:40;border-radius:10px;padding:6px;width:280px;max-width:calc(100vw - 28px);max-height:70vh;overflow-y:auto";
  const tabStyle = (on: boolean) =>
    "flex:1;height:32px;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;" +
    (on ? "background:var(--card);color:var(--brandink);box-shadow:0 1px 3px rgba(0,0,0,.1)" : "background:transparent;color:var(--muted)");

  return (
    <div ref={box} data-rb="1" style={css("background:var(--card);border:1px solid var(--line);box-shadow:0 12px 30px rgba(0,0,0,.16);display:flex;flex-direction:column;gap:2px;" + place)}>
      <div style={css("display:flex;gap:3px;background:var(--soft3);border-radius:9px;padding:3px;margin:2px 3px 6px")}>
        <button onMouseDown={v.tbKeep} onClick={() => setTab("blank")} style={css(tabStyle(tab === "blank"))}>{v.T.bosTablo}</button>
        <button onMouseDown={v.tbKeep} onClick={() => setTab("data")} style={css(tabStyle(tab === "data"))}>{v.T.veridenTablo}</button>
      </div>
      {tab === "data" ? <DataTables v={v} /> : (
        <>
          {mobile ? <MobileSizer v={v} /> : <DesktopSizer v={v} />}
          <Presets v={v} />
        </>
      )}
    </div>
  );
}
