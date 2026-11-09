use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

/// Uygulama genelindeki hata türü.
///
/// `Display` çıktısı kullanıcıya gösterilebilir; `Internal` içeriği asla
/// istemciye gönderilmez, yalnızca sunucu günlüğüne yazılır.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("{0}")]
    Validation(String),
    #[error("Oturum açmanız gerekiyor.")]
    Unauthorized,
    #[error("E-posta veya şifre hatalı.")]
    InvalidCredentials,
    #[error("İki adımlı doğrulama kodu gerekli.")]
    TotpRequired,
    #[error("Bu işlem için yetkiniz yok.")]
    Forbidden,
    #[error("Kayıt bulunamadı.")]
    NotFound,
    #[error("{0}")]
    Conflict(String),
    #[error("Çok fazla deneme yapıldı. Lütfen {retry_after_secs} saniye sonra tekrar deneyin.")]
    RateLimited { retry_after_secs: u64 },
    #[error("{0}")]
    PayloadTooLarge(String),
    #[error("{0}")]
    Unavailable(String),
    #[error("Beklenmeyen bir sunucu hatası oluştu.")]
    Internal(String),
}

impl AppError {
    pub fn validation(message: impl Into<String>) -> Self {
        Self::Validation(message.into())
    }
    pub fn conflict(message: impl Into<String>) -> Self {
        Self::Conflict(message.into())
    }
    pub fn internal(message: impl std::fmt::Display) -> Self {
        Self::Internal(message.to_string())
    }
}
