// Görünüm modeli: tasks
import type { Ctx, Vals } from "./types";
import { LOC, tx } from "../i18n";
import { localToday } from "../domain/constants";
/*IMPORTS*/

export function buildTasks(c: Ctx): () => Vals {
  const app = c.app;
  const { check, me, s } = c; /*TOP*/
    const userLabel = (id) => { const u = s.users.find(x => x.id === id); return u ? u.name : "—"; };
    // Termin "YYYY-AA-GG" yerel gün olarak okunur (UTC gece yarısı saat dilimine göre bir gün kaydırırdı).
    const dueDate = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
    const dueFmt = (d) => { const x = dueDate(d); return x ? x.toLocaleDateString(LOC(), { day: "2-digit", month: "short" }) : tx("süresiz"); };
    // Termin günü boyunca görev açık sayılır; ertesi gün başlarken süresi geçmiş olur.
    const today = s.today || localToday();
    const overdue = (t) => !t.done && !!t.due && t.due < today;
    const dueToday = (t) => !t.done && t.due === today;
    const duePill = "flex:none;font-size:11px;font-weight:800;padding:4px 8px;border-radius:6px;white-space:nowrap;";
    const taskRow = (t) => ({
      ...t,
      isOverdue: overdue(t), isDueToday: dueToday(t),
      overdueLabel: tx("Süresi geçti"),
      overdueStyle: duePill + "background:var(--err);color:var(--errtext)",
      rowStyle: "display:flex;align-items:center;gap:10px;border-radius:10px;padding:11px;" + (overdue(t) ? "background:var(--err);box-shadow:inset 3px 0 0 var(--errtext)" : "background:var(--soft2)"),
      checkStyle: check(t.done), checkMark: t.done ? "✓" : "",
      titleStyle: "font-size:13px;font-weight:700;" + (t.done ? "color:var(--faint);text-decoration:line-through" : "color:var(--ink)"),
      meta: (t.projectId ? ((s.projects.find(p => p.id === t.projectId) || {}).name || "") + " · " : "") + tx("atayan ") + userLabel(t.by),
      assigneeLabel: userLabel(t.assignee),
      dueLabel: overdue(t) ? tx("Süresi geçti") + " · " + dueFmt(t.due) : dueToday(t) ? tx("Bugün") : dueFmt(t.due),
      dueDateLabel: dueFmt(t.due),
      dueStyle: duePill + (overdue(t) ? "background:var(--card);color:var(--errtext);border:1px solid var(--errline)" : dueToday(t) ? "background:var(--warn);color:var(--warntext)" : "background:var(--soft3);color:var(--muted)"),
      stateLabel: t.done ? tx("Bitti") : tx("Açık"),
      stateStyle: "flex:none;font-size:11px;font-weight:800;padding:4px 8px;border-radius:6px;" + (t.done ? "background:var(--ok);color:var(--oktext)" : "background:var(--soft3);color:var(--muted)"),
      onToggle: () => app.act(() => app.api.post("/tasks/" + t.id + "/toggle", {})),
      onDelete: () => app.act(() => app.api.del("/tasks/" + t.id)),
      // Düzenleme yalnızca atayana açık; sunucu da aynı kuralı uygular.
      canEdit: !!me && t.by === me.id && app.perm("tasks"),
      onSave: (body) => {
        const title = (body.title || "").trim();
        if (!title || !body.assignee) { app.toast(tx("Görev tanımı ve atanacak kişi gerekli.")); return Promise.resolve(false); }
        return app.act(() => app.api.put("/tasks/" + t.id, { title, assignee: body.assignee, due: body.due || "", projectId: body.projectId || "" }), tx("Görev güncellendi.")).then(r => r !== undefined);
      },
    });
    const myTasks = s.tasks.filter(t => t.assignee === (me && me.id)).map(taskRow);
    const assignedByMe = s.tasks.filter(t => t.by === (me && me.id)).map(taskRow);
    const myTodos = s.todos.filter(t => t.userId === (me && me.id)).map(t => ({
      ...t, checkStyle: check(t.done), checkMark: t.done ? "✓" : "",
      titleStyle: "flex:1;font-size:13px;font-weight:600;" + (t.done ? "color:var(--faint);text-decoration:line-through" : "color:var(--ink)"),
      onToggle: () => app.act(() => app.api.post("/todos/" + t.id + "/toggle", {})),
      onDelete: () => app.act(() => app.api.del("/todos/" + t.id)),
    }));
    const myOverdue = myTasks.filter(t => t.isOverdue);
    // Atadığım ve süresi geçen görevler (kendime atadıklarım zaten "bana atanan"da).
    const assignedOverdue = assignedByMe.filter(t => t.isOverdue && t.assignee !== (me && me.id));
    Object.assign(c, { userLabel, dueFmt, overdue, taskRow, myTasks, assignedByMe, myTodos, myOverdue, assignedOverdue });
  return () => {
    const { lvl, s } = c; /*LATE*/
    return {
      canAssign: app.perm("tasks"),
      assignableUsers: s.users.filter(u => { const r = app.roleOf(u); return u.status === "active" && r && r.level > lvl; }).map(u => ({ id: u.id, label: u.name + " · " + app.roleOf(u).name })),
      projectOptions: s.projects.map(p => ({ id: p.id, name: p.name })),
      myTasks, assignedByMe, hasAssignedByMe: assignedByMe.length > 0,
      hasMyOverdue: myOverdue.length > 0, hasAssignedOverdue: assignedOverdue.length > 0,
      myOverdueNote: myOverdue.length === 1 ? tx("Size atanan 1 görevin süresi geçti.") : tx("Size atanan {n} görevin süresi geçti.").replace("{n}", String(myOverdue.length)),
      assignedOverdueNote: assignedOverdue.length === 1 ? tx("Atadığınız 1 görevin süresi geçti ve henüz tamamlanmadı.") : tx("Atadığınız {n} görevin süresi geçti ve henüz tamamlanmadı.").replace("{n}", String(assignedOverdue.length)),
      addTask: () => {
        const title = (app.fd.tTitle || "").trim();
        const assignee = app.fd.tUser || (s.users.filter(u => { const r = app.roleOf(u); return r && r.level > lvl; })[0] || {}).id;
        if (!title || !assignee) return app.toast(tx("Görev tanımı ve atanacak kişi gerekli."));
        const due = app.fd.tDue || "", projectId = app.fd.tProject || "";
        app.clearFields("tTitle", "tDue");
        app.act(() => app.api.post("/tasks", { title, assignee, due, projectId }), tx("Görev atandı."));
      },
      myTodos, noTodos: myTodos.length === 0,
      addTodo: () => {
        const text = (app.fd.todo || "").trim(); if (!text) return;
        app.clearFields("todo");
        app.act(() => app.api.post("/todos", { text }));
      },

    };
  };
}
