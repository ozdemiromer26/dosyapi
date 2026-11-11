/** Canlı güncelleme istemcisi (Server-Sent Events).
 *
 *  Sunucu `/api/v1/events` akışında yalnızca "değişti" sinyali yollar, veri yollamaz;
 *  uygulama sinyal gelince `/bootstrap`'i kendi yetkisiyle yeniden çeker.
 *  - Sekme 60 sn'den uzun arka planda kalırsa bağlantı kapatılır; geri gelince yeniden
 *    açılır ve kaçırılan değişiklikler için bir kez tazelenir.
 *  - Bağlantı koparsa tarayıcı kendisi yeniden dener; sunucu reddederse (oturum düştü,
 *    sınır doldu) artan aralıklarla yeniden denenir. Bu sürede eski yoklama devrededir.
 *  - Her sekmenin rastgele bir kimliği vardır (X-Tab-Id); sekme kendi değişikliği için
 *    sinyal almaz, çünkü işlemin ardından zaten tazeler. */

export const LIVE_EVENT = "dosyapi:live";
const HIDDEN_GRACE = 60000;
const MAX_BACKOFF = 120000;

export function newTabId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export class LiveFeed {
  connected = false;
  private es: EventSource | null = null;
  private retryTimer: any = null;
  private hideTimer: any = null;
  private backoff = 5000;
  private running = false;

  constructor(
    private tab: string,
    /** "change": başka bir oturum değişiklik yaptı; "resync": bağlantı (yeniden) kuruldu. */
    private onSignal: (why: "change" | "resync") => void,
    /** Sunucu akışı reddetti; oturum düşmüş olabilir. */
    private onRejected: () => void,
  ) {}

  start() {
    if (this.running || typeof EventSource === "undefined") return;
    this.running = true;
    document.addEventListener("visibilitychange", this.onVisibility);
    if (!document.hidden) this.open();
  }

  stop() {
    this.running = false;
    document.removeEventListener("visibilitychange", this.onVisibility);
    clearTimeout(this.retryTimer);
    clearTimeout(this.hideTimer);
    this.close();
    this.backoff = 5000;
  }

  private open() {
    clearTimeout(this.retryTimer);
    if (!this.running || this.es) return;
    const es = new EventSource("/api/v1/events?tab=" + encodeURIComponent(this.tab));
    this.es = es;
    es.addEventListener("ready", () => {
      this.connected = true;
      this.backoff = 5000;
      this.onSignal("resync");
    });
    es.addEventListener("change", () => this.onSignal("change"));
    es.onerror = () => {
      this.connected = false;
      // CONNECTING: tarayıcı kendisi yeniden bağlanır. CLOSED: sunucu reddetti.
      if (es.readyState !== EventSource.CLOSED) return;
      this.close();
      this.onRejected();
      if (!this.running) return;
      this.retryTimer = setTimeout(() => this.open(), this.backoff);
      this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF);
    };
  }

  private close() {
    if (this.es) this.es.close();
    this.es = null;
    this.connected = false;
  }

  private onVisibility = () => {
    clearTimeout(this.hideTimer);
    if (document.hidden) this.hideTimer = setTimeout(() => this.close(), HIDDEN_GRACE);
    else this.open();
  };
}
