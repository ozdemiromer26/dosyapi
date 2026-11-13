// Görünüm modeli: serverFiles
import type { Ctx, Vals } from "./types";
import { tx } from "../i18n";
import { ic } from "../ui/icons";
/*IMPORTS*/

export function buildServerFiles(c: Ctx): () => Vals {
  const app = c.app;
  const { s } = c; /*TOP*/
    const fq = (s.fileQ || "").trim().toLowerCase();
    const fxOpen = s.fxOpen || {};
    const extOf = (n) => (n.split(".").pop() || "").toUpperCase().slice(0, 4);
    const dropFile = (id, name) => app.act(() => app.api.del("/master/files/" + id), name + tx(" sunucudan silindi."));
    const fxTree = s.projects.map(p => ({
      key: "p:" + p.id, name: p.name, children: [
        { key: "p:" + p.id + ":docs", name: tx("Belgeler"), children: s.docTypes.map(d => {
          const doc = (p.docs || {})[d.id];
          return { key: "p:" + p.id + ":d:" + d.id, name: d.name, children: ((doc && doc.files) || []).map(f => ({ file: true, name: f.name, meta: [f.size, f.at, f.by].filter(Boolean).join(" · "), url: f.url, onDel: () => dropFile(f.id, f.name) })) };
        }) },
        { key: "p:" + p.id + ":files", name: tx("Ek dosyalar"), children: (p.files || []).map(f => ({ file: true, name: f.name, meta: f.size + " · " + f.at + " · " + f.by, url: f.url, onDel: () => dropFile(f.id, f.name) })) },
      ],
    }));
    const fxHit = (n, path) => !fq || (path + " " + n.name).toLowerCase().indexOf(fq) > -1;
    const fxCount = (n, path) => n.file ? (fxHit(n, path) ? 1 : 0) : n.children.reduce((a, c) => a + fxCount(c, path + " " + n.name), 0);
    const fxAllKeys = [];
    const fxCollect = (n) => { if (n.file) return; fxAllKeys.push(n.key); n.children.forEach(fxCollect); };
    fxTree.forEach(fxCollect);
    const FOLDER = () => ic(["path", { d: "M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" }]);
    const fxRows = [];
    const fxWalk = (n, depth, path) => {
      const rowStyle = "display:flex;align-items:center;gap:9px;min-height:44px;padding:6px 10px 6px " + (10 + depth * 20) + "px;border-bottom:1px solid var(--mline);" + (depth === 0 ? "background:var(--mcard)" : "");
      if (n.file) {
        if (!fxHit(n, path)) return;
        fxRows.push({ isFile: true, isFolder: false, name: n.name, meta: n.meta, ext: extOf(n.name), rowStyle, onDownload: () => app.download(n.name, n.url), canPreview: !!app.previewKind(n.name), onPreview: () => app.openPreview(n.name, n.url), onDelete: n.onDel });
        return;
      }
      const c = fxCount(n, path);
      if (fq && !c) return;
      const open = fq ? true : (fxOpen[n.key] !== undefined ? fxOpen[n.key] : (depth < 2 || c > 0));
      fxRows.push({
        isFolder: true, isFile: false, name: n.name, count: c ? c + tx(" dosya") : tx("boş"),
        chev: n.children.length ? (open ? "▼" : "▶") : "", icon: FOLDER(), rowStyle,
        iconStyle: "display:flex;flex:none;color:" + (depth === 0 ? "var(--brandink)" : c ? "var(--mtext)" : "var(--mmuted)"),
        nameStyle: "flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;font-weight:" + (depth === 0 ? "800" : "700") + ";color:" + (c || depth < 2 ? "var(--mink)" : "var(--mmuted)"),
        onToggle: () => app.setState(st => ({ fxOpen: { ...(st.fxOpen || {}), [n.key]: !open } })),
      });
      if (open) n.children.forEach(ch => fxWalk(ch, depth + 1, path + " " + n.name));
    };
    fxTree.forEach(n => fxWalk(n, 0, ""));
    Object.assign(c, { fq, fxOpen, extOf, dropFile, fxTree, fxHit, fxCount, fxAllKeys, fxCollect, FOLDER, fxRows, fxWalk });
  return () => {
    /*LATE*/
    return {

    };
  };
}
