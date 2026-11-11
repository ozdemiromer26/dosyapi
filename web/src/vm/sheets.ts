// Görünüm modeli: sheets
import { shareTotal } from "../domain/shares";
import type { Ctx, Vals } from "./types";
import { tx } from "../i18n";
import { esc } from "../documents/template";
/*IMPORTS*/

export function buildSheets(c: Ctx): () => Vals {
  const app = c.app;
  /*TOP*/

  return () => {
    const { directProjects, directRecords, s, sh, sheetTitles } = c; /*LATE*/
    return {
      sheetOpen: !!s.sheet, sheetTitle: sheetTitles[sh.type] || "",
      sheetIsProject: sh.type === "project", sheetIsPeople: sh.type === "people", sheetIsAuthor: sh.type === "author",
      sheetIsContractor: sh.type === "contractor", sheetIsDoc: sh.type === "doc", sheetIsConfirm: sh.type === "confirm",
      sheetIsMenu: sh.type === "menu",
      closeSheet: () => { app.fd = {}; app.setState({ sheet: null, draft: {} }); },
      draft: s.draft || {},
      needsApproval: sh.type === "project" || sh.type === "people" ? !directProjects : !directRecords,
      saveLabel: (sh.type === "project" || sh.type === "people" ? directProjects : directRecords) ? tx("Kaydet") : tx("Onaya Gönder"),
      saveProject: () => {
        const d = s.draft || {}, f = app.fd;
        const payload: any = {
          id: d.id || "",
          name: f.prName !== undefined ? f.prName : (d.name || ""),
          contractorId: f.prContractor !== undefined ? f.prContractor : (d.contractorId || ""),
          ada: f.prAda !== undefined ? f.prAda : (d.ada || ""),
          parsel: f.prParsel !== undefined ? f.prParsel : (d.parsel || ""),
          pafta: f.prPafta !== undefined ? f.prPafta : (d.pafta || ""),
          mahalle: f.prMahalle !== undefined ? f.prMahalle : (d.mahalle || ""),
          street: f.prStreet !== undefined ? f.prStreet : (d.street || ""),
          status: f.prStatus !== undefined ? f.prStatus : (d.status || ""),
          note: f.prNote !== undefined ? f.prNote : (d.note || ""),
          authorIds: d.authorIds || [], docs: d.docs || {}, files: d.files || [],
          owners: d.owners || [],
          proxy: {
            name: f.prxName !== undefined ? f.prxName : ((d.proxy || {}).name || ""), tc: f.prxTc !== undefined ? f.prxTc : ((d.proxy || {}).tc || ""),
            phone: f.prxPhone !== undefined ? f.prxPhone : ((d.proxy || {}).phone || ""), address: f.prxAddr !== undefined ? f.prxAddr : ((d.proxy || {}).address || ""),
          },
        };
        payload.done = payload.status === "iskan";
        const miss = [["name", tx("İnşaat adı")], ["contractorId", tx("Müteahhit")], ["mahalle", tx("Mahalle")], ["street", tx("Cadde / sokak")], ["ada", tx("Ada no")], ["parsel", tx("Parsel no")], ["status", tx("Proje durumu")]].filter(x => !String(payload[x[0]] || "").trim());
        if (miss.length) return app.toast(tx("Zorunlu alanlar eksik: ") + miss.map(x => x[1]).join(", ") + tx(". (Yalnızca not alanı isteğe bağlıdır.)"));
        const shares = payload.owners.length ? shareTotal(payload.owners) : { ok: true, text: "", invalid: [] };
        if (!shares.ok) return app.toast(shares.text ? tx("Hisselerin toplamı 1/1 olmalı; şu an ") + shares.text + "." : tx("Geçersiz hisse: ") + shares.invalid.join(", "));
        app.commit(d.id ? "update" : "create", "project", payload, (d.id ? tx("Proje düzenleme") : tx("Yeni proje")) + ": " + payload.name);
      },
      saveAuthor: () => {
        const d = s.draft || {}, f = app.fd;
        const payload = {
          id: d.id || "",
          tc: f.auTc !== undefined ? f.auTc : (d.tc || ""), first: f.auFirst !== undefined ? f.auFirst : (d.first || ""),
          last: f.auLast !== undefined ? f.auLast : (d.last || ""), phone: f.auPhone !== undefined ? f.auPhone : (d.phone || ""),
          company: f.auCompany !== undefined ? f.auCompany : (d.company || ""), job: f.auJob !== undefined ? f.auJob : (d.job || ""),
          sicil: f.auSicil !== undefined ? f.auSicil : (d.sicil || ""), address: f.auAddress !== undefined ? f.auAddress : (d.address || ""),
        };
        if (!payload.first.trim()) return app.toast(tx("İsim zorunlu."));
        if (!payload.job) return app.toast(tx("Meslek seçin (şirket ayarlarında tanımlı listeden)."));
        app.commit(d.id ? "update" : "create", "author", payload, (d.id ? tx("Müellif düzenleme") : tx("Yeni müellif")) + ": " + payload.first + " " + payload.last);
      },
      saveContractor: () => {
        const d = s.draft || {}, f = app.fd;
        const payload = {
          id: d.id || "",
          title: f.coTitle !== undefined ? f.coTitle : (d.title || ""), owner: f.coOwner !== undefined ? f.coOwner : (d.owner || ""),
          licence: f.coLicence !== undefined ? f.coLicence : (d.licence || ""), rank: f.coRank !== undefined ? f.coRank : (d.rank || ""),
          address: f.coAddress !== undefined ? f.coAddress : (d.address || ""),
        };
        if (!payload.title.trim()) return app.toast(tx("Firma unvanı zorunlu."));
        app.commit(d.id ? "update" : "create", "contractor", payload, (d.id ? tx("Müteahhit düzenleme") : tx("Yeni müteahhit")) + ": " + payload.title);
      },
      confirmText: sh.action === "withdraw" && sh.obj ? "“" + sh.obj.title + tx("” talebi geri çekilecek; değişiklik uygulanmaz.") : sh.entity === "template" && sh.obj ? "“" + sh.obj.name + tx("” şablonu silinecek. Birkaç saniye içinde geri alabilirsiniz.") : sh.obj ? "“" + (sh.obj.name || sh.obj.title || (sh.obj.first + " " + sh.obj.last)) + tx("” kaydı silinecek.") + (sh.entity === "user" ? tx(" Kullanıcı erişimi kalıcı olarak kapanır.") : (sh.entity === "project" ? (directProjects ? tx(" Birkaç saniye içinde geri alabilirsiniz.") : tx(" Talep onaya gönderilecek.")) : (directRecords ? tx(" Birkaç saniye içinde geri alabilirsiniz.") : tx(" Talep onaya gönderilecek.")))) : "",
      confirmCta: sh.action === "withdraw" ? tx("Talebi geri çek") : sh.entity === "template" ? tx("Şablonu sil") : sh.entity === "user" ? tx("Kullanıcıyı sil") : ((sh.entity === "project" ? directProjects : directRecords) ? tx("Sil") : tx("Onaya gönder")),
      confirmAction: () => {
        const o = sh.obj;
        if (sh.action === "withdraw") { app.setState({ sheet: null }); app.act(() => app.api.post("/approvals/" + o.id + "/withdraw", {}), tx("Talep geri çekildi.")); return; }
        if (sh.entity === "contractor" && s.projects.some(p => p.contractorId === o.id)) { app.setState({ sheet: null }); return app.toast(tx("Bu müteahhit projelerde kullanılıyor; önce projelerden kaldırın.")); }
        const paths = { template: "/templates/", project: "/projects/", author: "/authors/", contractor: "/contractors/" };
        const lists = { template: "templates", project: "projects", author: "authors", contractor: "contractors" };
        if (sh.entity === "user") { app.setState({ sheet: null }); app.act(() => app.api.del("/users/" + o.id), o.name + tx(" silindi.")); return; }
        const label = o.name || o.title || (o.first + " " + o.last);
        const direct = sh.entity === "template" || (sh.entity === "project" ? directProjects : directRecords);
        app.setState({ sheet: null });
        if (direct) return app.scheduleDelete({ id: o.id, label: label + tx(" silindi."), list: lists[sh.entity], path: paths[sh.entity] + o.id });
        app.commit("delete", sh.entity, o, tx("Silme: ") + label);
      },

      docRows: sh.type === "doc" ? app.docRows(sh.docKind, sh.obj) : [],
      docKindLabel: sh.title || "",
      docNo: sh.obj ? "BLG-" + String(sh.obj.id).toUpperCase().slice(0, 6) : "",
      printDoc: () => {
        const rows = app.docRows(sh.docKind, sh.obj).map(r => '<tr><td style="padding:9px 0;border-bottom:1px dotted #d8d8d8;font-size:11px;letter-spacing:.4px;text-transform:uppercase;color:#646464;width:190px">' + esc(r.k) + '</td><td style="padding:9px 0;border-bottom:1px dotted #d8d8d8;font-size:14px">' + esc(r.v) + "</td></tr>").join("");
        app.printWindow(sh.title, '<table style="width:100%;border-collapse:collapse;margin-top:18px">' + rows + "</table>");
      },
      toast: s.toast,
    };
  };
}
