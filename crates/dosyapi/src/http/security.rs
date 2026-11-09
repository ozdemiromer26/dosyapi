//! Tüm isteklerden geçen güvenlik katmanları.

use super::AppState;
use super::error::ApiError;
use axum::extract::{ConnectInfo, Request, State};
use axum::http::{HeaderMap, HeaderValue, Method, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use dosyapi_core::AppError;
use dosyapi_core::ports::RetryAfter;
use std::net::SocketAddr;

const CSP: &str = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; \
img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; manifest-src 'self'; \
frame-src 'self' blob:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

pub async fn security_headers(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    let is_api = request.uri().path().starts_with("/api/");
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    let set = |h: &mut HeaderMap, name: &'static str, value: &'static str| {
        h.insert(name, HeaderValue::from_static(value));
    };
    set(headers, "content-security-policy", CSP);
    set(headers, "x-content-type-options", "nosniff");
    set(headers, "x-frame-options", "DENY");
    set(headers, "referrer-policy", "no-referrer");
    set(
        headers,
        "permissions-policy",
        "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    );
    set(headers, "cross-origin-opener-policy", "same-origin");
    set(headers, "cross-origin-resource-policy", "same-origin");
    if state.is_https() {
        set(
            headers,
            "strict-transport-security",
            "max-age=63072000; includeSubDomains",
        );
    }
    if is_api && !headers.contains_key(header::CACHE_CONTROL) {
        set(headers, "cache-control", "no-store");
    }
    response
}

/// Gerçek istemci adresi. `X-Forwarded-For` yalnızca güvenilir vekil varsa okunur ve en
/// sağdaki değer alınır: istemcinin kendi yazdığı değerle hız sınırı aşılamaz.
pub fn client_ip(
    state: &AppState,
    headers: &HeaderMap,
    connect: Option<&ConnectInfo<SocketAddr>>,
) -> String {
    if state.trust_proxy
        && let Some(value) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok())
        && let Some(last) = value
            .rsplit(',')
            .next()
            .map(str::trim)
            .filter(|v| v.parse::<std::net::IpAddr>().is_ok())
    {
        return last.to_string();
    }
    connect.map_or_else(|| "0.0.0.0".to_string(), |c| c.0.ip().to_string())
}

fn host_of(url: &str) -> &str {
    let rest = url.split_once("://").map_or(url, |(_, r)| r);
    rest.split('/').next().unwrap_or(rest)
}

fn is_loopback_host(host: &str) -> bool {
    let name = host.rsplit_once(':').map_or(host, |(h, _)| h);
    matches!(name, "localhost" | "127.0.0.1" | "[::1]")
}

/// Host başlığı zehirlenmesine karşı: yalnızca yayımlanan alan adı ve yerel erişim kabul edilir.
pub async fn host_guard(State(state): State<AppState>, request: Request, next: Next) -> Response {
    let host = request
        .headers()
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let public = state.public_url.get().to_ascii_lowercase();
    if !host.is_empty() && host != host_of(&public) && !is_loopback_host(&host) {
        return ApiError(AppError::NotFound).into_response();
    }
    next.run(request).await
}

/// Durum değiştiren isteklerde köken denetimi: başka siteden gelen tarayıcı isteği reddedilir.
pub async fn origin_guard(State(state): State<AppState>, request: Request, next: Next) -> Response {
    let unsafe_method = !matches!(
        *request.method(),
        Method::GET | Method::HEAD | Method::OPTIONS
    );
    if unsafe_method && request.uri().path().starts_with("/api/") {
        let headers = request.headers();
        if let Some(origin) = headers.get(header::ORIGIN).and_then(|v| v.to_str().ok()) {
            let public = state.public_url.get();
            let same = origin.eq_ignore_ascii_case(public.trim_end_matches('/'));
            let local = origin
                .split_once("://")
                .is_some_and(|(_, h)| is_loopback_host(h))
                && is_loopback_host(host_of(&public));
            if !same && !local {
                return ApiError(AppError::Forbidden).into_response();
            }
        }
        if let Some(site) = headers.get("sec-fetch-site").and_then(|v| v.to_str().ok())
            && !matches!(site, "same-origin" | "none")
        {
            return ApiError(AppError::Forbidden).into_response();
        }
    }
    next.run(request).await
}

/// Genel istek sınırı. Hassas uç noktaların kendi daha sıkı sınırları vardır.
pub async fn global_rate_limit(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    if request.uri().path().starts_with("/api/") {
        let connect = request.extensions().get::<ConnectInfo<SocketAddr>>();
        let ip = client_ip(&state, request.headers(), connect);
        if let Err(RetryAfter(secs)) = state.services.limiter.hit(&format!("api:{ip}"), 1200, 60) {
            return ApiError(AppError::RateLimited {
                retry_after_secs: secs,
            })
            .into_response();
        }
    }
    next.run(request).await
}
