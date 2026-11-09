import { LOC } from "../i18n";

/** API yanıtlarını ekranların beklediği biçime çevirir. */

export const fmtBytes = (n: number) =>
  !n ? "" : n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";

const date = (ts: number) => new Date(ts * 1000);
export const fmtDay = (ts: number) => (ts ? date(ts).toLocaleDateString(LOC(), { day: "2-digit", month: "short" }) : "");
export const fmtStamp = (ts: number) =>
  ts ? fmtDay(ts) + " " + date(ts).toLocaleTimeString(LOC(), { hour: "2-digit", minute: "2-digit" }) : "";

const mapFile = (f: any) => ({ id: f.id, name: f.name, size: fmtBytes(f.size), at: fmtDay(f.at), by: f.by, url: f.url });

export function mapDocs(docs: Record<string, any[]>) {
  const out: Record<string, any> = {};
  for (const [key, list] of Object.entries(docs || {})) {
    if (!list.length) continue;
    const files = list.map(mapFile);
    const last = files[files.length - 1];
    out[key] = { name: last.name, at: last.at, url: last.url, files };
  }
  return out;
}

const mapCompany = (company: any) => ({
  ...company,
  logoUrl: company.hasLogo ? "/api/v1/public/logo?v=" + Date.now() : "",
});

function mapCommon(data: any) {
  return {
    company: mapCompany(data.company),
    palette: data.palette,
    domains: data.domains,
    domainLock: data.domainLock,
    roles: data.roles,
    docTypes: data.docTypes,
  };
}

export function mapBootstrap(data: any) {
  return {
    ...mapCommon(data),
    session: data.me.id,
    meTotp: data.me.totpEnabled,
    users: data.users,
    professions: data.professions.map((p: any) => p.name),
    profRequired: Object.fromEntries(data.professions.map((p: any) => [p.name, p.required])),
    projects: data.projects.map((p: any) => ({ ...p, docs: mapDocs(p.docs), files: p.files.map(mapFile) })),
    authors: data.authors,
    contractors: data.contractors,
    tasks: data.tasks,
    todos: data.todos,
    pendings: data.pendings.map((p: any) => ({ ...p, when: fmtStamp(p.when) })),
    history: data.history.map((h: any) => ({
      ...h,
      when: fmtStamp(h.when),
      dotStyle: "width:8px;height:8px;flex:none;border-radius:50%;background:" + (h.ok ? "var(--okdot)" : "var(--line)"),
    })),
    templates: data.templates.map((t: any) => ({ ...t, updated: fmtStamp(t.updated) })),
    system: { version: data.version, installedAt: data.installedAt || 0, developer: data.developer || "" },
  };
}

export function mapMaster(data: any) {
  return {
    ...mapCommon(data),
    users: data.users,
    projects: data.projects.map((p: any) => ({ ...p, docs: mapDocs(p.docs), files: p.files.map(mapFile) })),
    domainConflicts: data.domainConflicts,
    system: {
      version: data.version,
      channel: data.channel,
      installedAt: data.installedAt || 0,
      developer: data.developer || "",
      publicUrl: data.publicUrl,
      totpEnabled: data.totpEnabled,
      smtpConfigured: data.smtpConfigured,
    },
    privacyNotice: data.privacyNotice,
  };
}

export function emptyDomain() {
  return {
    company: { name: "", desc: "", logoUrl: "" },
    palette: { pri: "#1E4FD8", acc: "#163CA8" },
    domains: [], domainLock: false, domainConflicts: [],
    roles: [], users: [], docTypes: [], professions: [], profRequired: {},
    projects: [], authors: [], contractors: [], tasks: [], todos: [], pendings: [], history: [], templates: [],
    system: { version: "", channel: "stable" },
  };
}

const pick = (source: any, keys: string[]) => Object.fromEntries(keys.map((k) => [k, source[k]]));

export function toInput(entity: string, payload: any) {
  if (entity === "project") {
    return {
      ...pick(payload, ["name", "contractorId", "ada", "parsel", "pafta", "mahalle", "street", "status", "note"]),
      owners: (payload.owners || []).map((o: any) => pick(o, ["id", "name", "tc", "phone", "address", "share"])),
      proxy: pick(payload.proxy || {}, ["name", "tc", "phone", "address"]),
    };
  }
  if (entity === "author") return pick(payload, ["tc", "first", "last", "phone", "company", "job", "sicil", "address"]);
  return pick(payload, ["title", "owner", "licence", "rank", "address"]);
}

export function tplPayload(t: any) {
  return {
    ...pick(t, ["id", "name", "contexts", "size", "orient", "margins", "font", "fontSize", "pageNo", "pageNoPos", "header", "body", "footer"]),
    updated: 0,
  };
}
