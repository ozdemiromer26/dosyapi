// Görünüm modeli: tasks
import type { Ctx, Vals } from "./types";
import { LOC, tx } from "../i18n";
/*IMPORTS*/

export function buildTasks(c: Ctx): () => Vals {
  const app = c.app;
  const { check, me, s } = c; /*TOP*/
    const userLabel = (id) => { const u = s.users.find(x => x.id === id); return u ? u.name : "—"; };
    const dueFmt = (d) => d ? new Date(d).toLocaleDateString(LOC(), { day: "2-digit", month: "short" }) : tx("süresiz");
    const overdue = (t) => !t.done && t.due && new Date(t.due) < new Date();
    const taskRow = (t) => ({
      ...t,
      checkStyle: check(t.done), checkMark: t.done ? "✓" : "",
      titleStyle: "font-size:13px;font-weight:700;" + (t.done ? "color:var(--faint);text-decoration:line-through" : "color:var(--ink)"),
      meta: (t.projectId ? ((s.projects.find(p => p.id === t.projectId) || {}).name || "") + " · " : "") + tx("atayan ") + userLabel(t.by),
      assigneeLabel: userLabel(t.assignee),
      dueLabel: dueFmt(t.due),
      dueStyle: "flex:none;font-size:11px;font-weight:800;padding:4px 8px;border-radius:6px;" + (overdue(t) ? "background:var(--err);color:var(--errtext)" : "background:var(--soft3);color:var(--muted)"),
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
    Object.assign(c, { userLabel, dueFmt, overdue, taskRow, myTasks, assignedByMe, myTodos });
  return () => {
    const { lvl, s } = c; /*LATE*/
    return {
      canAssign: app.perm("tasks"),
      assignableUsers: s.users.filter(u => { const r = app.roleOf(u); return u.status === "active" && r && r.level > lvl; }).map(u => ({ id: u.id, label: u.name + " · " + app.roleOf(u).name })),
      projectOptions: s.projects.map(p => ({ id: p.id, name: p.name })),
      myTasks, assignedByMe, hasAssignedByMe: assignedByMe.length > 0,
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
