//! Parola politikası. Prototipteki 4 karakter sınırı üretimde yeterli değil.

use crate::error::{AppError, AppResult};

pub const MIN_LEN: usize = 12;
pub const MAX_LEN: usize = 128;

/// Uzun ve tahmin edilmesi zor parola zorunlu kılar. `context` parolada
/// kullanılmaması gereken kişisel bilgilerdir (e-posta, ad).
pub fn check(password: &str, context: &[&str]) -> AppResult<()> {
    let len = password.chars().count();
    if len < MIN_LEN {
        return Err(AppError::validation(format!(
            "Şifre en az {MIN_LEN} karakter olmalı."
        )));
    }
    if len > MAX_LEN {
        return Err(AppError::validation(format!(
            "Şifre en fazla {MAX_LEN} karakter olabilir."
        )));
    }
    let estimate = zxcvbn::zxcvbn(password, context);
    if (estimate.score() as u8) < 3 {
        return Err(AppError::validation(
            "Şifre kolay tahmin edilebilir. Daha uzun ve kişisel bilgi içermeyen bir şifre seçin.",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::check;

    #[test]
    fn rejects_weak_and_personal() {
        assert!(check("1234", &[]).is_err());
        assert!(check("password1234", &[]).is_err());
        assert!(check("yonetici@yapi.com", &["yonetici@yapi.com"]).is_err());
        assert!(check("Kirmizi-Vinc-73-Sarp-Kaya", &[]).is_ok());
    }
}
