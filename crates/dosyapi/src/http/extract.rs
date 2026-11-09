//! İstek çıkarıcılar: kimlik doğrulama, CSRF ve istek bağlamı tek yerde.

use super::AppState;
use super::error::ApiError;
use super::security::client_ip;
use axum::Json;
use axum::extract::rejection::JsonRejection;
use axum::extract::{ConnectInfo, FromRequest, FromRequestParts, Request};
use axum::http::request::Parts;
use axum::http::{Method, header};
use dosyapi_core::AppError;
use dosyapi_core::model::RequestMeta;
use dosyapi_core::services::auth::Authenticated;
use dosyapi_core::services::master::MasterAuthenticated;
use serde::de::DeserializeOwned;
use std::net::SocketAddr;

pub const USER_COOKIE: &str = "dsy_sid";
pub const MASTER_COOKIE: &str = "dsy_master";
pub const CSRF_HEADER: &str = "x-csrf-token";

pub fn cookie_name(state: &AppState, base: &str) -> String {
    if state.is_https() {
        format!("__Host-{base}")
    } else {
        base.to_string()
    }
}

pub fn read_cookie(parts: &Parts, name: &str) -> Option<String> {
    parts
        .headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'))
        .filter_map(|pair| pair.trim().split_once('='))
        .find(|(key, _)| *key == name)
        .map(|(_, value)| value.to_string())
}

/// HttpOnly + SameSite=Strict; HTTPS'te `__Host-` öneki ve Secure. Betik çerezi okuyamaz.
pub fn session_cookie(state: &AppState, base: &str, token: &str, max_age: Option<i64>) -> String {
    let name = cookie_name(state, base);
    let secure = if state.is_https() { "; Secure" } else { "" };
    let age = max_age.map_or(String::new(), |a| format!("; Max-Age={a}"));
    format!("{name}={token}; Path=/; HttpOnly; SameSite=Strict{secure}{age}")
}

pub fn clear_cookie(state: &AppState, base: &str) -> String {
    session_cookie(state, base, "", Some(0))
}

fn is_unsafe(method: &Method) -> bool {
    !matches!(*method, Method::GET | Method::HEAD | Method::OPTIONS)
}

fn csrf_header(parts: &Parts) -> &str {
    parts
        .headers
        .get(CSRF_HEADER)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
}

/// Şifre değişikliği zorunluyken yalnızca bu yollar açıktır.
fn allowed_while_password_expired(path: &str) -> bool {
    matches!(
        path,
        "/api/v1/bootstrap" | "/api/v1/profile/password" | "/api/v1/auth/logout"
    )
}

pub struct AuthUser(pub Authenticated);

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let name = cookie_name(state, USER_COOKIE);
        let token = read_cookie(parts, &name).ok_or(AppError::Unauthorized)?;
        let auth = state.services.auth.authenticate(&token).await?;
        if is_unsafe(&parts.method)
            && !state
                .services
                .auth
                .csrf_valid(&auth.token_hash, csrf_header(parts))
        {
            return Err(AppError::Forbidden.into());
        }
        if auth.actor.must_change_password && !allowed_while_password_expired(parts.uri.path()) {
            return Err(
                AppError::conflict("Devam etmeden önce şifrenizi değiştirmelisiniz.").into(),
            );
        }
        Ok(Self(auth))
    }
}

pub struct MasterUser(pub MasterAuthenticated);

impl FromRequestParts<AppState> for MasterUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let name = cookie_name(state, MASTER_COOKIE);
        let token = read_cookie(parts, &name).ok_or(AppError::Unauthorized)?;
        let auth = state.services.master.authenticate(&token).await?;
        if is_unsafe(&parts.method)
            && !state
                .services
                .master
                .csrf_valid(&auth.token_hash, csrf_header(parts))
        {
            return Err(AppError::Forbidden.into());
        }
        Ok(Self(auth))
    }
}

pub struct Meta(pub RequestMeta);

impl FromRequestParts<AppState> for Meta {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let connect = parts.extensions.get::<ConnectInfo<SocketAddr>>();
        Ok(Self(RequestMeta {
            ip: client_ip(state, &parts.headers, connect),
            user_agent: parts
                .headers
                .get(header::USER_AGENT)
                .and_then(|v| v.to_str().ok())
                .unwrap_or_default()
                .chars()
                .take(200)
                .collect(),
        }))
    }
}

/// JSON gövdesi. Şema dışı alan ya da bozuk gövde tek tip 400 döner.
pub struct Body<T>(pub T);

impl<T: DeserializeOwned> FromRequest<AppState> for Body<T> {
    type Rejection = ApiError;

    async fn from_request(request: Request, state: &AppState) -> Result<Self, Self::Rejection> {
        match Json::<T>::from_request(request, state).await {
            Ok(Json(value)) => Ok(Self(value)),
            Err(JsonRejection::BytesRejection(_)) => {
                Err(AppError::PayloadTooLarge("İstek çok büyük.".into()).into())
            }
            Err(_) => Err(AppError::validation("Geçersiz istek.").into()),
        }
    }
}
