//! Dosya yükleme ve indirme: akış halinde, belleğe alınmadan.

use crate::http::AppState;
use crate::http::error::ApiResult;
use crate::http::extract::*;
use async_trait::async_trait;
use axum::Json;
use axum::Router;
use axum::body::{Body as HttpBody, BodyDataStream};
use axum::extract::{DefaultBodyLimit, Path, Query, Request, State};
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::Response;
use axum::routing::{get, post};
use dosyapi_core::AppError;
use dosyapi_core::model::StoredFile;
use dosyapi_core::ports::{ChunkReader, FileSource};
use dosyapi_core::services::bootstrap::{FileView, file_view};
use dosyapi_core::services::changes::Submitted;
use dosyapi_core::services::files::MAX_PHOTO_BYTES;
use dosyapi_core::services::files::UploadRequest;
use futures_util::StreamExt;
use percent_encoding::{NON_ALPHANUMERIC, utf8_percent_encode};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use uuid::Uuid;

const IDLE: Duration = Duration::from_secs(60);

struct BodyChunks(BodyDataStream);

#[async_trait]
impl ChunkReader for BodyChunks {
    async fn next_chunk(&mut self) -> Result<Option<Vec<u8>>, AppError> {
        match tokio::time::timeout(IDLE, self.0.next()).await {
            Err(_) => Err(AppError::validation("Yükleme zaman aşımına uğradı.")),
            Ok(None) => Ok(None),
            Ok(Some(Ok(bytes))) => Ok(Some(bytes.to_vec())),
            Ok(Some(Err(_))) => Err(AppError::validation("Yükleme yarıda kesildi.")),
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct UploadQuery {
    name: String,
    #[serde(default)]
    doc_type: Option<Uuid>,
}

#[derive(Serialize)]
struct UploadResult {
    file: FileView,
    result: Submitted,
}

async fn upload(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(project): Path<Uuid>,
    Query(query): Query<UploadQuery>,
    request: Request,
) -> ApiResult<Json<UploadResult>> {
    let mut reader = BodyChunks(request.into_body().into_data_stream());
    let upload = UploadRequest {
        project_id: project.to_string(),
        doc_type_id: query.doc_type.map(|d| d.to_string()),
        file_name: query.name,
    };
    let (file, result) = state
        .services
        .files
        .upload(&auth.actor, upload, &mut reader)
        .await?;
    Ok(Json(UploadResult {
        file: file_view(&file),
        result,
    }))
}

/// İndirme her zaman ek olarak sunulur ve türü ikili veridir: tarayıcıda çalıştırılamaz.
pub fn stream_file(file: &StoredFile, source: Box<dyn FileSource>) -> ApiResult<Response> {
    let stream = futures_util::stream::unfold(source, |mut source| async move {
        match source.next_chunk().await {
            Ok(Some(chunk)) => Some((
                Ok::<_, std::io::Error>(axum::body::Bytes::from(chunk)),
                source,
            )),
            Ok(None) => None,
            Err(error) => {
                tracing::error!(?error, "dosya okunamadı");
                Some((Err(std::io::Error::other("okuma hatası")), source))
            }
        }
    });
    let mut response = Response::new(HttpBody::from_stream(stream));
    let headers = response.headers_mut();
    let encoded = utf8_percent_encode(&file.name, NON_ALPHANUMERIC).to_string();
    let disposition = format!("attachment; filename*=UTF-8''{encoded}");
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&disposition).map_err(AppError::internal)?,
    );
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/octet-stream"),
    );
    headers.insert(header::CONTENT_LENGTH, HeaderValue::from(file.size as u64));
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, no-store"),
    );
    Ok(response)
}

async fn download(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Response> {
    let (file, source) = state
        .services
        .files
        .open(&auth.actor, &id.to_string())
        .await?;
    stream_file(&file, source)
}

async fn remove(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Submitted>> {
    Ok(Json(
        state
            .services
            .files
            .remove(&auth.actor, &id.to_string())
            .await?,
    ))
}

async fn photo_get(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Response> {
    let (bytes, mime) = state
        .services
        .files
        .photo(&auth.actor, &id.to_string())
        .await?;
    let mut response = Response::new(HttpBody::from(bytes));
    let headers = response.headers_mut();
    // Tür yüklemede içerik imzasından belirlendi (PNG/JPEG/WEBP); betik taşıyamaz.
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&mime).map_err(AppError::internal)?,
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_static("inline"),
    );
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, no-store"),
    );
    Ok(response)
}

async fn photo_put(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
    body: axum::body::Bytes,
) -> ApiResult<StatusCode> {
    state
        .services
        .files
        .save_photo(&auth.actor, &id.to_string(), &body)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn photo_delete(
    State(state): State<AppState>,
    AuthUser(auth): AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<StatusCode> {
    state
        .services
        .files
        .remove_photo(&auth.actor, &id.to_string())
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/projects/{id}/photo",
            get(photo_get)
                .put(photo_put)
                .delete(photo_delete)
                .layer(DefaultBodyLimit::max(MAX_PHOTO_BYTES + 1024)),
        )
        .route(
            "/projects/{id}/files",
            post(upload).layer(DefaultBodyLimit::disable()),
        )
        .route("/files/{id}", get(download).delete(remove))
}
