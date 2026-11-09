use crate::error::{AppError, AppResult};
use crate::ports::{Mail, Mailer};
use crate::services::settings::Settings;
use std::sync::Arc;

/// Şirket SMTP ayarlarıyla e-posta gönderir.
#[derive(Clone)]
pub struct MailService {
    mailer: Arc<dyn Mailer>,
    settings: Settings,
}

impl MailService {
    pub fn new(mailer: Arc<dyn Mailer>, settings: Settings) -> Self {
        Self { mailer, settings }
    }

    pub async fn is_configured(&self) -> AppResult<bool> {
        Ok(self.settings.smtp().await?.is_some())
    }

    pub async fn send(&self, to: &str, subject: &str, body: String) -> AppResult<()> {
        let Some(config) = self.settings.smtp().await? else {
            return Err(AppError::Unavailable(
                "E-posta sunucusu (SMTP) yapılandırılmamış.".into(),
            ));
        };
        self.mailer
            .send(
                &config,
                Mail {
                    to: to.into(),
                    subject: subject.into(),
                    body,
                },
            )
            .await
    }
}
