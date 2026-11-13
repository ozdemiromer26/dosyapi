/** Sunucu API istemcisi. Oturum HttpOnly çerezdedir; betik belirteci göremez. */

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const BASE = "/api/v1";

export class ApiClient {
  csrf = "";
  /** Sekme kimliği: sunucu bu sekmenin kendi değişikliği için canlı sinyal göndermez. */
  constructor(public tab = "") {}

  private headers(extra: Record<string, string> = {}) {
    const base: Record<string, string> = this.tab ? { "X-Tab-Id": this.tab, ...extra } : { ...extra };
    return this.csrf ? { "X-CSRF-Token": this.csrf, ...base } : base;
  }

  private async parse(response: Response) {
    if (response.status === 204) return null;
    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      const error = data?.error;
      throw new ApiError(response.status, error?.code ?? "error", error?.message ?? "İşlem tamamlanamadı.");
    }
    return data;
  }

  private async send(method: string, path: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await fetch(BASE + path, { method, credentials: "same-origin", ...init });
    } catch {
      throw new ApiError(0, "network", "Sunucuya ulaşılamadı.");
    }
    return this.parse(response);
  }

  get(path: string) {
    return this.send("GET", path, { headers: this.headers() });
  }
  post(path: string, body: unknown = {}) {
    return this.send("POST", path, { headers: this.headers({ "Content-Type": "application/json" }), body: JSON.stringify(body) });
  }
  put(path: string, body: unknown = {}) {
    return this.send("PUT", path, { headers: this.headers({ "Content-Type": "application/json" }), body: JSON.stringify(body) });
  }
  del(path: string) {
    return this.send("DELETE", path, { headers: this.headers() });
  }
  raw(method: string, path: string, body: Blob) {
    return this.send(method, path, { headers: this.headers({ "Content-Type": "application/octet-stream" }), body });
  }
  /** İkili yanıt döndüren POST (ör. anahtar dosyası indirme). */
  async postBlob(path: string, body: unknown = {}): Promise<Blob> {
    let response: Response;
    try {
      response = await fetch(BASE + path, { method: "POST", credentials: "same-origin", headers: this.headers({ "Content-Type": "application/json" }), body: JSON.stringify(body) });
    } catch {
      throw new ApiError(0, "network", "Sunucuya ulaşılamadı.");
    }
    if (!response.ok) return this.parse(response);
    return response.blob();
  }
  upload(path: string, body: Blob) {
    return this.raw("POST", path, body);
  }
}
