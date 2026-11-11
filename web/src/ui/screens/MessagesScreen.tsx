import React from "react";
import { css } from "../css";
import { LOC } from "../../i18n";
import { LIVE_EVENT } from "../../app/live";
import type { Vals } from "../../vm/types";

/** Birebir mesajlaşma: solda konuşmalar, sağda seçili konuşma (dar ekranda tek bölme).
 *  Yeni mesajlar canlı sinyalle anında gelir; sinyal kaçarsa diye seyrek yoklama da sürer
 *  (liste 30 sn'de, açık konuşma 15 sn'de bir, sekme görünürken). */

type Conv = { id: string; otherId: string; lastAt: number; lastBody: string; lastFromMe: boolean; unread: number };
type Msg = { id: string; seq: number; senderId: string; body: string; createdAt: number };

const CARD = "background:var(--card);border:1px solid var(--line);border-radius:14px";
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toLocaleUpperCase(LOC());

function stamp(ts: number) {
  const d = new Date(ts * 1000), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(LOC(), { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(LOC(), { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString(LOC(), { hour: "2-digit", minute: "2-digit" });
}

function useVisibleInterval(fn: () => void, ms: number, deps: any[]) {
  const ref = React.useRef(fn);
  ref.current = fn;
  React.useEffect(() => {
    const id = window.setInterval(() => { if (!document.hidden) ref.current(); }, ms);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span aria-hidden="true" style={css(`width:${size}px;height:${size}px;flex:none;border-radius:50%;background:var(--tint);color:var(--brandink);display:inline-flex;align-items:center;justify-content:center;font-size:${Math.round(size / 2.8)}px;font-weight:800`)}>
      {initials(name)}
    </span>
  );
}

export function MessagesScreen({ v }: { v: Vals }) {
  const m = v.msg, T = v.T;
  const [convs, setConvs] = React.useState<Conv[] | null>(null);
  // Açık konuşma: mevcut konuşma kimliği ya da henüz yazılmamış kişi (yeni konuşma taslağı).
  const [open, setOpen] = React.useState<{ id?: string; otherId: string } | null>(null);
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [hasMore, setHasMore] = React.useState(false);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [picker, setPicker] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const scroller = React.useRef<HTMLDivElement>(null);
  const stick = React.useRef(true);

  const loadList = React.useCallback(async () => {
    try { setConvs(await m.list()); } catch (e) { m.fail(e); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => { loadList(); }, [loadList]);
  useVisibleInterval(loadList, 30000, []);

  const loadThread = React.useCallback(async (id: string, initial: boolean) => {
    try {
      const r = await m.thread(id);
      setMsgs((prev) => {
        if (initial) return r.messages;
        // Yoklamada yalnızca yeni gelenler eklenir; yukarıda yüklenmiş eski sayfalar korunur.
        const last = prev.length ? prev[prev.length - 1].seq : 0;
        const fresh = r.messages.filter((x: Msg) => x.seq > last);
        return fresh.length ? [...prev, ...fresh] : prev;
      });
      if (initial) setHasMore(!!r.hasMore);
      m.refreshUnread();
    } catch (e) { m.fail(e); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openId = open && open.id;
  React.useEffect(() => {
    setMsgs([]); setHasMore(false); stick.current = true;
    if (openId) loadThread(openId, true).then(loadList);
  }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps
  useVisibleInterval(() => { if (openId) loadThread(openId, false); }, 15000, [openId]);
  // Başka bir oturumdan değişiklik sinyali: liste ve açık konuşma hemen tazelenir.
  const onLive = React.useRef<() => void>(() => {});
  onLive.current = () => { loadList(); if (openId) loadThread(openId, false); };
  React.useEffect(() => {
    const h = () => onLive.current();
    window.addEventListener(LIVE_EVENT, h);
    return () => window.removeEventListener(LIVE_EVENT, h);
  }, []);

  // Yeni mesaj gelince, kullanıcı en alttaysa aşağı kaydır.
  React.useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const loadOlder = async () => {
    if (!openId || !msgs.length) return;
    const el = scroller.current, before = el ? el.scrollHeight : 0;
    try {
      const r = await m.thread(openId, msgs[0].seq);
      stick.current = false;
      setMsgs((prev) => [...r.messages, ...prev]);
      setHasMore(!!r.hasMore);
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - before; });
    } catch (e) { m.fail(e); }
  };

  const send = async () => {
    const body = text.trim();
    if (!body || !open || sending) return;
    setSending(true);
    try {
      const sent = await m.send(open.otherId, body);
      setText("");
      stick.current = true;
      if (!open.id) setOpen({ id: sent.conversationId, otherId: open.otherId });
      else setMsgs((prev) => (prev.some((x) => x.seq === sent.seq) ? prev : [...prev, sent]));
      loadList();
    } catch (e) { m.fail(e); }
    setSending(false);
  };

  const startWith = (userId: string) => {
    setPicker(false); setQuery("");
    const existing = (convs || []).find((c) => c.otherId === userId);
    setOpen(existing ? { id: existing.id, otherId: userId } : { otherId: userId });
  };

  const showList = m.wide || !open;
  const showThread = m.wide || !!open;
  // Üst çubuk + içerik üst boşluğu (20) + alt boşluk (masaüstü 16, mobil 80): kutu ekranı tam doldurur.
  const height = "height:calc(100dvh - var(--hdr-h,59px) - " + (m.bottomBar ? "100px" : "36px") + ");min-height:380px";
  const people = m.users.filter((u: any) => !query || (u.name + " " + u.role).toLocaleLowerCase(LOC()).includes(query.toLocaleLowerCase(LOC())));

  const list = (
    <section aria-label={T.mesajlar} style={css(CARD + ";display:flex;flex-direction:column;min-width:0;overflow:hidden;" + height)}>
      <div style={css("display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line2)")}>
        <h2 style={css("flex:1;margin:0;font-size:15px;font-weight:800")}>{T.mesajlar}</h2>
        <button onClick={() => setPicker(!picker)} aria-expanded={picker} style={css("height:34px;padding:0 12px;border:none;border-radius:9px;background:var(--pri,#2a3180);color:#fff;font-size:13px;font-weight:700;cursor:pointer")}>{T.yeniMesaj}</button>
      </div>
      {picker ? (
        <div style={css("padding:10px 12px;border-bottom:1px solid var(--line2);display:flex;flex-direction:column;gap:6px;max-height:50%;overflow:auto")}>
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={T.kisiAra} aria-label={T.kisiAra}
            style={css("height:38px;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:0 11px;font-size:13px;font-weight:600")} />
          {people.map((u: any) => (
            <button key={u.id} onClick={() => startWith(u.id)} className="hv2" style={css("display:flex;align-items:center;gap:10px;padding:7px 8px;border:none;background:transparent;border-radius:9px;cursor:pointer;text-align:left")}>
              <Avatar name={u.name} size={30} />
              <span style={css("min-width:0")}>
                <span style={css("display:block;font-size:13px;font-weight:700;color:var(--ink)")}>{u.name}</span>
                <span style={css("display:block;font-size:11px;font-weight:600;color:var(--muted)")}>{u.role}</span>
              </span>
            </button>
          ))}
          {!people.length ? <div style={css("font-size:12px;color:var(--muted);font-weight:600;padding:6px")}>{T.kisiYok}</div> : null}
        </div>
      ) : null}
      <div style={css("flex:1;overflow:auto")}>
        {convs === null ? <div style={css("padding:16px;font-size:13px;color:var(--muted);font-weight:600")}>{T.yukleniyor}</div> : null}
        {convs && !convs.length ? <div style={css("padding:16px;font-size:13px;color:var(--muted);font-weight:600;line-height:1.55")}>{T.mesajYok}</div> : null}
        {(convs || []).map((c) => {
          const name = m.nameOf(c.otherId), on = !!open && open.otherId === c.otherId;
          return (
            <button key={c.id} onClick={() => setOpen({ id: c.id, otherId: c.otherId })} aria-current={on ? "true" : undefined} className={on ? "" : "hv0"}
              style={css("width:100%;display:flex;align-items:center;gap:10px;padding:11px 14px;border:none;border-bottom:1px solid var(--line3);cursor:pointer;text-align:left;background:" + (on ? "var(--tint)" : "transparent"))}>
              <Avatar name={name} />
              <span style={css("flex:1;min-width:0")}>
                <span style={css("display:flex;align-items:baseline;gap:8px")}>
                  <span style={css("flex:1;min-width:0;font-size:13px;font-weight:" + (c.unread ? 800 : 700) + ";color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{name}</span>
                  <span style={css("flex:none;font-size:11px;font-weight:600;color:var(--muted)")}>{stamp(c.lastAt)}</span>
                </span>
                <span style={css("display:flex;align-items:center;gap:8px;margin-top:2px")}>
                  <span style={css("flex:1;min-width:0;font-size:12px;font-weight:" + (c.unread ? 700 : 500) + ";color:" + (c.unread ? "var(--ink)" : "var(--muted)") + ";white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{(c.lastFromMe ? T.sen + ": " : "") + c.lastBody}</span>
                  {c.unread ? <span aria-label={c.unread + " " + T.okunmamis} style={css("flex:none;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--pri,#2a3180);color:#fff;font-size:11px;font-weight:800;line-height:18px;text-align:center")}>{c.unread}</span> : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );

  const otherName = open ? m.nameOf(open.otherId) : "";
  const otherRole = open ? ((m.users.find((u: any) => u.id === open.otherId) || {}).role || "") : "";
  const thread = (
    <section aria-label={otherName || T.mesajlar} style={css(CARD + ";display:flex;flex-direction:column;min-width:0;overflow:hidden;" + height)}>
      {open ? (<>
        <div style={css("display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line2)")}>
          {!m.wide ? <button onClick={() => setOpen(null)} aria-label={T.geri} style={css("height:32px;padding:0 10px;border:1px solid var(--line);background:var(--card);border-radius:8px;font-size:13px;font-weight:700;cursor:pointer")}>←</button> : null}
          <Avatar name={otherName} />
          <div style={css("min-width:0")}>
            <div style={css("font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{otherName}</div>
            {otherRole ? <div style={css("font-size:11px;font-weight:600;color:var(--muted)")}>{otherRole}</div> : null}
          </div>
        </div>
        <div ref={scroller} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}
          role="log" aria-live="polite" style={css("flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:6px;background:var(--soft)")}>
          {hasMore ? <button onClick={loadOlder} style={css("align-self:center;height:30px;padding:0 12px;border:1px solid var(--line);background:var(--card);border-radius:999px;font-size:12px;font-weight:700;color:var(--muted);cursor:pointer;margin-bottom:6px")}>{T.oncekiMesajlar}</button> : null}
          {!msgs.length ? <div style={css("margin:auto;font-size:13px;color:var(--muted);font-weight:600;text-align:center;max-width:280px;line-height:1.55")}>{open.id ? T.yukleniyor : T.ilkMesaj}</div> : null}
          {msgs.map((x) => {
            const mine = x.senderId === m.meId;
            return (
              <div key={x.id} style={css("display:flex;flex-direction:column;max-width:78%;align-self:" + (mine ? "flex-end" : "flex-start") + ";align-items:" + (mine ? "flex-end" : "flex-start"))}>
                <div style={css("padding:8px 12px;border-radius:14px;font-size:14px;font-weight:500;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;" + (mine ? "background:var(--pri,#2a3180);color:#fff;border-bottom-right-radius:4px" : "background:var(--card);color:var(--ink);border:1px solid var(--line2);border-bottom-left-radius:4px"))}>{x.body}</div>
                <div style={css("font-size:10.5px;font-weight:600;color:var(--faint);margin:2px 4px 0")}>{stamp(x.createdAt)}</div>
              </div>
            );
          })}
        </div>
        <div style={css("display:flex;gap:8px;align-items:flex-end;padding:10px 12px;border-top:1px solid var(--line2)")}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={4000} aria-label={T.mesajYaz} placeholder={T.mesajYaz}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !(e.nativeEvent as any).isComposing) { e.preventDefault(); send(); } }}
            style={css("flex:1;min-width:0;min-height:40px;max-height:140px;resize:none;border:1px solid var(--line);background:var(--soft);border-radius:10px;padding:9px 11px;font:inherit;font-size:14px;line-height:1.45;field-sizing:content")} />
          <button onClick={send} disabled={sending || !text.trim()} style={css("flex:none;height:40px;padding:0 16px;border:none;border-radius:10px;background:var(--pri,#2a3180);color:#fff;font-size:14px;font-weight:700;cursor:pointer;opacity:" + (sending || !text.trim() ? 0.55 : 1))}>{T.gonder}</button>
        </div>
      </>) : (
        <div style={css("margin:auto;text-align:center;color:var(--muted);font-size:13px;font-weight:600;line-height:1.6;padding:20px;max-width:300px")}>{T.konusmaSec}</div>
      )}
    </section>
  );

  return (
    <div style={css("display:grid;gap:14px;align-items:start;grid-template-columns:" + (m.wide ? "minmax(260px,320px) minmax(0,1fr)" : "minmax(0,1fr)"))}>
      {showList ? list : null}
      {showThread ? thread : null}
    </div>
  );
}
