//! Web arayüzü ikili dosyaya gömülüdür: tek dosya kurulum.

use axum::body::Body;
use axum::http::{HeaderValue, Method, Response, StatusCode, Uri, header};
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "../../web/dist"]
struct WebAssets;

fn asset(path: &str, immutable: bool) -> Option<Response<Body>> {
    let file = WebAssets::get(path)?;
    let mime = mime_guess::from_path(path).first_or_octet_stream();
    let mut response = Response::new(Body::from(file.data.into_owned()));
    let headers = response.headers_mut();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(mime.as_ref()).ok()?,
    );
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static(if immutable {
            "public, max-age=31536000, immutable"
        } else {
            "no-cache"
        }),
    );
    Some(response)
}

/// Dosya varsa onu, yoksa tek sayfalık uygulamanın giriş sayfasını döner.
pub async fn serve(method: Method, uri: Uri) -> Response<Body> {
    let path = uri.path().trim_start_matches('/');
    if path.starts_with("api/") {
        let mut response = Response::new(Body::from(
            r#"{"error":{"code":"not_found","message":"Kayıt bulunamadı."}}"#,
        ));
        *response.status_mut() = StatusCode::NOT_FOUND;
        return response;
    }
    if method != Method::GET && method != Method::HEAD {
        let mut response = Response::new(Body::empty());
        *response.status_mut() = StatusCode::METHOD_NOT_ALLOWED;
        response
            .headers_mut()
            .insert(header::ALLOW, HeaderValue::from_static("GET, HEAD"));
        return response;
    }
    if !path.is_empty()
        && let Some(found) = asset(path, path.starts_with("assets/"))
    {
        return found;
    }
    asset("index.html", false).unwrap_or_else(|| {
        let mut response = Response::new(Body::from("Web arayüzü derlenmemiş."));
        *response.status_mut() = StatusCode::SERVICE_UNAVAILABLE;
        response
    })
}
