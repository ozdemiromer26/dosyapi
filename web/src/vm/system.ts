// Görünüm modeli: kurulum, DNS, e-posta, güncelleme, yedek ve güvenlik panelleri.
import type { Ctx, Vals } from "./types";
import { LOC, tx } from "../i18n";
import { DMARK } from "../ui/icons";
import { fmtBytes, fmtStamp } from "../api/mappers";
import { TABLE_PRESETS, customTable, presetTable } from "../documents/presets";
import { boardHtml } from "../documents/board";
import { printFrame } from "../documents/print";

const STATE_LABEL: Record<string, string> = { ok: "Doğru", missing: "Eksik", mismatch: "Farklı değer" };

export function buildSystem(c: Ctx): () => Vals {
  const app = c.app;
  const s = app.state;
  const fd = () => app.fd;
  const dns = s.dns || { config: {}, hasToken: false, providers: [] };
  const config = { domain: "", zone: "", ipv4: "", ipv6: "", provider: "manual", acme: false, acmeEmail: "", ...dns.config };
  const acme = s.dnsAcme ?? config.acme;
  const smtp = s.smtp || { host: "", port: 587, username: "", from: "", tls: "starttls", hasPassword: false };

  const printBoard = async () => {
    const project = s.projects.find((p) => p.id === s.projectId);
    if (!project) return;
    try {
      const response = await fetch("/api/v1/projects/" + project.id + "/board-qr", { credentials: "same-origin" });
      if (!response.ok) throw new Error();
      const architect = (project.authorIds || []).map((id) => s.authors.find((a) => a.id === id)).find((a) => a && /mimar/i.test(a.job || ""));
      printFrame(boardHtml({
        name: project.name, contractor: project.contractor, location: [project.mahalle, project.street].filter(Boolean).join(", "),
        architect: architect ? architect.first + " " + architect.last : "", company: s.company.name, slogan: tx("Şantiyenin dosyası cebinde."), qrSvg: await response.text(),
      }));
    } catch (e) { app.toast(tx("Pano oluşturulamadı.")); }
  };

  return () => ({
    sheetIsMail: (s.sheet || {}).type === "mail",
    mailTo: (s.mailPreview || {}).to || "", mailLink: (s.mailPreview || {}).link || "",
    copyLink: () => { navigator.clipboard?.writeText((s.mailPreview || {}).link || ""); app.toast(tx("Bağlantı kopyalandı.")); },
    isLoading: s.mode === "loading",
    isSetup: s.mode === "setup",
    completeSetup: () => app.completeSetup(),
    // Sihirbaz alanları kendi durumunda tutar; son adımda tek istekle gönderir.
    completeSetupWith: (f) => { app.fd = { ...f }; return app.completeSetup(); },
    finishSetup: () => app.finishSetup(),
    setupDone: s.setupDone, clearAuthError: () => app.setState({ authError: "" }),
    brandMarkLg: DMARK(56),
    totpNeeded: s.totpNeeded, masterTotpNeeded: s.masterTotpNeeded,
    busy: s.busy,

    tblPresets: TABLE_PRESETS.map((p) => ({ id: p.id, label: tx(p.label), onPick: () => { app.setState({ rbMenu: null }); app.edInsert(presetTable(p), true); } })),
    tblCustom: () => {
      const cols = parseInt(fd().tcCols, 10) || 4, rows = parseInt(fd().tcRows, 10) || 4;
      app.setState({ rbMenu: null });
      app.edInsert(customTable(cols, rows), true);
    },
    tblInsert: (cols, rows, header) => { app.setState({ rbMenu: null }); app.edInsert(customTable(cols, rows, header), true); },
    printBoard,
    undoLabel: s.undo ? s.undo.label : "", undoDelete: () => app.undoDelete(),
    dialogRef: app.dialogRef, dialogKeys: app.dialogKeys,
    hasNotice: !!s.privacyNotice, noticeText: s.privacyNotice || "", noticeKey: "notice:" + (s.privacyNotice || "").length,
    noticeAccepted: s.noticeAccepted, noticeMark: s.noticeAccepted ? "✓" : "",
    noticeCheckStyle: "width:20px;height:20px;flex:none;margin-top:1px;border-radius:5px;font-size:12px;font-weight:800;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;" + (s.noticeAccepted ? "background:var(--pri,#2a3180);color:#fff;border:1px solid var(--pri,#2a3180)" : "background:var(--card);color:transparent;border:1px solid var(--line)"),
    toggleNotice: () => app.setState((st) => ({ noticeAccepted: !st.noticeAccepted })),
    openNotice: () => app.setState({ sheet: { type: "notice" } }),
    sheetIsNotice: (s.sheet || {}).type === "notice",
    saveNotice: () => app.act(() => app.api.put("/master/notice", { text: fd().lgNotice ?? s.privacyNotice ?? "" }), tx("Aydınlatma metni kaydedildi.")),

    dnsConfig: config, dnsHasToken: dns.hasToken, dnsKey: "dns:" + (s.dns ? 1 : 0), dnsAcmeOn: acme,
    dnsProviders: [{ id: "manual", label: tx("Elle (kayıtları kendim girerim)") }].concat((dns.providers || []).map((p) => ({ id: p, label: p === "cloudflare" ? "Cloudflare" : p }))),
    dnsCanPush: (fd().dProvider ?? config.provider) === "cloudflare" && config.provider === "cloudflare",
    dnsToggleAcme: () => app.setState({ dnsAcme: !acme }),
    dnsAcmeTrack: "width:44px;height:24px;flex:none;border-radius:999px;display:flex;align-items:center;padding:3px;transition:background .15s;justify-content:" + (acme ? "flex-end" : "flex-start") + ";background:" + (acme ? "var(--pri,#1E4FD8)" : "var(--mline2)"),
    dnsAcmeKnob: "width:18px;height:18px;border-radius:50%;display:block;background:#fff",
    dnsSave: () => {
      const f = fd();
      const body = {
        domain: f.dDomain ?? config.domain, zone: f.dZone ?? config.zone, ipv4: f.dIpv4 ?? config.ipv4, ipv6: f.dIpv6 ?? config.ipv6,
        provider: f.dProvider ?? config.provider, acme, acmeEmail: f.dAcmeEmail ?? config.acmeEmail, apiToken: f.dToken || "",
      };
      app.act(() => app.api.put("/master/dns", body).then(() => app.loadSection("dns")), tx("DNS ayarları kaydedildi."));
    },
    dnsCheck: async () => {
      app.setState({ busy: "dns" });
      try { app.setState({ dnsChecks: await app.api.post("/master/dns/check", {}) }); } catch (e) { app.fail(e); }
      app.setState({ busy: "" });
    },
    dnsPush: () => app.act(() => app.api.post("/master/dns/push", {}), tx("Kayıtlar sağlayıcıya yazıldı.")),
    dnsChecks: (s.dnsChecks || []).map((r) => ({ ...r, stateLabel: tx(STATE_LABEL[r.state] || r.state), purpose: tx(r.purpose) })),
    noDnsChecks: !(s.dnsChecks || []).length,

    smtp, smtpKey: "smtp:" + (s.smtp ? 1 : 0),
    smtpSave: () => {
      const f = fd();
      const body = { host: f.mhHost ?? smtp.host, port: parseInt(f.mhPort ?? smtp.port, 10) || 587, username: f.mhUser ?? smtp.username, password: f.mhPass || "", from: f.mhFrom ?? smtp.from, tls: f.mhTls ?? smtp.tls };
      app.act(() => app.api.put("/master/smtp", body).then(() => app.loadSection("eposta")), tx("E-posta ayarları kaydedildi."));
    },
    smtpTest: () => app.act(() => app.api.post("/master/smtp/test", { to: fd().mhTest || "" }), tx("Test e-postası gönderildi.")),

    channelOptions: [{ id: "stable", label: tx("Kararlı") }, { id: "beta", label: tx("Beta") }, { id: "dev", label: tx("Geliştirici") }],
    sysVersion: s.system.version, sysChannel: s.system.channel || "stable",
    aboutDate: s.system.installedAt ? new Date(s.system.installedAt * 1000).toLocaleDateString(LOC(), { day: "numeric", month: "long", year: "numeric" }) : "—",
    aboutDeveloper: s.system.developer || "—",
    onChannel: (e) => app.act(() => app.api.put("/master/update/channel", { channel: e.target.value }), tx("Sistem ayarları kaydedildi.")),
    updateInfo: s.updateInfo, updateStatus: s.updateStatus,
    applyUpdate: async () => {
      app.setState({ busy: "apply" });
      const password = fd().uPass || "";
      await app.act(() => app.api.post("/master/update/apply", { password }), tx("Güncelleme başlatıldı; sistem kısa süre içinde yeniden açılacak."));
      app.setState({ busy: "" });
    },
    backupRows: (s.backups || []).map((b) => ({ ...b, meta: fmtBytes(b.size) + " · " + fmtStamp(b.at) })),
    noBackups: !(s.backups || []).length,
    createBackup: () => app.act(() => app.api.post("/master/backups", {}).then(() => app.loadSection("sistem")), tx("Yedek alındı.")),
    factoryReset: async () => {
      const f = fd();
      try {
        await app.api.post("/master/factory-reset", { password: f.frPass || "", confirm: f.frConfirm || "" });
        window.location.href = "/";
      } catch (e) { app.fail(e); }
    },

    masterTotpOn: s.system.totpEnabled, masterTotpSetup: s.masterTotpSetup, masterPassKey: "mp",
    masterTotpCancel: () => app.setState({ masterTotpSetup: null }),
    masterTotpBegin: async () => { try { app.setState({ masterTotpSetup: await app.api.post("/master/totp/begin", {}) }); } catch (e) { app.fail(e); } },
    masterTotpConfirm: () => app.act(() => app.api.post("/master/totp/confirm", { secret: s.masterTotpSetup.secret, code: fd().mtCode || "" }).then(() => app.setState({ masterTotpSetup: null })), tx("İki adımlı doğrulama açıldı.")),
    masterTotpDisable: () => app.act(() => app.api.post("/master/totp/disable", { password: fd().mtPass || "" }), tx("İki adımlı doğrulama kapatıldı.")),
    auditRows: (s.audit || []).map((a) => ({ ...a, when: fmtStamp(a.at) })),
    auditOk: s.auditOk,
    auditVerify: async () => { try { app.setState({ auditOk: (await app.api.get("/master/audit/verify")).intact }); } catch (e) { app.fail(e); } },

    meTotp: s.meTotp, totpSetup: s.totpSetup,
    refPtPass: app.mkRef("ptPass"), refPtCode: app.mkRef("ptCode"),
    totpCancel: () => { app.clearFields("ptCode"); app.setState({ totpSetup: null }); },
    totpBegin: async () => { try { app.setState({ totpSetup: await app.api.post("/profile/totp/begin", {}) }); } catch (e) { app.fail(e); } },
    totpConfirm: () => app.act(() => app.api.post("/profile/totp/confirm", { code: fd().ptCode || "" }).then((r) => { app.clearFields("ptCode"); app.setState({ totpSetup: null, recoveryCodes: r.recoveryCodes || [] }); }), tx("İki adımlı doğrulama açıldı.")),
    recoveryCodes: s.recoveryCodes || null,
    meRecoveryLeft: s.meRecoveryLeft || 0,
    recoveryDone: () => app.setState({ recoveryCodes: null }),
    recoveryCopy: () => {
      const text = (s.recoveryCodes || []).join("\n");
      navigator.clipboard.writeText(text).then(() => app.toast(tx("Kodlar kopyalandı.")), () => app.toast(tx("Kopyalanamadı; kodları elle not alın.")));
    },
    recoveryDownload: () => {
      const body = tx("dosyapı kurtarma kodları") + " · " + (s.company.name || "") + "\n" + tx("Her kod yalnızca bir kez kullanılabilir.") + "\n\n" + (s.recoveryCodes || []).join("\n") + "\n";
      const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
      app.download("dosyapi-kurtarma-kodlari.txt", url);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    },
    recoveryRegenerate: () => {
      const password = fd().ptPass || "";
      if (!password) return app.toast(tx("Yeni kod üretmek için mevcut şifrenizi girin."));
      app.clearFields("ptPass");
      app.act(() => app.api.post("/profile/totp/recovery", { password }).then((r) => app.setState({ recoveryCodes: r.recoveryCodes || [] })), tx("Yeni kurtarma kodları üretildi; eskileri artık geçmez."));
    },
    totpDisable: () => {
      const password = fd().ptPass || "";
      if (!password) return app.toast(tx("Kapatmak için mevcut şifrenizi girin."));
      app.clearFields("ptPass");
      app.act(() => app.api.post("/profile/totp/disable", { password }), tx("İki adımlı doğrulama kapatıldı."));
    },
    logoutOthers: () => app.act(() => app.api.post("/profile/logout-others", {}), tx("Diğer oturumlar kapatıldı.")),
  });
}
