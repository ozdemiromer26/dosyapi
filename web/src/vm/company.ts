// Görünüm modeli: company
import type { Ctx, Vals } from "./types";
import { tx } from "../i18n";
import { EXT_PRESETS } from "../domain/constants";
/*IMPORTS*/

export function buildCompany(c: Ctx): () => Vals {
  const app = c.app;
  /*TOP*/

  // Belge tipi seçenek düğmesi (Zorunlu/Seçmeli, Tek/Çoklu dosya): açıkken dolu ana renk.
  const optBtn = (on: boolean) => "height:30px;padding:0 10px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex:none;" + (on ? "background:var(--pri,#2a3180);color:#fff;border:1px solid var(--pri,#2a3180)" : "background:var(--card);color:var(--muted);border:1px solid var(--line)");

  return () => {
    const { s } = c; /*LATE*/
    return {
      docTypes: s.docTypes.map(d => {
        const exts: string[] = d.extensions || [];
        const field = "ext_" + d.id;
        const put = (patch) => app.api.put("/doc-types/" + d.id, { name: d.name, required: d.required, extensions: exts, multi: d.multi, ...patch });
        const save = (patch) => app.act(() => put(patch));
        const addExt = () => {
          const raw = (app.fd[field] || "").trim(); if (!raw) return;
          // Alan yalnızca kayıt başarılıysa temizlenir; reddedilen uzantı düzeltilebilsin.
          app.act(() => put({ extensions: exts.concat([raw]) }).then(() => app.clearFields(field)));
        };
        return {
          ...d, reqLabel: d.required ? tx("Zorunlu") : tx("Seçmeli"), reqBtnStyle: optBtn(!!d.required), multiBtnStyle: optBtn(!!d.multi),
          onToggleReq: () => save({ required: !d.required }),
          onDelete: () => app.act(() => app.api.del("/doc-types/" + d.id)),
          extAll: !exts.length,
          extChips: exts.map(x => ({ key: x, label: "." + x, onRemove: () => save({ extensions: exts.filter(y => y !== x) }) })),
          extField: field, refExt: app.mkRef(field), addExt,
          onExtKey: (e) => { if (e.key === "Enter") { e.preventDefault(); addExt(); } },
          onPreset: (e) => {
            const id = e.target.value; e.target.value = ""; if (!id) return;
            if (id === "all") return save({ extensions: [] });
            const p = EXT_PRESETS.find(x => x[0] === id); if (!p) return;
            save({ extensions: exts.concat(p[2].filter(x => exts.indexOf(x) < 0)) });
          },
          multiLabel: d.multi ? tx("Çoklu dosya") : tx("Tek dosya"),
          onToggleMulti: () => save({ multi: !d.multi }),
        };
      }),
      extPresets: EXT_PRESETS.map(x => ({ id: x[0], label: tx(x[1]) })),
      addDocType: () => {
        const name = (app.fd.dtName || "").trim(); if (!name) return;
        app.clearFields("dtName");
        app.act(() => app.api.post("/doc-types", { name, required: false, extensions: [], multi: false }));
      },
      professions: s.professions.map(p => {
        const required = (s.profRequired || {})[p] !== false;
        return {
          name: p, required, reqLabel: required ? tx("Zorunlu") : tx("İsteğe bağlı"),
          onToggleReq: () => app.act(() => app.api.post("/professions", { name: p, required: !required })),
          onDelete: () => app.act(() => app.api.del("/professions/" + encodeURIComponent(p))),
        };
      }),
      addProfession: () => {
        const name = (app.fd.profName || "").trim(); if (!name) return;
        if (s.professions.indexOf(name) > -1) return app.toast(tx("Bu meslek zaten var."));
        app.clearFields("profName");
        app.act(() => app.api.post("/professions", { name, required: true }));
      },
    };
  };
}
