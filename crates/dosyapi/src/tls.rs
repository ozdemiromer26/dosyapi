//! Yerleşik HTTPS: Let's Encrypt (TLS-ALPN-01) ile otomatik sertifika.

use crate::app::Runtime;
use crate::config::Config;
use anyhow::Result;
use axum::Router;
use axum::http::Uri;
use axum::response::Redirect;
use dosyapi_core::services::dns::DnsConfig;
use futures_util::StreamExt;
use rustls_acme::AcmeConfig;
use rustls_acme::caches::DirCache;
use std::net::SocketAddr;

/// DNS ayarında ACME açıksa HTTPS dinleyiciyi kurar, 80'den 443'e yönlendirir.
pub async fn serve(
    runtime: &Runtime,
    config: &Config,
    dns: &DnsConfig,
    https: SocketAddr,
    app: Router,
) -> Result<()> {
    let mut state = AcmeConfig::new([dns.domain.clone()])
        .contact([format!("mailto:{}", dns.acme_email)])
        .cache(DirCache::new(config.acme_cache()))
        .directory_lets_encrypt(true)
        .state();
    let acceptor = state.axum_acceptor(state.default_rustls_config());
    tokio::spawn(async move {
        while let Some(event) = state.next().await {
            match event {
                Ok(ok) => tracing::info!(?ok, "ACME"),
                Err(error) => tracing::error!(?error, "ACME hatası"),
            }
        }
    });

    let domain = dns.domain.clone();
    let redirect = Router::new().fallback(move |uri: Uri| {
        let target = format!(
            "https://{domain}{}",
            uri.path_and_query().map_or("/", |p| p.as_str())
        );
        async move { Redirect::permanent(&target) }
    });
    let plain = config.server.listen;
    tokio::spawn(async move {
        if let Ok(listener) = tokio::net::TcpListener::bind(plain).await {
            let _ = axum::serve(listener, redirect).await;
        }
    });

    runtime.public_url.set(format!("https://{}", dns.domain));
    axum_server::bind(https)
        .acceptor(acceptor)
        .serve(app.into_make_service_with_connect_info::<SocketAddr>())
        .await?;
    Ok(())
}
