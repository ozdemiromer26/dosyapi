// Görünüm modeli: profile
import type { Ctx, Vals } from "./types";
import { tx } from "../i18n";
/*IMPORTS*/

export function buildProfile(c: Ctx): () => Vals {
  const app = c.app;
  const { dot, pm, rm } = c; /*TOP*/
    const myPerms = [
      { label: tx("Projeler"), value: { edit: tx("Doğrudan düzenle"), approve: tx("Onaylı düzenle"), read: tx("Salt okuma"), none: tx("Erişim yok") }[pm], dotStyle: dot(pm !== "none") },
      { label: tx("Müellif / müteahhit kayıtları"), value: { edit: tx("Doğrudan düzenle"), approve: tx("Onaylı düzenle"), read: tx("Salt okuma"), none: tx("Erişim yok") }[rm], dotStyle: dot(rm !== "none") },
      { label: tx("Şirket ayarları"), value: app.perm("company") ? tx("Açık") : tx("Kapalı"), dotStyle: dot(app.perm("company")) },
      { label: tx("Kullanıcı yönetimi"), value: app.perm("users") ? tx("Açık") : tx("Kapalı"), dotStyle: dot(app.perm("users")) },
      { label: tx("Kayıt onaylama"), value: app.perm("approve") ? tx("Açık") : tx("Kapalı"), dotStyle: dot(app.perm("approve")) },
      { label: tx("Görev atama"), value: app.perm("tasks") ? tx("Açık") : tx("Kapalı"), dotStyle: dot(app.perm("tasks")) },
      { label: tx("Dosya yükleme"), value: app.perm("files") ? tx("Açık") : tx("Kapalı"), dotStyle: dot(app.perm("files")) },
      { label: tx("Şablon yönetimi"), value: app.perm("templates") ? tx("Açık") : tx("Kapalı"), dotStyle: dot(app.perm("templates")) },
    ];
    Object.assign(c, { myPerms });
  return () => {
    // `top` açıkça alınmalı: alınmazsa tarayıcının global `window.top` nesnesi okunur (hep dolu).
    const { me, pendings, top } = c; /*LATE*/
    const deletePending = (pendings || []).find(p => p.kind === "user-delete" && p.mine);
    return {
      myPerms,
      canRequestDelete: !top && !deletePending,
      deleteRequestNote: top ? tx("Üst yönetici hesapları yalnızca sistem (master) panelinden silinebilir.")
        : deletePending ? tx("Silme talebiniz üst kademe onayını bekliyor. Onaylar › Gönderilen sekmesinden geri çekebilirsiniz.")
        : tx("Talebiniz üst kademe yöneticilere iletilir; onaylanırsa hesabınız kalıcı olarak silinir."),
      deleteIsPending: !!deletePending,
      goSentApprovals: () => app.setState({ tab: "approvals", apTab: "out" }),
      requestSelfDelete: () => app.act(() => app.api.post("/profile/delete-request", {}), tx("Hesap silme talebiniz iletildi.")),
      saveProfile: () => {
        const email = (app.fd.pEmail ?? me.email).trim().toLowerCase();
        const currentPassword = app.fd.pCurrent || "";
        app.clearFields("pCurrent");
        app.act(() => app.api.put("/profile", { name: app.fd.pName ?? me.name, email, phone: "", currentPassword }), tx("Profil kaydedildi."));
      },
      savePassword: () => {
        if (!app.fd.oldPass) return app.toast(tx("Mevcut şifrenizi girin."));
        if (app.fd.newPass !== app.fd.newPass2) return app.toast(tx("Yeni şifre ile onayı aynı değil."));
        const body = { oldPassword: app.fd.oldPass, newPassword: app.fd.newPass || "" };
        app.clearFields("oldPass", "newPass", "newPass2");
        app.act(() => app.api.post("/profile/password", body), tx("Şifre güncellendi."));
      },
      refPCurrent: app.mkRef("pCurrent"), refOldPass: app.mkRef("oldPass"), refNewPass: app.mkRef("newPass"), refNewPass2: app.mkRef("newPass2"),
      refMNew: app.mkRef("mNew"), refMNew2: app.mkRef("mNew2"),
      refTTitle: app.mkRef("tTitle"), refTDue: app.mkRef("tDue"),
      refTodo: app.mkRef("todo"), refDtName: app.mkRef("dtName"), refProfName: app.mkRef("profName"),
      refRName: app.mkRef("rName"), refRLevel: app.mkRef("rLevel"),
      refNuName: app.mkRef("nuName"), refNuEmail: app.mkRef("nuEmail"),

    };
  };
}
