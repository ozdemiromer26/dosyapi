use async_trait::async_trait;
use dosyapi_core::error::{AppError, AppResult};
use dosyapi_core::ports::{Mail, Mailer, SmtpConfig};
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use std::time::Duration;

/// SMTP gönderimi. Bağlantı her zaman şifrelidir (STARTTLS zorunlu ya da doğrudan TLS).
pub struct SmtpMailer;

#[async_trait]
impl Mailer for SmtpMailer {
    async fn send(&self, config: &SmtpConfig, mail: Mail) -> AppResult<()> {
        let unavailable = |error: String| {
            tracing::warn!(%error, "e-posta gönderilemedi");
            AppError::Unavailable("E-posta gönderilemedi. SMTP ayarlarını kontrol edin.".into())
        };
        let message = Message::builder()
            .from(
                config
                    .from
                    .parse()
                    .map_err(|_| AppError::validation("Gönderen adresi geçersiz."))?,
            )
            .to(mail
                .to
                .parse()
                .map_err(|_| AppError::validation("Alıcı adresi geçersiz."))?)
            .subject(mail.subject)
            .header(ContentType::TEXT_PLAIN)
            .body(mail.body)
            .map_err(AppError::internal)?;
        let builder = if config.tls == "tls" {
            AsyncSmtpTransport::<Tokio1Executor>::relay(&config.host)
        } else {
            AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&config.host)
        }
        .map_err(|e| unavailable(e.to_string()))?;
        let transport = builder
            .port(config.port)
            .timeout(Some(Duration::from_secs(15)))
            .credentials(Credentials::new(
                config.username.clone(),
                config.password.clone(),
            ))
            .build();
        transport
            .send(message)
            .await
            .map_err(|e| unavailable(e.to_string()))?;
        Ok(())
    }
}
