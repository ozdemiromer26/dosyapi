//! HTTP katmanı: yalnızca taşıma. İş kuralı ve yetki kararı servislerdedir.

pub mod error;
pub mod extract;
mod routes;
pub mod security;

use crate::app::{PublicUrl, Services};
use crate::assets;
use axum::Router;
use axum::extract::DefaultBodyLimit;
use axum::middleware::from_fn_with_state;
use std::sync::Arc;
use std::time::Duration;
use tower_http::timeout::TimeoutLayer;

const JSON_LIMIT: usize = 4 * 1024 * 1024;

#[derive(Clone)]
pub struct AppState {
    pub services: Arc<Services>,
    pub public_url: PublicUrl,
    pub trust_proxy: bool,
}

impl AppState {
    pub fn is_https(&self) -> bool {
        self.public_url.get().starts_with("https://")
    }
}

pub fn router(state: AppState) -> Router {
    let api = routes::public::router()
        .merge(routes::app::router())
        .merge(routes::master::router())
        .layer(DefaultBodyLimit::max(JSON_LIMIT))
        .layer(request_timeout())
        .merge(routes::files::router());

    Router::new()
        .nest("/api/v1", api)
        .route(
            "/healthz",
            axum::routing::get(|| async { axum::Json(serde_json::json!({ "status": "ok" })) }),
        )
        .fallback(assets::serve)
        .layer(from_fn_with_state(
            state.clone(),
            security::global_rate_limit,
        ))
        .layer(from_fn_with_state(state.clone(), security::origin_guard))
        .layer(from_fn_with_state(state.clone(), security::host_guard))
        .layer(from_fn_with_state(
            state.clone(),
            security::security_headers,
        ))
        .with_state(state)
}

/// Yükleme yolları dışındaki tüm istekler için süre sınırı (yavaş istek saldırısına karşı).
fn request_timeout() -> TimeoutLayer {
    TimeoutLayer::with_status_code(
        axum::http::StatusCode::REQUEST_TIMEOUT,
        Duration::from_secs(60),
    )
}
