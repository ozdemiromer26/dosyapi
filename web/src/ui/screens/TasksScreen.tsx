import { st } from "../styles";
import React from "react";
import { css } from "../css";
import type { Vals } from "../../vm/types";
import { OverdueNotes } from "../parts";

const FIELD = "height:38px;border:1px solid var(--line);background:var(--card);border-radius:9px;padding:0 10px;font-size:13px;font-weight:700;color:var(--ink);min-width:0";
const ICON_BTN = "flex:none;width:32px;height:30px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center";

const PENCIL = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" />
  </svg>
);

/** Atadığım görev satırı; kalemle yerinde düzenlenir. */
function AssignedTask({ t, v }: { t: any; v: Vals }) {
  const [edit, setEdit] = React.useState(false);
  const [f, setF] = React.useState({ title: "", assignee: "", due: "", projectId: "" });
  const [busy, setBusy] = React.useState(false);
  const open = () => { setF({ title: t.title, assignee: t.assignee, due: t.due || "", projectId: t.projectId || "" }); setEdit(true); };
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = async () => { setBusy(true); const ok = await t.onSave(f); setBusy(false); if (ok) setEdit(false); };
  // Atanan kişi artık atanabilir listede değilse (kademe değişmiş olabilir) yine de seçili görünsün.
  const users = (v.assignableUsers || []).some((u: any) => u.id === t.assignee)
    ? v.assignableUsers : [{ id: t.assignee, label: t.assigneeLabel }, ...(v.assignableUsers || [])];
  if (edit) {
    return (
      <div data-form="1" onKeyDown={(e) => { if (e.key === "Escape") setEdit(false); if (e.key === "Enter" && (e.target as any).tagName === "INPUT") save(); }}
        style={css("display:flex;flex-direction:column;gap:8px;background:var(--soft2);border:1px solid var(--tintline);border-radius:10px;padding:11px")}>
        <input value={f.title} onChange={set("title")} maxLength={300} aria-label={v.T.gorevTanimi} placeholder={v.T.gorevTanimi} autoFocus style={css(FIELD + ";width:100%")} />
        <div style={css("display:flex;gap:8px;flex-wrap:wrap")}>
          <select value={f.assignee} onChange={set("assignee")} aria-label={v.T.atanan} style={css(FIELD + ";flex:1 1 170px")}>
            {users.map((u: any) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
          <input type="date" value={f.due} onChange={set("due")} aria-label={v.T.bitisTarihi} style={css(FIELD + ";flex:1 1 140px")} />
        </div>
        <select value={f.projectId} onChange={set("projectId")} aria-label={v.T.projeBaglantisiOpsiyonel} style={css(FIELD + ";width:100%")}>
          <option value="">{v.T.projeBaglantisiOpsiyonel}</option>
          {(v.projectOptions || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div style={css("display:flex;gap:8px;justify-content:flex-end")}>
          <button onClick={() => setEdit(false)} style={css("height:34px;padding:0 13px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.vazgec}</button>
          <button onClick={save} disabled={busy} style={css("height:34px;padding:0 15px;border:none;background:var(--pri,#2a3180);color:#fff;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer")}>{v.T.kaydet}</button>
        </div>
      </div>
    );
  }
  return (
    <div style={css(t.rowStyle + ";gap:8px")}>
      <div style={css("flex:1;min-width:0")}>
        <div style={css(t.titleStyle)}>{t.title}</div>
        <div style={st.caption}>{t.assigneeLabel} · {t.dueDateLabel}</div>
      </div>
      {t.isOverdue ? <span style={css(t.overdueStyle)}>{t.overdueLabel}</span> : <span style={css(t.stateStyle)}>{t.stateLabel}</span>}
      {t.canEdit ? <button onClick={open} aria-label={v.T.duzenle} title={v.T.duzenle} style={css(ICON_BTN + ";border:1px solid var(--line);background:var(--card);color:var(--ink)")}>{PENCIL}</button> : null}
      <button onClick={t.onDelete} aria-label={v.T.sil} title={v.T.sil} style={css(ICON_BTN + ";border:1px solid var(--errline);background:var(--err);color:var(--errtext)")}>✕</button>
    </div>
  );
}

export function TasksScreen({ v }: { v: Vals }) {
  return (
    <>
          {v.hasMyOverdue || v.hasAssignedOverdue ? <div style={css("margin-bottom:14px")}><OverdueNotes v={v} /></div> : null}
          <div style={css("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:14px;align-items:stretch")}>
            <div style={st.stack14}>
              {v.canAssign ? (<>
                <div style={css("background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px")}>
                  <div style={st.title14}>{v.T.gorevAta}</div>
                  <input name="tTitle" ref={v.refTTitle} onChange={v.onField} placeholder={v.T.gorevTanimi} style={st.field} />
                  <div style={css("display:flex;gap:9px;flex-wrap:wrap")}>
                    <select name="tUser" onChange={v.onField} style={css("flex:1;min-width:150px;height:40px;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:0 10px;font-size:13px;font-weight:700")}>
                      {(v.assignableUsers || []).map((u: any, i37: number) => (<React.Fragment key={u?.id ?? u?.key ?? i37}>
                        <option value={u.id}>{u.label}</option>
                      </React.Fragment>))}
                    </select>
                    <input name="tDue" ref={v.refTDue} onChange={v.onField} type="date" style={css("flex:1;min-width:140px;height:40px;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:0 11px;font-size:13px;font-weight:700")} />
                  </div>
                  <select name="tProject" onChange={v.onField} style={st.fieldButton}>
                    <option value="">{v.T.projeBaglantisiOpsiyonel}</option>
                    {(v.projectOptions || []).map((p: any, i38: number) => (<React.Fragment key={p?.id ?? p?.key ?? i38}>
                      <option value={p.id}>{p.name}</option>
                    </React.Fragment>))}
                  </select>
                  <button onClick={v.addTask} style={css("height:40px;border:none;border-radius:9px;background:var(--pri,#2a3180);color:#fff;font-size:14px;font-weight:700;cursor:pointer")}>{v.T.goreviAta}</button>
                </div>
              </>) : null}

              <div style={css("flex:1;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:11px")}>
                <div style={st.title14}>{v.T.banaAtananGorevler}</div>
                {(v.myTasks || []).map((t: any, i39: number) => (<React.Fragment key={t?.id ?? t?.key ?? i39}>
                  <div style={css(t.rowStyle)}>
                    <button onClick={t.onToggle} style={css(t.checkStyle)}>{t.checkMark}</button>
                    <div style={css("flex:1;min-width:0")}>
                      <div style={css(t.titleStyle)}>{t.title}</div>
                      <div style={st.caption}>{t.meta}</div>
                    </div>
                    <span style={css(t.dueStyle)}>{t.dueLabel}</span>
                  </div>
                </React.Fragment>))}
                {v.noMyTasks ? (<>
                  <div style={st.note}>{v.T.atanmisGorevYok}</div>
                </>) : null}
              </div>
            </div>

            <div style={st.stack14}>
              {v.hasAssignedByMe ? (<>
                <div style={st.card}>
                  <div style={st.title14}>{v.T.atadigimGorevler}</div>
                  {(v.assignedByMe || []).map((t: any) => <AssignedTask key={t.id} t={t} v={v} />)}
                </div>
              </>) : null}

              <div style={css("flex:1;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:11px")}>
                <div style={st.title14}>{v.T.yapilacaklarKisiselDraft}</div>
                <div style={st.row8}>
                  <input name="todo" ref={v.refTodo} onChange={v.onField} placeholder={v.T.notEkle} style={css("flex:1;height:40px;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:0 11px;font-size:13px;font-weight:600")} />
                  <button onClick={v.addTodo} aria-label={v.T.ekle} style={css("width:52px;height:40px;border:none;border-radius:9px;background:var(--pri,#2a3180);color:#fff;font-size:18px;font-weight:700;cursor:pointer")}>+</button>
                </div>
                {(v.myTodos || []).map((t: any, i41: number) => (<React.Fragment key={t?.id ?? t?.key ?? i41}>
                  <div style={css("display:flex;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid var(--line3)")}>
                    <button onClick={t.onToggle} style={css(t.checkStyle)}>{t.checkMark}</button>
                    <div style={css(t.titleStyle)}>{t.text}</div>
                    <button onClick={t.onDelete} aria-label={v.T.sil} style={css("border:none;background:none;color:var(--faint);font-size:14px;font-weight:700;cursor:pointer")}>✕</button>
                  </div>
                </React.Fragment>))}
                {v.noTodos ? (<>
                  <div style={st.note}>{v.T.listeBos}</div>
                </>) : null}
              </div>
            </div>
          </div>
        </>
  );
}
