//! Oturum gerektirmeyen uç noktalar.

use crate::http::AppState;
use crate::http::error::ApiResult;
use crate::http::extract::*;
use axum::Json;
use axum::Router;
use axum::extract::State;
use axum::http::header::{CONTENT_TYPE, SET_COOKIE};
use axum::http::{HeaderValue, StatusCode};
use axum::response::{AppendHeaders, IntoResponse, Response};
use axum::routing::{get, post};
use dosyapi_core::AppError;
use dosyapi_core::services::auth::RegisterInput;
use dosyapi_core::services::setup::SetupInput;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PublicInfo {
    setup_required: bool,
    company_name: String,
    company_desc: String,
    has_logo: bool,
    pri: String,
    acc: String,
    domain_lock: bool,
    domains: Vec<String>,
    mail_configured: bool,
    privacy_notice: String,
}

async fn info(State(state): State<AppState>) -> ApiResult<Json<PublicInfo>> {
    let s = &state.services;
    let company = s.settings.company().await?;
    let palette = s.settings.palette().await?;
    let domain_lock = s.settings.domain_lock().await?;
    Ok(Json(PublicInfo {
        setup_required: s.setup.required().await?,
        company_name: company.name,
        company_desc: company.desc,
        has_logo: company.has_logo,
        pri: palette.pri,
        acc: palette.acc,
        domains: if domain_lock {
            s.settings.domains().await?
        } else {
            vec![]
        },
        domain_lock,
        mail_configured: s.mail.is_configured().await?,
        privacy_notice: s.settings.privacy_notice().await?,
    }))
}

async fn logo(State(state): State<AppState>) -> ApiResult<Response> {
    let (bytes, mime) = state
        .services
        .company
        .logo()
        .await?
        .ok_or(AppError::NotFound)?;
    let mut response = bytes.into_response();
    let value = HeaderValue::from_str(&mime).map_err(AppError::internal)?;
    response.headers_mut().insert(CONTENT_TYPE, value);
    response
        .headers_mut()
        .insert("cache-control", HeaderValue::from_static("no-cache"));
    Ok(response)
}

async fn setup(
    State(state): State<AppState>,
    Meta(meta): Meta,
    Body(input): Body<SetupInput>,
) -> ApiResult<StatusCode> {
    state.services.setup.complete(input, &meta).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LoginInput {
    email: String,
    password: String,
    #[serde(default)]
    code: Option<String>,
    #[serde(default)]
    remember: bool,
}

async fn login(
    State(state): State<AppState>,
    Meta(meta): Meta,
    Body(input): Body<LoginInput>,
) -> ApiResult<Response> {
    let outcome = state
        .services
        .auth
        .login(
            &input.email,
            &input.password,
            input.code.as_deref(),
            input.remember,
            &meta,
        )
        .await?;
    let age = outcome.persistent.then_some(outcome.max_age);
    let cookie = session_cookie(&state, USER_COOKIE, &outcome.token, age);
    Ok((
        AppendHeaders([(SET_COOKIE, cookie)]),
        Json(json!({ "ok": true })),
    )
        .into_response())
}

async fn logout(
    State(state): State<AppState>,
    parts: axum::http::request::Parts,
) -> ApiResult<Response> {
    if let Some(token) = read_cookie(&parts, &cookie_name(&state, USER_COOKIE)) {
        state.services.auth.logout(&token).await?;
    }
    let cookie = clear_cookie(&state, USER_COOKIE);
    Ok((
        AppendHeaders([(SET_COOKIE, cookie)]),
        StatusCode::NO_CONTENT,
    )
        .into_response())
}

async fn register(
    State(state): State<AppState>,
    Meta(meta): Meta,
    Body(input): Body<RegisterInput>,
) -> ApiResult<StatusCode> {
    state.services.auth.register(input, &meta).await?;
    Ok(StatusCode::ACCEPTED)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ForgotInput {
    email: String,
}

async fn forgot(
    State(state): State<AppState>,
    Meta(meta): Meta,
    Body(input): Body<ForgotInput>,
) -> ApiResult<StatusCode> {
    state.services.auth.forgot_limit(&meta)?;
    let auth = state.services.auth.clone();
    tokio::spawn(async move {
        if let Err(error) = auth.forgot(&input.email, &meta).await {
            tracing::warn!(?error, "şifre sıfırlama işlenemedi");
        }
    });
    Ok(StatusCode::ACCEPTED)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ResetInput {
    token: String,
    password: String,
}

async fn reset(
    State(state): State<AppState>,
    Meta(meta): Meta,
    Body(input): Body<ResetInput>,
) -> ApiResult<StatusCode> {
    state
        .services
        .auth
        .reset_password(&input.token, &input.password, &meta)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/public/info", get(info))
        .route("/public/logo", get(logo))
        .route("/setup", post(setup))
        .route("/auth/login", post(login))
        .route("/auth/logout", post(logout))
        .route("/auth/register", post(register))
        .route("/auth/forgot", post(forgot))
        .route("/auth/reset", post(reset))
}
