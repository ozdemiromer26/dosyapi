//! Sistem paneli uç noktaları. Kullanıcı oturumundan tamamen ayrı bir oturum ister.

use crate::http::AppState;
use crate::http::error::ApiResult;
use crate::http::extract::*;
use crate::http::routes::files::stream_file;
use axum::Json;
use axum::Router;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::http::header::SET_COOKIE;
use axum::response::{AppendHeaders, IntoResponse, Response};
use axum::routing::{get, post, put};
use dosyapi_core::AppError;
use dosyapi_core::model::*;
use dosyapi_core::ports::{BackupInfo, SmtpConfig};
use dosyapi_core::services::bootstrap::{FileView, file_view};
use dosyapi_core::services::company::IdentityInput;
use dosyapi_core::services::dns::{DnsConfig, DnsConfigInput};
use dosyapi_core::services::roles::RoleInput;
use dosyapi_core::services::settings::*;
use dosyapi_core::services::users::{IssuedLink, NewUserInput};
use dosyapi_core::validate;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::BTreeMap;
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LoginInput {
    password: String,
    #[serde(default)]
    code: Option<String>,
}

async fn login(
    State(state): State<AppState>,
    Meta(meta): Meta,
    Body(input): Body<LoginInput>,
) -> ApiResult<Response> {
    if state.services.setup.required().await? {
        return Err(AppError::NotFound.into());
    }
    let (token, _ttl) = state
        .services
        .master
        .login(&input.password, input.code.as_deref(), &meta)
        .await?;
    let cookie = session_cookie(&state, MASTER_COOKIE, &token, None);
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
    if let Some(token) = read_cookie(&parts, &cookie_name(&state, MASTER_COOKIE)) {
        state.services.master.logout(&token).await?;
    }
    let cookie = clear_cookie(&state, MASTER_COOKIE);
    Ok((
        AppendHeaders([(SET_COOKIE, cookie)]),
        StatusCode::NO_CONTENT,
    )
        .into_response())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MasterUserView {
    id: Id,
    name: String,
    email: String,
    role_id: Option<Id>,
    status: UserStatus,
    totp_enabled: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MasterProject {
    id: Id,
    name: String,
    docs: BTreeMap<Id, Vec<FileView>>,
    files: Vec<FileView>,
}

async fn state_view(
    State(state): State<AppState>,
    MasterUser(auth): MasterUser,
) -> ApiResult<Json<Value>> {
    let s = &state.services;
    let users: Vec<MasterUserView> = s
        .user_repo
        .list()
        .await?
        .into_iter()
        .map(|u| MasterUserView {
            id: u.id,
            name: u.name,
            email: u.email,
            role_id: u.role_id,
            status: u.status,
            totp_enabled: u.totp_enabled,
        })
        .collect();
    let files = s.files.all().await?;
    let doc_types = s.doc_type_repo.list().await?;
    let projects: Vec<MasterProject> = s
        .project_repo
        .list()
        .await?
        .into_iter()
        .map(|p| {
            let mut docs: BTreeMap<Id, Vec<FileView>> = BTreeMap::new();
            let mut extras = Vec::new();
            for f in files.iter().filter(|f| f.project_id == p.id) {
                match &f.doc_type_id {
                    Some(slot) => docs.entry(slot.clone()).or_default().push(master_file(f)),
                    None => extras.push(master_file(f)),
                }
            }
            MasterProject {
                id: p.id,
                name: p.name,
                docs,
                files: extras,
            }
        })
        .collect();
    let domains = s.settings.domains().await?;
    Ok(Json(json!({
        "csrf": s.master.csrf_token(&auth.token_hash),
        "company": s.settings.company().await?,
        "palette": s.settings.palette().await?,
        "domains": domains,
        "domainLock": s.settings.domain_lock().await?,
        "domainConflicts": s.company.domain_conflicts().await?.into_iter()
            .map(|(id, name, email)| json!({ "id": id, "name": name, "email": email })).collect::<Vec<_>>(),
        "roles": s.role_repo.list().await?,
        "users": users,
        "docTypes": doc_types,
        "projects": projects,
        "version": s.updates.current_version(),
        "installedAt": s.updates.record_running_version().await?,
        "developer": env!("CARGO_PKG_AUTHORS"),
        "channel": s.updates.channel().await?,
        "publicUrl": state.public_url.get(),
        "totpEnabled": s.master.totp_status().await?,
        "smtpConfigured": s.mail.is_configured().await?,
        "privacyNotice": s.settings.privacy_notice().await?,
    })))
}

fn master_file(file: &StoredFile) -> FileView {
    let mut view = file_view(file);
    view.url = format!("/api/v1/master/files/{}", file.id);
    view
}

async fn identity(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Body(input): Body<IdentityInput>,
) -> ApiResult<StatusCode> {
    state.services.company.save_identity(input, &meta).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct NoticeInput {
    text: String,
}

async fn notice_put(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Body(input): Body<NoticeInput>,
) -> ApiResult<StatusCode> {
    state
        .services
        .company
        .save_notice(&input.text, &meta)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn logo_put(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    body: axum::body::Bytes,
) -> ApiResult<StatusCode> {
    state.services.company.save_logo(&body, &meta).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn logo_delete(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
) -> ApiResult<StatusCode> {
    state.services.company.clear_logo(&meta).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct DomainInput {
    domain: String,
}

async fn domain_add(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Body(input): Body<DomainInput>,
) -> ApiResult<StatusCode> {
    state
        .services
        .company
        .add_domain(&input.domain, &meta)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn domain_remove(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Path(domain): Path<String>,
) -> ApiResult<StatusCode> {
    state.services.company.remove_domain(&domain, &meta).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LockInput {
    on: bool,
}

async fn domain_lock(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Body(input): Body<LockInput>,
) -> ApiResult<StatusCode> {
    state
        .services
        .company
        .set_domain_lock(input.on, &meta)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn role_add(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Body(input): Body<RoleInput>,
) -> ApiResult<Json<Role>> {
    Ok(Json(state.services.roles.add(input, &meta).await?))
}

async fn role_update(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Path(id): Path<Uuid>,
    Body(input): Body<RoleInput>,
) -> ApiResult<StatusCode> {
    state
        .services
        .roles
        .update(&id.to_string(), input, &meta)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn role_delete(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Path(id): Path<Uuid>,
) -> ApiResult<StatusCode> {
    state.services.roles.delete(&id.to_string(), &meta).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn user_add(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Body(input): Body<NewUserInput>,
) -> ApiResult<Json<IssuedLink>> {
    Ok(Json(state.services.users.master_add(input, &meta).await?))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RoleChange {
    role_id: String,
}

async fn user_role(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Path(id): Path<Uuid>,
    Body(input): Body<RoleChange>,
) -> ApiResult<StatusCode> {
    state
        .services
        .users
        .master_set_role(&id.to_string(), &input.role_id, &meta)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn user_delete(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Path(id): Path<Uuid>,
) -> ApiResult<StatusCode> {
    state
        .services
        .users
        .master_delete(&id.to_string(), &meta)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn user_reset(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<IssuedLink>> {
    Ok(Json(
        state
            .services
            .users
            .master_reset_link(&id.to_string(), &meta)
            .await?,
    ))
}

async fn user_clear_totp(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Path(id): Path<Uuid>,
) -> ApiResult<StatusCode> {
    state
        .services
        .users
        .master_clear_totp(&id.to_string(), &meta)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn file_get(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Path(id): Path<Uuid>,
) -> ApiResult<Response> {
    let (file, source) = state
        .services
        .files
        .master_open(&id.to_string(), &meta)
        .await?;
    stream_file(&file, source)
}

async fn file_delete(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Path(id): Path<Uuid>,
) -> ApiResult<StatusCode> {
    state
        .services
        .files
        .master_remove(&id.to_string(), &meta)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn smtp_get(State(state): State<AppState>, _m: MasterUser) -> ApiResult<Json<Value>> {
    let config = state.services.settings.smtp().await?;
    Ok(Json(match config {
        Some(c) => {
            json!({ "host": c.host, "port": c.port, "username": c.username, "from": c.from, "tls": c.tls, "hasPassword": !c.password.is_empty() })
        }
        None => {
            json!({ "host": "", "port": 587, "username": "", "from": "", "tls": "starttls", "hasPassword": false })
        }
    }))
}

async fn smtp_put(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Body(mut input): Body<SmtpConfig>,
) -> ApiResult<StatusCode> {
    input.host = validate::domain(&input.host)
        .or_else(|_| validate::required(&input.host, "SMTP sunucusu", 253))?;
    input.from = validate::email(&input.from)?;
    input.username = validate::text(&input.username, "Kullanıcı adı", 254)?;
    if !["starttls", "tls"].contains(&input.tls.as_str()) {
        return Err(AppError::validation("Bağlantı türü geçersiz.").into());
    }
    if !input.password.is_empty() {
        state
            .services
            .settings
            .set_secret(KEY_SMTP_PASSWORD, &input.password)
            .await?;
        input.password.clear();
    }
    state.services.settings.set_json(KEY_SMTP, &input).await?;
    state
        .services
        .audit
        .master(&meta, "smtp.save", &input.host, "")
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct TestMail {
    to: String,
}

async fn smtp_test(
    State(state): State<AppState>,
    _m: MasterUser,
    Body(input): Body<TestMail>,
) -> ApiResult<StatusCode> {
    let to = validate::email(&input.to)?;
    state
        .services
        .mail
        .send(
            &to,
            "dosyapı test e-postası",
            "SMTP ayarlarınız çalışıyor.".to_string(),
        )
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn dns_get(State(state): State<AppState>, _m: MasterUser) -> ApiResult<Json<Value>> {
    let dns = &state.services.dns;
    let config = dns.config().await?;
    Ok(Json(json!({
        "config": config,
        "hasToken": dns.has_token().await?,
        "providers": dns.provider_ids(),
    })))
}

fn url_of(config: &DnsConfig) -> String {
    format!("https://{}", config.domain)
}

async fn dns_put(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Body(input): Body<DnsConfigInput>,
) -> ApiResult<Json<DnsConfig>> {
    let config = state.services.dns.save(input, &meta).await?;
    if config.acme {
        state.public_url.set(url_of(&config));
    }
    Ok(Json(config))
}

async fn dns_check(State(state): State<AppState>, _m: MasterUser) -> ApiResult<Json<Value>> {
    Ok(Json(
        serde_json::to_value(state.services.dns.check().await?).map_err(AppError::internal)?,
    ))
}

async fn dns_push(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
) -> ApiResult<Json<Value>> {
    let count = state.services.dns.push_to_provider(&meta).await?;
    Ok(Json(json!({ "written": count })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ChannelInput {
    channel: String,
}

async fn update_channel(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Body(input): Body<ChannelInput>,
) -> ApiResult<StatusCode> {
    state
        .services
        .updates
        .set_channel(&input.channel, &meta)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn update_check(State(state): State<AppState>, _m: MasterUser) -> ApiResult<Json<Value>> {
    Ok(Json(
        serde_json::to_value(state.services.updates.check().await?).map_err(AppError::internal)?,
    ))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ConfirmInput {
    password: String,
}

async fn update_apply(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Body(input): Body<ConfirmInput>,
) -> ApiResult<Json<Value>> {
    state
        .services
        .master
        .confirm(&input.password, &meta)
        .await?;
    state.services.backups.create("pre-update").await?;
    let version = state.services.updates.apply(&meta).await?;
    Ok(Json(json!({ "version": version })))
}

async fn update_status(State(state): State<AppState>, _m: MasterUser) -> ApiResult<Json<Value>> {
    Ok(Json(
        serde_json::to_value(state.services.updates.status().await?).map_err(AppError::internal)?,
    ))
}

async fn backups_list(
    State(state): State<AppState>,
    _m: MasterUser,
) -> ApiResult<Json<Vec<BackupInfo>>> {
    Ok(Json(state.services.backups.list().await?))
}

async fn backups_create(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
) -> ApiResult<Json<BackupInfo>> {
    let info = state.services.backups.create("elle").await?;
    state
        .services
        .audit
        .master(&meta, "backup.create", &info.name, "")
        .await?;
    Ok(Json(info))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MasterPassword {
    old_password: String,
    new_password: String,
}

async fn password(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Body(input): Body<MasterPassword>,
) -> ApiResult<StatusCode> {
    state
        .services
        .master
        .change_password(&input.old_password, &input.new_password, &meta)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn totp_begin(State(state): State<AppState>, _m: MasterUser) -> ApiResult<Json<Value>> {
    let (secret, uri) = state.services.master.totp_begin()?;
    let qr = state.services.projects.qr.svg(&uri)?;
    Ok(Json(json!({ "secret": secret, "uri": uri, "qr": qr })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct TotpConfirm {
    secret: String,
    code: String,
}

async fn totp_confirm(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Body(input): Body<TotpConfirm>,
) -> ApiResult<StatusCode> {
    state
        .services
        .master
        .totp_confirm(&input.secret, &input.code, &meta)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn totp_disable(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Body(input): Body<ConfirmInput>,
) -> ApiResult<StatusCode> {
    state
        .services
        .master
        .totp_disable(&input.password, &meta)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct AuditQuery {
    before: Option<i64>,
}

async fn audit(
    State(state): State<AppState>,
    _m: MasterUser,
    Query(query): Query<AuditQuery>,
) -> ApiResult<Json<Vec<AuditRecord>>> {
    Ok(Json(
        state.services.audit_repo.list(100, query.before).await?,
    ))
}

async fn audit_verify(State(state): State<AppState>, _m: MasterUser) -> ApiResult<Json<Value>> {
    let broken = state.services.audit_repo.verify().await?;
    Ok(Json(
        json!({ "intact": broken.is_none(), "brokenAt": broken }),
    ))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ResetInput {
    password: String,
    confirm: String,
}

/// Geri dönüşsüz: master şifre ve yazılı onay ister, önce otomatik yedek alır.
async fn factory_reset(
    State(state): State<AppState>,
    _m: MasterUser,
    Meta(meta): Meta,
    Body(input): Body<ResetInput>,
) -> ApiResult<Response> {
    if input.confirm != "SIFIRLA" {
        return Err(AppError::validation("Onay metni hatalı.").into());
    }
    state
        .services
        .master
        .confirm(&input.password, &meta)
        .await?;
    state.services.backups.create("pre-reset").await?;
    state
        .services
        .audit
        .master(&meta, "system.factory_reset", "", "")
        .await?;
    state.services.eraser.erase_all().await?;
    let cookie = clear_cookie(&state, MASTER_COOKIE);
    Ok((
        AppendHeaders([(SET_COOKIE, cookie)]),
        StatusCode::NO_CONTENT,
    )
        .into_response())
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/master/login", post(login))
        .route("/master/logout", post(logout))
        .route("/master/state", get(state_view))
        .route("/master/identity", put(identity))
        .route("/master/notice", put(notice_put))
        .route("/master/logo", put(logo_put).delete(logo_delete))
        .route("/master/domains", post(domain_add))
        .route(
            "/master/domains/{domain}",
            axum::routing::delete(domain_remove),
        )
        .route("/master/domain-lock", put(domain_lock))
        .route("/master/roles", post(role_add))
        .route("/master/roles/{id}", put(role_update).delete(role_delete))
        .route("/master/users", post(user_add))
        .route("/master/users/{id}/role", put(user_role))
        .route("/master/users/{id}", axum::routing::delete(user_delete))
        .route("/master/users/{id}/reset-link", post(user_reset))
        .route("/master/users/{id}/clear-totp", post(user_clear_totp))
        .route("/master/files/{id}", get(file_get).delete(file_delete))
        .route("/master/smtp", get(smtp_get).put(smtp_put))
        .route("/master/smtp/test", post(smtp_test))
        .route("/master/dns", get(dns_get).put(dns_put))
        .route("/master/dns/check", post(dns_check))
        .route("/master/dns/push", post(dns_push))
        .route("/master/update/channel", put(update_channel))
        .route("/master/update/check", post(update_check))
        .route("/master/update/apply", post(update_apply))
        .route("/master/update/status", get(update_status))
        .route("/master/backups", get(backups_list).post(backups_create))
        .route("/master/password", post(password))
        .route("/master/totp/begin", post(totp_begin))
        .route("/master/totp/confirm", post(totp_confirm))
        .route("/master/totp/disable", post(totp_disable))
        .route("/master/audit", get(audit))
        .route("/master/audit/verify", get(audit_verify))
        .route("/master/factory-reset", post(factory_reset))
}
