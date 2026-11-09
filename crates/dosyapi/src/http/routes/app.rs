//! Kullanıcı oturumu gerektiren uç noktalar.

use crate::http::AppState;
use crate::http::error::ApiResult;
use crate::http::extract::*;
use axum::Json;
use axum::Router;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::http::header::CONTENT_TYPE;
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post, put};
use dosyapi_core::model::*;
use dosyapi_core::services::changes::Submitted;
use dosyapi_core::services::messages::SendInput;
use dosyapi_core::services::users::ProfileInput;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

#[derive(Serialize)]
struct SubmitResult {
    id: Option<Id>,
    result: Submitted,
}

fn done(result: Submitted) -> Json<SubmitResult> {
    Json(SubmitResult { id: None, result })
}

fn created((id, result): (Id, Submitted)) -> Json<SubmitResult> {
    Json(SubmitResult {
        id: Some(id),
        result,
    })
}

async fn bootstrap(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
) -> ApiResult<Json<Value>> {
    let csrf = state.services.auth.csrf_token(&auth.token_hash);
    let data = state
        .services
        .bootstrap
        .for_actor(&auth.actor, csrf)
        .await?;
    // KVKK erişim kaydı: kişisel veriyi açık gören kullanıcı için saatte en fazla bir kayıt.
    let actor = &auth.actor;
    if (actor.sees_project_pii() || actor.sees_record_pii())
        && state
            .services
            .limiter
            .hit(&format!("pii-log:{}", actor.user_id), 1, 3600)
            .is_ok()
    {
        state
            .services
            .audit
            .user(actor, "pii.access", &actor.user_id, "")
            .await?;
    }
    let mut value = serde_json::to_value(data).map_err(dosyapi_core::AppError::internal)?;
    // Hakkında ekranı için: kurulu sürümün geliş tarihi ve geliştiren.
    value["installedAt"] = json!(state.services.updates.record_running_version().await?);
    value["developer"] = json!(env!("CARGO_PKG_AUTHORS"));
    value["unreadMessages"] = json!(state.services.messages.unread(&auth.actor).await?);
    Ok(Json(value))
}

async fn project_create(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Body(input): Body<ProjectInput>,
) -> ApiResult<Json<SubmitResult>> {
    Ok(created(
        state.services.projects.create(&auth.actor, input).await?,
    ))
}

async fn project_update(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
    Body(input): Body<ProjectInput>,
) -> ApiResult<Json<SubmitResult>> {
    Ok(done(
        state
            .services
            .projects
            .update(&auth.actor, &id.to_string(), input)
            .await?,
    ))
}

async fn project_delete(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<SubmitResult>> {
    Ok(done(
        state
            .services
            .projects
            .delete(&auth.actor, &id.to_string())
            .await?,
    ))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AuthorSlot {
    job: String,
    #[serde(default)]
    author_id: String,
}

async fn project_author(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
    Body(input): Body<AuthorSlot>,
) -> ApiResult<Json<SubmitResult>> {
    Ok(done(
        state
            .services
            .projects
            .assign_author(&auth.actor, &id.to_string(), &input.job, &input.author_id)
            .await?,
    ))
}

async fn project_qr(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Response> {
    let svg = state
        .services
        .projects
        .board_qr(&auth.actor, &id.to_string(), &state.public_url.get())
        .await?;
    Ok(([(CONTENT_TYPE, "image/svg+xml")], svg).into_response())
}

async fn author_create(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Body(input): Body<AuthorInput>,
) -> ApiResult<Json<SubmitResult>> {
    Ok(created(
        state
            .services
            .records
            .create_author(&auth.actor, input)
            .await?,
    ))
}

async fn author_update(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
    Body(input): Body<AuthorInput>,
) -> ApiResult<Json<SubmitResult>> {
    Ok(done(
        state
            .services
            .records
            .update_author(&auth.actor, &id.to_string(), input)
            .await?,
    ))
}

async fn author_delete(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<SubmitResult>> {
    Ok(done(
        state
            .services
            .records
            .delete_author(&auth.actor, &id.to_string())
            .await?,
    ))
}

async fn contractor_create(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Body(input): Body<ContractorInput>,
) -> ApiResult<Json<SubmitResult>> {
    Ok(created(
        state
            .services
            .records
            .create_contractor(&auth.actor, input)
            .await?,
    ))
}

async fn contractor_update(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
    Body(input): Body<ContractorInput>,
) -> ApiResult<Json<SubmitResult>> {
    Ok(done(
        state
            .services
            .records
            .update_contractor(&auth.actor, &id.to_string(), input)
            .await?,
    ))
}

async fn contractor_delete(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<SubmitResult>> {
    Ok(done(
        state
            .services
            .records
            .delete_contractor(&auth.actor, &id.to_string())
            .await?,
    ))
}

async fn task_add(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Body(input): Body<TaskInput>,
) -> ApiResult<Json<Task>> {
    Ok(Json(state.services.tasks.assign(&auth.actor, input).await?))
}

async fn task_update(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
    Body(input): Body<TaskInput>,
) -> ApiResult<Json<Task>> {
    Ok(Json(
        state
            .services
            .tasks
            .update(&auth.actor, &id.to_string(), input)
            .await?,
    ))
}

async fn task_toggle(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<StatusCode> {
    state
        .services
        .tasks
        .toggle(&auth.actor, &id.to_string())
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn task_delete(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<StatusCode> {
    state
        .services
        .tasks
        .delete(&auth.actor, &id.to_string())
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct TodoInput {
    text: String,
}

async fn todo_add(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Body(input): Body<TodoInput>,
) -> ApiResult<Json<Todo>> {
    Ok(Json(
        state
            .services
            .tasks
            .add_todo(&auth.actor, &input.text)
            .await?,
    ))
}

async fn todo_toggle(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<StatusCode> {
    state
        .services
        .tasks
        .toggle_todo(&auth.actor, &id.to_string())
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn todo_delete(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<StatusCode> {
    state
        .services
        .tasks
        .delete_todo(&auth.actor, &id.to_string())
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn messages_list(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
) -> ApiResult<Json<Vec<ConversationView>>> {
    Ok(Json(state.services.messages.list(&auth.actor).await?))
}

async fn messages_unread(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
) -> ApiResult<Json<Value>> {
    let count = state.services.messages.unread(&auth.actor).await?;
    Ok(Json(json!({ "unread": count })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ThreadQuery {
    before: Option<i64>,
}

async fn messages_thread(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<ThreadQuery>,
) -> ApiResult<Json<Value>> {
    let (conversation, list) = state
        .services
        .messages
        .thread(&auth.actor, &id.to_string(), q.before)
        .await?;
    Ok(Json(json!({
        "id": conversation.id,
        "otherId": conversation.other(&auth.actor.user_id),
        "messages": list,
        "hasMore": list.len() as i64 >= dosyapi_core::services::messages::PAGE,
    })))
}

async fn messages_send(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Body(input): Body<SendInput>,
) -> ApiResult<Json<Message>> {
    Ok(Json(
        state.services.messages.send(&auth.actor, input).await?,
    ))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct NoteInput {
    body: String,
}

async fn note_get(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<ProjectNote>> {
    Ok(Json(
        state
            .services
            .tasks
            .note(&auth.actor, &id.to_string())
            .await?,
    ))
}

async fn note_put(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
    Body(input): Body<NoteInput>,
) -> ApiResult<Json<ProjectNote>> {
    Ok(Json(
        state
            .services
            .tasks
            .save_note(&auth.actor, &id.to_string(), &input.body)
            .await?,
    ))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ApproveInput {
    #[serde(default)]
    role_id: Option<String>,
}

async fn approve(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
    Body(input): Body<ApproveInput>,
) -> ApiResult<StatusCode> {
    state
        .services
        .approvals
        .approve(&auth.actor, &id.to_string(), input.role_id.as_deref())
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn reject(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<StatusCode> {
    state
        .services
        .approvals
        .reject(&auth.actor, &id.to_string())
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn profile_update(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Meta(meta): Meta,
    Body(input): Body<ProfileInput>,
) -> ApiResult<StatusCode> {
    state
        .services
        .users
        .update_profile(&auth.actor, input, &meta)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PasswordInput {
    old_password: String,
    new_password: String,
}

async fn profile_password(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Meta(meta): Meta,
    Body(input): Body<PasswordInput>,
) -> ApiResult<StatusCode> {
    state
        .services
        .auth
        .change_password(&auth, &input.old_password, &input.new_password, &meta)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn profile_delete_request(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
) -> ApiResult<StatusCode> {
    state
        .services
        .users
        .request_self_delete(&auth.actor)
        .await?;
    Ok(StatusCode::ACCEPTED)
}

async fn profile_logout_others(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Meta(meta): Meta,
) -> ApiResult<StatusCode> {
    state.services.auth.logout_everywhere(&auth, &meta).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn totp_begin(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
) -> ApiResult<Json<Value>> {
    let (secret, uri) = state.services.auth.totp_begin(&auth.actor).await?;
    // QR sunucuda üretilir; gizli anahtar üçüncü taraf bir QR servisine gitmez.
    let qr = state.services.projects.qr.svg(&uri)?;
    Ok(Json(json!({ "secret": secret, "uri": uri, "qr": qr })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct CodeInput {
    code: String,
}

/// Kurtarma kodları yalnızca bu yanıtta düz metin olarak görünür; sunucuda özetleri kalır.
async fn totp_confirm(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Meta(meta): Meta,
    Body(input): Body<CodeInput>,
) -> ApiResult<Json<Value>> {
    let codes = state
        .services
        .auth
        .totp_confirm(&auth.actor, &input.code, &meta)
        .await?;
    Ok(Json(json!({ "recoveryCodes": codes })))
}

async fn totp_recovery(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Meta(meta): Meta,
    Body(input): Body<PasswordOnly>,
) -> ApiResult<Json<Value>> {
    let codes = state
        .services
        .auth
        .totp_recovery_regenerate(&auth.actor, &input.password, &meta)
        .await?;
    Ok(Json(json!({ "recoveryCodes": codes })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PasswordOnly {
    password: String,
}

async fn totp_disable(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Meta(meta): Meta,
    Body(input): Body<PasswordOnly>,
) -> ApiResult<StatusCode> {
    state
        .services
        .auth
        .totp_disable(&auth.actor, &input.password, &meta)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn template_save(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Body(input): Body<Template>,
) -> ApiResult<Json<Template>> {
    Ok(Json(
        state.services.templates.save(&auth.actor, input).await?,
    ))
}

async fn template_delete(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<StatusCode> {
    state
        .services
        .templates
        .delete(&auth.actor, &id.to_string())
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn doc_type_add(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Body(input): Body<DocTypeInput>,
) -> ApiResult<Json<DocType>> {
    Ok(Json(
        state
            .services
            .company
            .add_doc_type(&auth.actor, input)
            .await?,
    ))
}

async fn doc_type_update(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
    Body(input): Body<DocTypeInput>,
) -> ApiResult<StatusCode> {
    state
        .services
        .company
        .update_doc_type(&auth.actor, &id.to_string(), input)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn doc_type_delete(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<StatusCode> {
    state
        .services
        .company
        .delete_doc_type(&auth.actor, &id.to_string())
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ProfessionInput {
    name: String,
    #[serde(default = "yes")]
    required: bool,
}

fn yes() -> bool {
    true
}

async fn profession_save(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Body(input): Body<ProfessionInput>,
) -> ApiResult<StatusCode> {
    state
        .services
        .company
        .save_profession(&auth.actor, &input.name, input.required)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn profession_delete(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(name): Path<String>,
) -> ApiResult<StatusCode> {
    state
        .services
        .company
        .delete_profession(&auth.actor, &name)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RoleChange {
    role_id: String,
}

async fn user_role(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
    Body(input): Body<RoleChange>,
) -> ApiResult<StatusCode> {
    state
        .services
        .users
        .set_role(&auth.actor, &id.to_string(), &input.role_id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn user_delete(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<StatusCode> {
    state
        .services
        .users
        .delete(&auth.actor, &id.to_string())
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/bootstrap", get(bootstrap))
        .route("/projects", post(project_create))
        .route("/projects/{id}", put(project_update).delete(project_delete))
        .route("/projects/{id}/authors", put(project_author))
        .route("/projects/{id}/board-qr", get(project_qr))
        .route("/projects/{id}/note", get(note_get).put(note_put))
        .route("/authors", post(author_create))
        .route("/authors/{id}", put(author_update).delete(author_delete))
        .route("/contractors", post(contractor_create))
        .route(
            "/contractors/{id}",
            put(contractor_update).delete(contractor_delete),
        )
        .route("/tasks", post(task_add))
        .route("/tasks/{id}/toggle", post(task_toggle))
        .route("/tasks/{id}", put(task_update).delete(task_delete))
        .route("/messages", get(messages_list).post(messages_send))
        .route("/messages/unread", get(messages_unread))
        .route("/messages/{id}", get(messages_thread))
        .route("/todos", post(todo_add))
        .route("/todos/{id}/toggle", post(todo_toggle))
        .route("/todos/{id}", delete(todo_delete))
        .route("/approvals/{id}/approve", post(approve))
        .route("/approvals/{id}/reject", post(reject))
        .route("/profile", put(profile_update))
        .route("/profile/password", post(profile_password))
        .route("/profile/delete-request", post(profile_delete_request))
        .route("/profile/logout-others", post(profile_logout_others))
        .route("/profile/totp/begin", post(totp_begin))
        .route("/profile/totp/confirm", post(totp_confirm))
        .route("/profile/totp/recovery", post(totp_recovery))
        .route("/profile/totp/disable", post(totp_disable))
        .route("/templates", put(template_save))
        .route("/templates/{id}", delete(template_delete))
        .route("/doc-types", post(doc_type_add))
        .route(
            "/doc-types/{id}",
            put(doc_type_update).delete(doc_type_delete),
        )
        .route("/professions", post(profession_save))
        .route("/professions/{name}", delete(profession_delete))
        .route("/users/{id}/role", put(user_role))
        .route("/users/{id}", delete(user_delete))
}
