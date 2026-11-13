// Uygulama çekirdeği: durum, oturum yaşam döngüsü ve sunucu işlemleri.
import { shrinkPhoto } from "./photo";
import React from "react";
import { ApiClient } from "../api/client";
import { LIVE_EVENT, LiveFeed, newTabId } from "./live";
import { emptyDomain, mapBootstrap, mapMaster, toInput } from "../api/mappers";
import { LOC, tx } from "../i18n";
import { STATUS_LABEL, ini, localToday } from "../domain/constants";
import { esc } from "../documents/template";
import { printFrame } from "../documents/print";

const STORE_LANG = "dosyapi.lang";
const STORE_THEME = "dosyapi.theme";

function initialState() {
  return {
    ...emptyDomain(),
    session: null, mode: "loading", authMode: "login", authError: "", authInfo: "", masterError: "",
    masterAuthed: false, today: localToday(), tab: "home", recTab: "authors", filters: ["all"], q: "", projectId: null,
    projFilter: "", selAuthors: [], selContractors: [], recView: "card", apTab: "in", apView: "card", roleChoice: {}, sheet: null, draft: {}, toast: "",
    theme: "light", lang: "tr", vw: typeof window === "undefined" ? 1200 : window.innerWidth,
    mSection: "kimlik", projView: "card", notifOpen: false,
    remember: false, profileMenuOpen: false, filterMenuOpen: false, fileQ: "",
    dd: null, fxOpen: {}, mailPreview: null, resetTok: null, totpNeeded: false, masterTotpNeeded: false,
    gen: null, genBusy: "", tplDraft: null, tplMode: "edit", tplDirty: false, edPop: null, edInTable: false, edImg: false,
    tplSide: "vars", tplSample: "", varQ: "", zoom: { gen: "fit", tpl: "fit" }, zoomLbl: {}, varOpen: { genel: true, proje: true },
    tbCols: { muellifler: ["sira", "adSoyad", "meslek", "tc", "telefon"], arsaSahipleri: ["sira", "ad", "tc", "hisse", "imza"] },
    noticeAccepted: false, privacyNotice: "", undo: null, updateInfo: null, backups: null, backupChecks: {}, masterGate: null, audit: [], auditOk: null, dns: null, dnsChecks: [], smtp: null, totpSetup: null, masterTotpSetup: null, recoveryCodes: null, unreadMessages: 0, setupDone: null, busy: "",
  };
}

export class AppCore extends React.Component<any, any> {
  [key: string]: any;
  api = new ApiClient(newTabId());
  deepLinkProject: string | null = null;

  constructor(props: any) {
    super(props);
    this.fd = {};
    this.r = {};
    this._refs = {};
    this._zh = {};
    this.state = initialState();
  }

  async componentDidMount() {
    this.readPreferences();
    this.applyTheme();
    this._rz = () => { if (window.innerWidth !== this.state.vw) this.setState({ vw: window.innerWidth }); };
    window.addEventListener("resize", this._rz);
    this._selH = () => this.onSel();
    document.addEventListener("selectionchange", this._selH);
    this._rbH = (e) => { if (this.state.rbMenu && !(e.target && e.target.closest && e.target.closest("[data-rb]"))) this.setState({ rbMenu: null }); };
    document.addEventListener("mousedown", this._rbH);
    this._escH = (e) => { if (e.key === "Escape") this.closeTopLayer(); };
    document.addEventListener("keydown", this._escH);
    this._unloadH = (e) => { if (this.state.tplDirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", this._unloadH);
    this.applySlots();
    this.scheduleDayTick();
    await this.start();
  }

  /** Yerel gece yarısında "bugün" ilerler; termini dün olan açık görevler o an "süresi geçti" olur. */
  scheduleDayTick() {
    clearTimeout(this._dayT);
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    this._dayT = setTimeout(() => {
      const today = localToday();
      if (today !== this.state.today) { this.setState({ today }); this.announceOverdue(today); }
      this.scheduleDayTick();
    }, Math.min(next.getTime() - now.getTime(), 3600000));
  }

  /** Bana atanmış, süresi geçmiş açık görev varsa bir kez hatırlatır. */
  announceOverdue(today = this.state.today, tasks = this.state.tasks, me = this.state.session) {
    const n = (tasks || []).filter((t) => t.assignee === me && !t.done && t.due && t.due < today).length;
    if (n) this.toast(n === 1 ? tx("Süresi geçmiş 1 göreviniz var.") : tx("Süresi geçmiş {n} göreviniz var.").replace("{n}", String(n)));
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this._rz);
    document.removeEventListener("selectionchange", this._selH);
    document.removeEventListener("mousedown", this._rbH);
    document.removeEventListener("keydown", this._escH);
    window.removeEventListener("beforeunload", this._unloadH);
    clearTimeout(this._ht);
    clearTimeout(this._dayT);
    this.stopLive();
  }

  componentDidUpdate(_p, prev) {
    // Canlı güncelleme yalnızca uygulama oturumunda açıktır (giriş, çıkış, oturum düşmesi).
    if (prev.mode !== this.state.mode) this.state.mode === "app" ? this.startLive() : this.stopLive();
    if (prev.theme !== this.state.theme) this.applyTheme();
    if (prev.lang !== this.state.lang || prev.theme !== this.state.theme) this.savePreferences();
    this.applySlots();
  }

  /** Esc en üstteki katmanı kapatır: menü, form, belge penceresi, açılır listeler. */
  closeTopLayer() {
    const s = this.state;
    if (s.preview) return this.closePreview();
    if (s.rbMenu) return this.setState({ rbMenu: null });
    if (s.sheet) { this.fd = {}; return this.setState({ sheet: null, draft: {} }); }
    if (s.gen) return this.setState({ gen: null });
    if (s.notifOpen || s.profileMenuOpen || s.filterMenuOpen || s.dd) this.setState({ notifOpen: false, profileMenuOpen: false, filterMenuOpen: false, dd: null });
  }

  /** Pencere açılınca odak içeri alınır, kapanınca açan düğmeye döner. */
  dialogRef = (el) => {
    if (el) { this._focusBack = document.activeElement; el.focus(); }
    else if (this._focusBack && this._focusBack.isConnected) { this._focusBack.focus(); this._focusBack = null; }
  };

  /** Tab tuşu pencerenin dışına çıkmaz. */
  dialogKeys = (e) => {
    if (e.key !== "Tab") return;
    const items = Array.from(e.currentTarget.querySelectorAll('button,[href],input,select,textarea,[tabindex="0"]')).filter((n: any) => !n.disabled && n.offsetParent !== null) as any[];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  /** Silme birkaç saniye bekletilir; bu sürede "Geri al" ile vazgeçilebilir. */
  scheduleDelete({ id, label, list, path }) {
    this.flushDelete();
    this.setState((st) => ({ [list]: st[list].filter((x) => x.id !== id), undo: { label }, ...(st.projectId === id ? { projectId: null, tab: "projects" } : {}) }));
    this._undo = { id, path, timer: setTimeout(() => this.flushDelete(), 6000) };
  }

  async flushDelete() {
    const job = this._undo;
    if (!job) return;
    clearTimeout(job.timer);
    this._undo = null;
    this.setState({ undo: null });
    try { await this.api.del(job.path); } catch (e) { this.fail(e); }
    await this.refresh().catch(() => {});
  }

  async undoDelete() {
    const job = this._undo;
    if (!job) return;
    clearTimeout(job.timer);
    this._undo = null;
    this.setState({ undo: null });
    await this.refresh().catch(() => {});
  }

  /** Silinmek üzere bekleyen kayıt, ara tazelemelerde geri gelmesin. */
  withoutPending(data) {
    const job = this._undo;
    if (!job) return data;
    const out = { ...data };
    for (const list of ["projects", "authors", "contractors", "templates"]) out[list] = (out[list] || []).filter((x) => x.id !== job.id);
    return out;
  }

  readPreferences() {
    try {
      const lang = window.localStorage.getItem(STORE_LANG), theme = window.localStorage.getItem(STORE_THEME);
      if (lang === "en" || lang === "tr") this.setState({ lang });
      if (theme === "dark" || theme === "light") this.setState({ theme });
    } catch (e) {}
  }

  savePreferences() {
    try {
      window.localStorage.setItem(STORE_LANG, this.state.lang);
      window.localStorage.setItem(STORE_THEME, this.state.theme);
    } catch (e) {}
  }

  /** Açılış: kurulum, derin bağlantı ve mevcut oturum denetimi. */
  async start() {
    const hash = window.location.hash || "";
    let info: any;
    try {
      info = await this.api.get("/public/info");
    } catch (e) {
      return this.setState({ mode: "auth", authError: tx(e.message) });
    }
    this.setState({
      company: { name: info.companyName, desc: info.companyDesc, logoUrl: info.hasLogo ? "/api/v1/public/logo" : "" },
      palette: { pri: info.pri }, domains: info.domains, domainLock: info.domainLock, privacyNotice: info.privacyNotice,
    });
    if (info.setupRequired) return this.setState({ mode: "setup" });
    const reset = /^#\/sifre-sifirla\?token=([\w-]+)/.exec(hash);
    if (reset) {
      history.replaceState(null, "", window.location.pathname);
      return this.setState({ mode: "auth", authMode: "reset", resetTok: reset[1] });
    }
    if (hash.toLowerCase() === "#sistem") return this.enterMaster();
    const project = /^#\/proje\/([\w-]+)/.exec(hash);
    if (project) this.deepLinkProject = project[1];
    await this.loadSession();
  }

  /** Başka oturumlardaki değişiklikler: sunucu "değişti" der, bootstrap yeniden çekilir.
   *  Ayrıntı için live.ts. Art arda gelen sinyaller tek tazelemede birleşir. */
  startLive() {
    if (!this._live) this._live = new LiveFeed(this.api.tab, (why) => this.liveSignal(why), () => this.liveRefresh());
    this._live.start();
  }
  stopLive() {
    if (this._live) this._live.stop();
    clearTimeout(this._liveT);
  }
  liveSignal(why: "change" | "resync") {
    // Bağlantı kurulduğunda yeni tazelenmişsek ikinci kez çekmeye gerek yok.
    if (why === "resync" && Date.now() - (this._lastRefresh || 0) < 3000) return;
    // Art arda değişikliklerde sekme başına en fazla saniyede bir tazeleme (ofiste aynı IP'yi
    // paylaşan çok sayıda sekme sunucunun IP başına istek sınırını zorlamasın).
    clearTimeout(this._liveT);
    const wait = Math.max(150, 1000 - (Date.now() - (this._lastRefresh || 0)));
    this._liveT = setTimeout(() => this.liveRefresh(), wait);
  }
  async liveRefresh() {
    if (this.state.mode !== "app") return;
    if (this._liveBusy) { this._liveAgain = true; return; }
    this._liveBusy = true;
    try {
      await this.refresh();
      window.dispatchEvent(new Event(LIVE_EVENT));
    } catch (e) {
      if (e && e.status === 401) this.fail(e);
    } finally {
      this._liveBusy = false;
      if (this._liveAgain) { this._liveAgain = false; this.liveSignal("change"); }
    }
  }

  /** Okunmamış mesaj yoklaması: canlı bağlantı kurulamadığında yedek yol (25 sn'de bir). */
  startMessagePoll() {
    if (this._msgPoll) return;
    this._msgPoll = setInterval(() => { if (!document.hidden && !(this._live && this._live.connected)) this.refreshUnread(); }, 25000);
  }
  async refreshUnread() {
    if (this.state.mode !== "app") return;
    try {
      const r = await this.api.get("/messages/unread");
      if (r && r.unread !== this.state.unreadMessages) this.setState({ unreadMessages: r.unread });
    } catch (e) { /* oturum düştüyse bir sonraki istek zaten girişe yönlendirir */ }
  }

  async loadSession() {
    try {
      const data = await this.api.get("/bootstrap");
      this.api.csrf = data.csrf;
      this._lastRefresh = Date.now();
      const mapped = mapBootstrap(data);
      const target = this.deepLinkProject && mapped.projects.some((p) => p.id === this.deepLinkProject) ? this.deepLinkProject : null;
      this.deepLinkProject = null;
      this.setState({ ...mapped, mode: "app", ...(target ? { tab: "detail", projectId: target } : {}) });
      this.announceOverdue(localToday(), mapped.tasks, mapped.session);
      this.startMessagePoll();
    } catch (e) {
      if (e.status === 401) this.setState({ mode: "auth", session: null });
      else this.setState({ mode: "auth", authError: tx(e.message) });
    }
  }

  async enterMaster() {
    this.fd = {};
    this.setState({ mode: "master", masterError: "" });
    try {
      await this.loadMaster();
    } catch (e) {
      this.setState({ masterAuthed: false });
      await this.loadGate();
    }
  }

  /** Giriş ekranı durumu: açık, geçici kilitli ya da konsoldan devre dışı. */
  async loadGate() {
    clearTimeout(this._gateT);
    let gate = null;
    try { gate = await this.api.get("/master/gate"); } catch (e) {}
    this.setState({ masterGate: gate });
    // Kilitliyken geri sayım dakikada bir tazelenir; süre dolunca giriş formu kendiliğinden açılır.
    if (gate && gate.state === "locked") {
      const wait = Math.max(1000, Math.min(gate.until * 1000 - Date.now() + 1000, 60000));
      this._gateT = setTimeout(() => { if (this.state.mode === "master" && !this.state.masterAuthed) this.loadGate(); }, wait);
    }
  }

  async loadMaster() {
    const data = await this.api.get("/master/state");
    this.api.csrf = data.csrf;
    this.setState({ ...mapMaster(data), masterAuthed: true, masterError: "", masterTotpNeeded: false });
  }

  async refresh() {
    if (this.state.mode === "master") return this.loadMaster();
    if (this.state.mode === "app") {
      const data = await this.api.get("/bootstrap");
      this.api.csrf = data.csrf;
      this._lastRefresh = Date.now();
      const next = this.withoutPending(mapBootstrap(data));
      // Açık proje başka bir oturumda silindiyse (ya da erişim kalktıysa) listeye dön.
      const gone = this.state.tab === "detail" && this.state.projectId && !next.projects.some((p) => p.id === this.state.projectId);
      this.setState({ ...next, ...(gone ? { tab: "projects", projectId: null, sheet: null } : {}) });
      if (gone) this.toast(tx("Açık olan proje artık erişilebilir değil."));
    }
  }

  fail(error: any) {
    if (error && error.status === 401 && this.state.mode === "app") {
      this.setState({ session: null, mode: "auth", authMode: "login", sheet: null, authError: tx(error.message) });
      return;
    }
    if (error && error.status === 401 && this.state.mode === "master") {
      this.setState({ masterAuthed: false, masterError: tx(error.message) });
      return;
    }
    this.toast(tx(error?.message || "İşlem tamamlanamadı."));
  }

  /** Sunucu işlemini yürütür, durumu tazeler ve sonucu bildirir. */
  async act(work: () => Promise<any>, success?: string) {
    try {
      const result = await work();
      await this.refresh();
      if (success) this.toast(success);
      return result;
    } catch (e) {
      this.fail(e);
      return undefined;
    }
  }

  async login() {
    const { email = "", pass = "", code = "" } = this.fd;
    try {
      await this.api.post("/auth/login", { email, password: pass, code: code || null, remember: this.state.remember });
      this.fd = {};
      this.setState({ tab: "home", authError: "", authInfo: "", totpNeeded: false });
      await this.loadSession();
    } catch (e) {
      if (e.code === "totp_required") return this.setState({ totpNeeded: true, authError: "", authInfo: "" });
      this.setState({ authError: tx(e.message), authInfo: "" });
    }
  }

  async register() {
    const { name = "", email = "", phone = "", pass = "" } = this.fd;
    if (!name.trim() || !email.trim()) return this.setState({ authError: tx("Tüm alanları doldurun."), authInfo: "" });
    try {
      await this.api.post("/auth/register", { name, email, phone, password: pass, acceptedNotice: !!this.state.noticeAccepted });
      this.fd = {};
      this.setState({ authMode: "login", authError: "", authInfo: tx("Kayıt talebiniz oluşturuldu. Yönetici onayı sonrası giriş yapabilirsiniz.") });
    } catch (e) {
      this.setState({ authError: tx(e.message), authInfo: "" });
    }
  }

  async forgot() {
    const email = (this.fd.fEmail || "").trim();
    if (!email) return this.setState({ authError: tx("E-posta adresinizi girin."), authInfo: "" });
    try {
      await this.api.post("/auth/forgot", { email });
      this.fd = {};
      this.setState({ authMode: "login", authError: "", authInfo: tx("Bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi.") });
    } catch (e) {
      this.setState({ authError: tx(e.message), authInfo: "" });
    }
  }

  async resetPassword() {
    const a = this.fd.rNew || "", b = this.fd.rNew2 || "";
    if (a !== b) return this.setState({ authError: tx("Şifre ile onayı aynı değil."), authInfo: "" });
    try {
      await this.api.post("/auth/reset", { token: this.state.resetTok, password: a });
      this.fd = {};
      this.setState({ authMode: "login", resetTok: null, authError: "", authInfo: tx("Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.") });
    } catch (e) {
      this.setState({ authError: tx(e.message), authInfo: "" });
    }
  }

  async logout() {
    try { await this.api.post("/auth/logout", {}); } catch (e) {}
    this.fd = {};
    this._zh = {};
    this.api.csrf = "";
    this.setState({ ...emptyDomain(), company: this.state.company, palette: this.state.palette, session: null, mode: "auth", authMode: "login", tab: "home", sheet: null, authInfo: "", profileMenuOpen: false, notifOpen: false, gen: null, tplDraft: null, tplDirty: false, selAuthors: [], projectId: null, draft: {} });
  }

  async completeSetup() {
    const f = this.fd;
    if ((f.sMaster || "") !== (f.sMaster2 || "")) return this.setState({ authError: tx("Master şifre ile onayı aynı değil.") });
    if ((f.sAdminPass || "") !== (f.sAdminPass2 || "")) return this.setState({ authError: tx("Şifre ile onayı aynı değil.") });
    try {
      await this.api.post("/setup", {
        setupToken: (f.sToken || "").trim(), companyName: f.sCompany || "", masterPassword: f.sMaster || "",
        adminName: f.sAdminName || "", adminEmail: f.sAdminEmail || "", adminPassword: f.sAdminPass || "",
      });
      // Sihirbaz "Kurulum tamamlandı" özetini gösterir; girişe geçiş kullanıcının düğmesiyle.
      this.setState({ authError: "", setupDone: { company: f.sCompany || "", adminName: f.sAdminName || "", adminEmail: f.sAdminEmail || "" } });
      this.fd = {};
      return "ok";
    } catch (e) {
      this.setState({ authError: tx(e.status === 403 ? "Kurulum belirteci hatalı." : e.message) });
      return e.status === 403 ? "token" : "error";
    }
  }

  async finishSetup() {
    this.setState({ setupDone: null, authError: "", authInfo: tx("Kurulum tamamlandı. Yönetici hesabınızla giriş yapın."), mode: "auth", authMode: "login" });
    await this.start();
  }

  async masterLogin() {
    try {
      await this.api.post("/master/login", { password: this.fd.mPass || "", code: this.fd.mCode || null });
      this.fd = {};
      await this.loadMaster();
    } catch (e) {
      if (e.code === "totp_required") return this.setState({ masterTotpNeeded: true, masterError: "" });
      if (e.status === 423) { this.setState({ masterError: "", masterTotpNeeded: false }); return this.loadGate(); }
      this.setState({ masterError: tx(e.message) });
    }
  }

  async closeMaster() {
    try { await this.api.post("/master/logout", {}); } catch (e) {}
    this.fd = {};
    this.api.csrf = "";
    this.setState({ ...emptyDomain(), company: this.state.company, palette: this.state.palette, mode: "auth", masterAuthed: false, masterError: "", masterGate: null, backups: null, backupChecks: {}, dns: null, smtp: null, updateInfo: null, audit: [] });
    window.location.hash = "";
    await this.start();
  }

  /** Sistem paneli bölümünün verisini yükler. */
  async loadSection(section) {
    try {
      if (section === "dns") this.setState({ dns: await this.api.get("/master/dns") });
      if (section === "eposta") this.setState({ smtp: await this.api.get("/master/smtp") });
      if (section === "sistem") this.setState({ backups: await this.api.get("/master/backups"), updateStatus: await this.api.get("/master/update/status") });
      if (section === "guvenlik") this.setState({ audit: await this.api.get("/master/audit") });
    } catch (e) { this.fail(e); }
  }

  saveRole(role, patch) {
    const next = { ...role, ...patch };
    this.setState((st) => ({ roles: st.roles.map((r) => (r.id === role.id ? next : r)) }));
    clearTimeout(this._roleT);
    this._roleT = setTimeout(() => {
      this.act(() => this.api.put("/master/roles/" + role.id, { name: next.name, level: next.level, perms: next.perms }));
    }, 350);
  }

  showLink(result, user) {
    if (result.emailed) this.toast(user.email + tx(" adresine bağlantı gönderildi."));
    else this.setState({ sheet: { type: "mail" }, mailPreview: { to: user.email, name: user.name, link: result.link } });
  }

  async issueLink(user) {
    try { this.showLink(await this.api.post("/master/users/" + user.id + "/reset-link", {}), user); }
    catch (e) { this.fail(e); }
  }

  async addUser(input) {
    const result = await this.act(() => this.api.post("/master/users", input), input.name + tx(" oluşturuldu."));
    if (result) this.showLink(result, input);
  }

  async checkUpdate() {
    this.setState({ busy: "update" });
    try { this.setState({ updateInfo: await this.api.post("/master/update/check", {}) }); }
    catch (e) { this.fail(e); }
    this.setState({ busy: "" });
  }

  async uploadFiles(projectId, docTypeId, files) {
    let queued = false, done = 0;
    this.setState({ busy: "upload" });
    try {
      for (const file of files) {
        const query = "?name=" + encodeURIComponent(file.name) + (docTypeId ? "&docType=" + docTypeId : "");
        const result = await this.api.upload("/projects/" + projectId + "/files" + query, file);
        queued = queued || result.result === "queued";
        done++;
      }
      this.toast(queued ? tx("Belge üst kademe onayına gönderildi.") : done + tx(" dosya yüklendi."));
    } catch (e) { this.fail(e); }
    this.setState({ busy: "" });
    await this.refresh().catch(() => {});
  }

  async removeFile(id, name) {
    const result = await this.act(() => this.api.del("/files/" + id));
    if (result === "queued") this.toast(tx("Belge üst kademe onayına gönderildi."));
    else if (result) this.toast(name + tx(" kaldırıldı"));
  }

  async commit(kind, entity, payload, title) {
    const base = { project: "/projects", author: "/authors", contractor: "/contractors" }[entity];
    const result = await this.act(() =>
      kind === "create" ? this.api.post(base, toInput(entity, payload))
        : kind === "update" ? this.api.put(base + "/" + payload.id, toInput(entity, payload))
          : this.api.del(base + "/" + payload.id));
    if (result) {
      this.toast(result.result === "queued" ? tx("Talep üst kademe onayına gönderildi.") : title + tx(" uygulandı."));
      this.fd = {};
      this.setState({ sheet: null, draft: {} });
    }
    return !!result;
  }

  async uploadPhoto(projectId, file) {
    this.setState({ busy: "photo" });
    try {
      let blob;
      try { blob = await shrinkPhoto(file); }
      catch (e) { this.toast(tx("Bu görsel açılamadı; JPEG veya PNG seçin.")); return; }
      await this.api.raw("PUT", "/projects/" + projectId + "/photo", blob);
      await this.refresh();
      this.toast(tx("Proje fotoğrafı güncellendi."));
    } catch (e) { this.fail(e); }
    finally { this.setState({ busy: "" }); }
  }

  removePhoto(projectId) {
    return this.act(() => this.api.del("/projects/" + projectId + "/photo"), tx("Proje fotoğrafı kaldırıldı."));
  }

  rootRef() {
    return this._mref || (this._mref = (elm) => {
      if (!elm) { if (this._ro) { this._ro.disconnect(); this._ro = null; } return; }
      const upd = () => { const w = elm.getBoundingClientRect().width; if (w && Math.abs(w - this.state.vw) > 1) this.setState({ vw: w }); };
      upd();
      if (!this._ro && typeof ResizeObserver !== "undefined") { this._ro = new ResizeObserver(upd); this._ro.observe(elm); }
    });
  }
  clearFields() {
    Array.prototype.slice.call(arguments).forEach(n => { delete this.fd[n]; if (this.r[n]) this.r[n].value = ""; });
  }

  /** Proje formundaki listelerin sonundaki "+ ekle": Kayıtlar'a gider ve yeni kayıt penceresini açar. */
  goAddRecord(kind: "author" | "contractor", job?: string) {
    this.fd = {};
    this.setState({ tab: "records", recTab: kind === "author" ? "authors" : "contractors", notifOpen: false,
      sheet: { type: kind }, draft: kind === "author" && job ? { jobs: [job] } : {} });
  }

  /** Önizlenebilir tür: tarayıcının güvenle gösterebildikleri. Tür, sunucunun ikili olarak
   *  verdiği içerikten değil dosya adından belirlenir ve blob'a açıkça yazılır. */
  previewKind(name) {
    const ext = ((name || "").split(".").pop() || "").toLowerCase();
    if (ext === "pdf") return "pdf";
    if (["png", "jpg", "jpeg", "webp", "gif"].indexOf(ext) > -1) return "image";
    if (["txt", "csv"].indexOf(ext) > -1) return "text";
    return null;
  }
  async openPreview(name, url) {
    const kind = this.previewKind(name);
    if (!kind || !url) return this.download(name, url);
    this.closePreview();
    this.setState({ preview: { name, url, kind, src: "", text: "", error: "" } });
    const fail = (error) => { if (this.state.preview && this.state.preview.url === url) this.setState({ preview: { ...this.state.preview, error } }); };
    try {
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) return fail(res.status === 401 ? tx("Oturum süresi doldu.") : tx("Dosya açılamadı."));
      const len = Number(res.headers.get("content-length") || 0);
      if (len > 60 * 1024 * 1024) return fail(tx("Dosya önizleme için çok büyük; indirerek açın."));
      const buf = await res.arrayBuffer();
      if (!this.state.preview || this.state.preview.url !== url) return;
      if (kind === "text") {
        const text = new TextDecoder().decode(buf.slice(0, 400 * 1024));
        return this.setState({ preview: { ...this.state.preview, text } });
      }
      const ext = (name.split(".").pop() || "").toLowerCase();
      const type = kind === "pdf" ? "application/pdf" : "image/" + (ext === "jpg" ? "jpeg" : ext);
      const src = URL.createObjectURL(new Blob([buf], { type }));
      this._previewUrl = src;
      this.setState({ preview: { ...this.state.preview, src } });
    } catch (e) { fail(tx("Dosya açılamadı.")); }
  }
  closePreview() {
    if (this._previewUrl) { URL.revokeObjectURL(this._previewUrl); this._previewUrl = null; }
    if (this.state.preview) this.setState({ preview: null });
  }

  download(name, url) {
    if (!name) return this.toast(tx("İndirilecek dosya yok."));
    const a = document.createElement("a");
    a.download = name;
    a.href = url || ("data:text/plain;charset=utf-8," + encodeURIComponent(tx("Sunucu kopyası: ") + name + "\n" + this.state.company.name));
    document.body.appendChild(a); a.click(); a.remove();
    this.toast(name + tx(" indiriliyor."));
  }

  emailAllowed(email) {
    const s = this.state, d = s.domains || [];
    if (!s.domainLock || !d.length) return true;
    return d.indexOf(((email || "").split("@")[1] || "").toLowerCase()) > -1;
  }

  me() { return this.state.users.find(u => u.id === this.state.session) || null; }
  roleOf(u) { return this.state.roles.find(r => r.id === (u && u.roleId)) || null; }
  myRole() { return this.roleOf(this.me()); }
  lvl() { const r = this.myRole(); return r ? r.level : 99; }
  top() { return this.lvl() === 1; }
  perm(k) { const r = this.myRole(); if (!r) return false; if (r.level === 1) return true; return !!r.perms[k]; }
  projMode() { const r = this.myRole(); return r ? (r.level === 1 ? "edit" : r.perms.projects) : "none"; }
  recMode() { const r = this.myRole(); return r ? (r.level === 1 ? "edit" : r.perms.records) : "none"; }
  manageableRoles() {
    const r = this.myRole(); if (!r) return [];
    if (r.level === 1) return this.state.roles.filter(x => x.level > 1);
    if (!r.perms.users) return [];
    return this.state.roles.filter(x => x.level > r.level && r.perms.manage.indexOf(x.id) > -1);
  }
  toast(t) { this.setState({ toast: t }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: "" }), 2800); }
  stamp() { const d = new Date(); return d.toLocaleDateString(LOC(), { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString(LOC(), { hour: "2-digit", minute: "2-digit" }); }

  docRows(kind, o) {
    const s = this.state;
    if (kind === "project") {
      const names = (o.assignments || []).map(x => { const a = s.authors.find(y => y.id === x.authorId); return a ? a.first + " " + a.last + " (" + x.job + ")" : ""; }).filter(Boolean);
      const docs = s.docTypes.map(d => d.name + ": " + ((o.docs || {})[d.id] ? tx("var") : d.required ? tx("EKSİK") : "—")).join(", ");
      return [
        { k: tx("İnşaat adı"), v: o.name }, { k: tx("Müteahhit firma"), v: o.contractor },
        { k: tx("Mahalle"), v: o.mahalle || "—" }, { k: tx("Cadde / sokak"), v: o.street || "—" },
        { k: tx("Ada / Parsel"), v: o.ada + " / " + o.parsel },
        { k: tx("Proje durumu"), v: STATUS_LABEL(o.status || (o.done ? "iskan" : "uygulama")) },
        { k: tx("Müellifler"), v: names.join(", ") || "—" },
        { k: tx("Belge durumu"), v: docs },
        { k: tx("Not"), v: o.note || "—" },
      ];
    }
    if (kind === "author") return [
      { k: tx("TC Kimlik No"), v: o.tc }, { k: tx("Ad Soyad"), v: o.first + " " + o.last },
      { k: tx("Meslek"), v: (o.jobs || []).join(", ") }, { k: tx("Şirket"), v: o.company }, { k: tx("Telefon"), v: o.phone },
    ];
    return [
      { k: tx("Firma unvanı"), v: o.title }, { k: tx("Yetkili"), v: o.owner },
      { k: tx("Yetki belge no"), v: o.licence }, { k: tx("Sınıfı"), v: o.rank }, { k: tx("Adres"), v: o.address },
    ];
  }

  printWindow(title, bodyHtml) {
    const c0 = this.state.company, pri = /^#[0-9a-fA-F]{3,8}$/.test(this.state.palette.pri || "") ? this.state.palette.pri : "#1E4FD8";
    const c = { ...c0, name: esc(c0.name) }, mono = esc(ini(c0.name));
    title = esc(title);
    printFrame('<html><head><meta charset="utf-8"><title>' + title + '</title></head><body style="font-family:system-ui,sans-serif;margin:44px;color:#202020"><div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid ' + pri + ';padding-bottom:14px"><div style="width:46px;height:46px;border-radius:10px;background:' + pri + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800">' + mono + '</div><div style="flex:1"><div style="font-size:18px;font-weight:800">' + c.name + '</div><div style="font-size:12px;color:#646464">' + title + '</div></div><div style="font-size:11px;color:#646464">' + new Date().toLocaleDateString(LOC()) + '</div></div>' + bodyHtml + '<div style="margin-top:64px;text-align:right"><div style="display:inline-block;border-top:1px solid #202020;padding-top:6px;font-size:11px;color:#646464;width:190px;text-align:center">' + tx("Kaşe / İmza") + '</div></div></body></html>');
  }

  printAuthorTable(list, subtitle) {
    if (!list.length) { this.toast(tx("Yazdırmak için müellif seçin.")); return; }
    const rows = list.map((a, i) => '<tr><td style="padding:9px 6px;border-bottom:1px solid #e4e4e7;font-size:12px">' + (i + 1) + '</td><td style="padding:9px 6px;border-bottom:1px solid #e4e4e7;font-size:13px;font-weight:600">' + esc(a.first + " " + a.last) + '</td><td style="padding:9px 6px;border-bottom:1px solid #e4e4e7;font-size:12px">' + esc((a.jobs || []).join(", ")) + '</td><td style="padding:9px 6px;border-bottom:1px solid #e4e4e7;font-size:12px">' + esc(a.tc) + '</td><td style="padding:9px 6px;border-bottom:1px solid #e4e4e7;font-size:12px">' + esc(a.company) + '</td><td style="padding:9px 6px;border-bottom:1px solid #e4e4e7;font-size:12px">' + esc(a.phone) + '</td></tr>').join("");
    this.printWindow(tx("Yapı Denetim Müellif Listesi"), '<div style="font-size:12px;color:#646464;margin-top:14px">' + esc(subtitle) + '</div><table style="width:100%;border-collapse:collapse;margin-top:12px"><thead><tr><th style="text-align:left;padding:8px 6px;font-size:10.5px;letter-spacing:.5px;color:#646464;border-bottom:2px solid #202020">#</th><th style="text-align:left;padding:8px 6px;font-size:10.5px;letter-spacing:.5px;color:#646464;border-bottom:2px solid #202020">' + tx("AD SOYAD") + '</th><th style="text-align:left;padding:8px 6px;font-size:10.5px;letter-spacing:.5px;color:#646464;border-bottom:2px solid #202020">' + tx("MESLEK") + '</th><th style="text-align:left;padding:8px 6px;font-size:10.5px;letter-spacing:.5px;color:#646464;border-bottom:2px solid #202020">' + tx("TC NO") + '</th><th style="text-align:left;padding:8px 6px;font-size:10.5px;letter-spacing:.5px;color:#646464;border-bottom:2px solid #202020">' + tx("ŞİRKET") + '</th><th style="text-align:left;padding:8px 6px;font-size:10.5px;letter-spacing:.5px;color:#646464;border-bottom:2px solid #202020">' + tx("TELEFON") + '</th></tr></thead><tbody>' + rows + '</tbody></table>');
  }

}
