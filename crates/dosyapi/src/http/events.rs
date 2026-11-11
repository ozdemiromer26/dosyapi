//! Canlı güncelleme: değişiklik bildirimi (Server-Sent Events).
//!
//! Sunucu yalnızca "bir şey değişti" der, hiçbir kayıt göndermez. İstemci bu sinyali
//! alınca `/bootstrap`'i kendi oturumu ve yetkisiyle yeniden çeker. Böylece yetki kararı
//! tek yerde (servislerde) kalır; olay akışından hiçbir veri sızamaz.
//!
//! Akış: başarılı her değiştirici istek (POST/PUT/DELETE) → `notify_changes` ara katmanı
//! → yayın kanalı → açık her akış kısa bir birleştirme beklemesinden sonra tek `change`
//! olayı yollar. İsteği yapan sekme (X-Tab-Id) kendi değişikliğini zaten tazelediği için
//! ona olay gönderilmez.

use super::AppState;
use super::error::ApiError;
use super::extract::AuthUser;
use axum::extract::{Query, Request, State};
use axum::http::{HeaderValue, Method, header};
use axum::middleware::Next;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use dosyapi_core::AppError;
use futures_util::stream::{self, Stream, StreamExt};
use serde::Deserialize;
use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::{broadcast, watch};
use tokio::time::{Instant, MissedTickBehavior};

/// Kullanıcı başına açık akış sınırı (birkaç cihaz ve sekme).
const PER_USER: usize = 8;
/// Sunucu genelinde açık akış sınırı.
const GLOBAL: usize = 1000;
/// Oturum bu aralıkla yeniden denetlenir; geçersizse akış kapanır.
const RECHECK: Duration = Duration::from_secs(30);
/// Art arda gelen değişiklikler tek olayda birleştirilir.
const COALESCE: Duration = Duration::from_millis(400);
/// Bağlantı koparsa tarayıcının yeniden deneme süresi.
const RETRY: Duration = Duration::from_secs(5);
pub const TAB_HEADER: &str = "x-tab-id";

#[derive(Clone, Debug)]
struct Change {
    tab: Option<String>,
}

#[derive(Default)]
struct Counts {
    total: usize,
    per_user: HashMap<String, usize>,
}

pub struct EventHub {
    tx: broadcast::Sender<Change>,
    closed: watch::Sender<bool>,
    counts: Mutex<Counts>,
}

impl Default for EventHub {
    fn default() -> Self {
        Self::new()
    }
}

impl EventHub {
    pub fn new() -> Self {
        Self {
            tx: broadcast::channel(64).0,
            closed: watch::channel(false).0,
            counts: Mutex::new(Counts::default()),
        }
    }

    fn publish(&self, tab: Option<String>) {
        // Dinleyen yoksa gönderim hata döner; bu beklenen bir durumdur.
        let _ = self.tx.send(Change { tab });
    }

    /// Kapanışta açık akışları bitirir; yoksa zarif kapanış bu bağlantıları sonsuza dek bekler.
    pub fn close(&self) {
        let _ = self.closed.send(true);
    }

    fn acquire(self: &Arc<Self>, user_id: &str) -> Option<Slot> {
        let mut counts = self
            .counts
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let mine = counts.per_user.get(user_id).copied().unwrap_or(0);
        if counts.total >= GLOBAL || mine >= PER_USER {
            return None;
        }
        counts.total += 1;
        counts.per_user.insert(user_id.to_string(), mine + 1);
        Some(Slot {
            hub: self.clone(),
            user_id: user_id.to_string(),
        })
    }
}

/// Açık bir akışın sayaçtaki yeri; akış düşünce (istemci ayrılınca) kendiliğinden boşalır.
struct Slot {
    hub: Arc<EventHub>,
    user_id: String,
}

impl Drop for Slot {
    fn drop(&mut self) {
        let mut counts = self
            .hub
            .counts
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        counts.total = counts.total.saturating_sub(1);
        if let Some(n) = counts.per_user.get_mut(&self.user_id) {
            *n -= 1;
            if *n == 0 {
                counts.per_user.remove(&self.user_id);
            }
        }
    }
}

/// İstemcinin sekme kimliği: yalnızca kendi değişikliğini süzmek için; kimseye gösterilmez.
fn valid_tab(tab: &str) -> bool {
    (8..=40).contains(&tab.len()) && tab.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
}

/// Paylaşılan veriyi değiştirmeyen oturum yolları; bunlar olay üretmez.
fn quiet(path: &str) -> bool {
    matches!(
        path,
        "/auth/login"
            | "/auth/logout"
            | "/auth/forgot"
            | "/auth/reset"
            | "/master/login"
            | "/master/logout"
    ) || path.starts_with("/master/totp/")
}

/// Başarılı değiştirici isteklerden sonra açık akışlara "değişti" sinyali gönderir.
pub async fn notify_changes(State(state): State<AppState>, req: Request, next: Next) -> Response {
    let mutating = !matches!(*req.method(), Method::GET | Method::HEAD | Method::OPTIONS)
        && !quiet(req.uri().path());
    let tab = req
        .headers()
        .get(TAB_HEADER)
        .and_then(|v| v.to_str().ok())
        .filter(|t| valid_tab(t))
        .map(str::to_owned);
    let response = next.run(req).await;
    if mutating && response.status().is_success() {
        state.events.publish(tab);
    }
    response
}

#[derive(Deserialize)]
pub struct StreamQuery {
    tab: Option<String>,
}

struct Feed {
    rx: broadcast::Receiver<Change>,
    closed: watch::Receiver<bool>,
    recheck: tokio::time::Interval,
    state: AppState,
    token_hash: Vec<u8>,
    tab: Option<String>,
    _slot: Slot,
}

impl Feed {
    /// Sıradaki olayı bekler; oturum düşerse ya da sunucu kapanırsa `None` döner.
    async fn next_change(&mut self) -> Option<()> {
        loop {
            tokio::select! {
                received = self.rx.recv() => match received {
                    Ok(change) if change.tab.is_some() && change.tab == self.tab => {}
                    Ok(_) | Err(broadcast::error::RecvError::Lagged(_)) => {
                        tokio::time::sleep(COALESCE).await;
                        while matches!(
                            self.rx.try_recv(),
                            Ok(_) | Err(broadcast::error::TryRecvError::Lagged(_))
                        ) {}
                        return Some(());
                    }
                    Err(broadcast::error::RecvError::Closed) => return None,
                },
                _ = self.recheck.tick() => {
                    if !self.state.services.auth.session_alive(&self.token_hash).await {
                        return None;
                    }
                }
                _ = self.closed.changed() => return None,
            }
        }
    }
}

/// `GET /api/v1/events`: oturum açmış kullanıcıya değişiklik akışı.
pub async fn stream(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Query(query): Query<StreamQuery>,
) -> Result<Response, ApiError> {
    let slot = state
        .events
        .acquire(&auth.actor.user_id)
        .ok_or(AppError::RateLimited {
            retry_after_secs: 30,
        })?;
    let mut recheck = tokio::time::interval_at(Instant::now() + RECHECK, RECHECK);
    recheck.set_missed_tick_behavior(MissedTickBehavior::Delay);
    let feed = Feed {
        rx: state.events.tx.subscribe(),
        closed: state.events.closed.subscribe(),
        recheck,
        token_hash: auth.token_hash,
        tab: query.tab.filter(|t| valid_tab(t)),
        state: state.clone(),
        _slot: slot,
    };
    let ready = stream::once(async { Ok(Event::default().retry(RETRY).event("ready").data("1")) });
    let changes = stream::unfold(feed, |mut feed| async move {
        feed.next_change().await?;
        Some((Ok(Event::default().event("change").data("1")), feed))
    });
    let body: std::pin::Pin<Box<dyn Stream<Item = Result<Event, Infallible>> + Send>> =
        Box::pin(ready.chain(changes));
    let mut response = Sse::new(body)
        .keep_alive(KeepAlive::new().interval(Duration::from_secs(20)))
        .into_response();
    let headers = response.headers_mut();
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    // Önde nginx vb. bir vekil varsa olayları tamponlamasın.
    headers.insert("x-accel-buffering", HeaderValue::from_static("no"));
    Ok(response)
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn tab_ids_are_validated() {
        assert!(valid_tab("a1b2c3d4"));
        assert!(valid_tab("0f8c-4a7e-9d21-ab"));
        assert!(!valid_tab("short"));
        assert!(!valid_tab("has space in it"));
        assert!(!valid_tab(&"x".repeat(41)));
    }

    #[test]
    fn session_paths_are_quiet() {
        assert!(quiet("/auth/login"));
        assert!(quiet("/master/totp/begin"));
        assert!(!quiet("/auth/register"));
        assert!(!quiet("/projects"));
    }

    #[test]
    fn slots_are_limited_per_user_and_released() {
        let hub = Arc::new(EventHub::new());
        let slots: Vec<_> = (0..PER_USER).map(|_| hub.acquire("u1").unwrap()).collect();
        assert!(hub.acquire("u1").is_none());
        assert!(hub.acquire("u2").is_some());
        drop(slots);
        assert!(hub.acquire("u1").is_some());
        assert_eq!(hub.counts.lock().unwrap().per_user.get("u1"), None);
    }
}
