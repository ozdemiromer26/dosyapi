//! Girdi doğrulama. Sınırda tek noktadan uygulanır; veritabanı sorguları ayrıca
//! parametrelidir, bu katman savunma derinliği sağlar.

use crate::error::{AppError, AppResult};

fn has_forbidden_chars(value: &str, allow_newlines: bool) -> bool {
    value.chars().any(|c| {
        (c.is_control() && !(allow_newlines && matches!(c, '\n' | '\r' | '\t'))) || c == '\u{202E}'
    })
}

/// Tek satırlık metin: kırpılır, denetim karakteri ve aşırı uzunluk reddedilir.
pub fn text(value: &str, label: &str, max: usize) -> AppResult<String> {
    let v = value.trim();
    if has_forbidden_chars(v, false) {
        return Err(AppError::validation(format!(
            "{label} geçersiz karakter içeriyor."
        )));
    }
    if v.chars().count() > max {
        return Err(AppError::validation(format!(
            "{label} en fazla {max} karakter olabilir."
        )));
    }
    Ok(v.to_string())
}

pub fn required(value: &str, label: &str, max: usize) -> AppResult<String> {
    let v = text(value, label, max)?;
    if v.is_empty() {
        return Err(AppError::validation(format!("{label} zorunlu.")));
    }
    Ok(v)
}

/// Çok satırlı metin (not alanı gibi).
pub fn multiline(value: &str, label: &str, max: usize) -> AppResult<String> {
    let v = value.trim();
    if has_forbidden_chars(v, true) {
        return Err(AppError::validation(format!(
            "{label} geçersiz karakter içeriyor."
        )));
    }
    if v.chars().count() > max {
        return Err(AppError::validation(format!(
            "{label} en fazla {max} karakter olabilir."
        )));
    }
    Ok(v.to_string())
}

pub fn email(value: &str) -> AppResult<String> {
    let v = value.trim().to_lowercase();
    let invalid = || AppError::validation("Geçerli bir e-posta adresi girin.");
    if v.len() > 254 || has_forbidden_chars(&v, false) || v.chars().any(char::is_whitespace) {
        return Err(invalid());
    }
    let (local, domain) = v.split_once('@').ok_or_else(invalid)?;
    if local.is_empty()
        || local.len() > 64
        || domain.contains('@')
        || !is_domain(domain)
        || !domain.contains('.')
    {
        return Err(invalid());
    }
    if local.chars().any(|c| {
        matches!(
            c,
            '<' | '>' | '"' | '\\' | ',' | ';' | ':' | '(' | ')' | '[' | ']'
        )
    }) {
        return Err(invalid());
    }
    Ok(v)
}

pub fn email_domain(value: &str) -> String {
    value.rsplit('@').next().unwrap_or_default().to_lowercase()
}

pub fn is_domain(value: &str) -> bool {
    if value.is_empty() || value.len() > 253 {
        return false;
    }
    value.split('.').all(|label| {
        !label.is_empty()
            && label.len() <= 63
            && !label.starts_with('-')
            && !label.ends_with('-')
            && label
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-')
    })
}

pub fn domain(value: &str) -> AppResult<String> {
    let v = value.trim().trim_start_matches('@').to_lowercase();
    if !is_domain(&v) || !v.contains('.') {
        return Err(AppError::validation(
            "Geçerli bir alan adı girin (ör. sirket.com).",
        ));
    }
    Ok(v)
}

pub fn hex_color(value: &str) -> AppResult<String> {
    let v = value.trim();
    let ok = v.len() == 7 && v.starts_with('#') && v[1..].bytes().all(|b| b.is_ascii_hexdigit());
    if !ok {
        return Err(AppError::validation("Renk #RRGGBB biçiminde olmalı."));
    }
    Ok(v.to_string())
}

pub fn phone(value: &str) -> AppResult<String> {
    let v = text(value, "Telefon", 32)?;
    if !v
        .chars()
        .all(|c| c.is_ascii_digit() || matches!(c, ' ' | '+' | '-' | '(' | ')'))
    {
        return Err(AppError::validation(
            "Telefon yalnızca rakam ve + - ( ) içerebilir.",
        ));
    }
    Ok(v)
}

/// TC kimlik (11 hane) ya da vergi numarası (10 hane). Boş bırakılabilir.
pub fn tax_id(value: &str) -> AppResult<String> {
    let v = value.trim();
    if v.is_empty() {
        return Ok(String::new());
    }
    if !(v.len() == 10 || v.len() == 11) || !v.bytes().all(|b| b.is_ascii_digit()) {
        return Err(AppError::validation(
            "TC kimlik 11, vergi numarası 10 haneli olmalı.",
        ));
    }
    Ok(v.to_string())
}

/// ISO tarih (YYYY-MM-DD) ya da boş.
pub fn iso_date(value: &str) -> AppResult<String> {
    let v = value.trim();
    if v.is_empty() {
        return Ok(String::new());
    }
    let b = v.as_bytes();
    let shape = b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && b.iter()
            .enumerate()
            .all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit());
    if !shape {
        return Err(AppError::validation("Tarih YYYY-AA-GG biçiminde olmalı."));
    }
    // Biçim doğru olsa da 2030-13-45 gibi takvimde olmayan günler reddedilir.
    let num = |r: std::ops::Range<usize>| v[r].parse::<u32>().unwrap_or(0);
    let (year, month, day) = (num(0..4), num(5..7), num(8..10));
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => 0,
    };
    if year == 0 || day == 0 || day > days {
        return Err(AppError::validation("Geçerli bir tarih girin."));
    }
    Ok(v.to_string())
}

pub fn uuid(value: &str) -> AppResult<String> {
    uuid::Uuid::parse_str(value)
        .map(|u| u.to_string())
        .map_err(|_| AppError::validation("Geçersiz kimlik."))
}

/// Dosya adını zararsızlaştırır: yol ayırıcı, denetim karakteri ve baştaki nokta atılır.
/// Sunucu diskinde bu ad hiç kullanılmaz; yalnızca indirme başlığında gösterilir.
pub fn file_name(value: &str) -> AppResult<String> {
    let base = value.rsplit(['/', '\\']).next().unwrap_or_default();
    let cleaned: String = base
        .chars()
        .filter(|c| {
            !c.is_control() && !matches!(c, '<' | '>' | ':' | '"' | '|' | '?' | '*' | '\u{202E}')
        })
        .collect();
    let cleaned = cleaned.trim().trim_start_matches('.').trim();
    if cleaned.is_empty() {
        return Err(AppError::validation("Geçersiz dosya adı."));
    }
    let mut out: String = cleaned
        .chars()
        .rev()
        .take(200)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    if out.len() > 400 {
        out = out.chars().take(100).collect();
    }
    Ok(out)
}

pub fn file_extension(name: &str) -> String {
    match name.rsplit_once('.') {
        Some((_, ext)) => ext.to_lowercase(),
        None => String::new(),
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn iso_date_checks_calendar() {
        assert_eq!(iso_date("").unwrap(), "");
        assert_eq!(iso_date("2028-02-29").unwrap(), "2028-02-29");
        for bad in [
            "2030-13-45",
            "2030-02-30",
            "2027-02-29",
            "2030-04-31",
            "0000-01-01",
            "2030-00-10",
            "2030-1-1",
        ] {
            assert!(iso_date(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn email_rejects_header_injection() {
        assert!(email("a@b.com\r\nBcc: x@y.com").is_err());
        assert!(email("a b@c.com").is_err());
        assert!(email("<a>@b.com").is_err());
        assert_eq!(email(" Ali@Sirket.COM ").unwrap(), "ali@sirket.com");
    }

    #[test]
    fn file_name_removes_traversal() {
        assert_eq!(file_name("../../etc/passwd").unwrap(), "passwd");
        assert_eq!(file_name("..\\..\\win.ini").unwrap(), "win.ini");
        assert_eq!(file_name(".htaccess").unwrap(), "htaccess");
        assert!(file_name("...").is_err());
        assert_eq!(file_name("a\u{202E}gpj.exe").unwrap(), "agpj.exe");
    }

    #[test]
    fn color_and_domain() {
        assert!(hex_color("#12ab3F").is_ok());
        assert!(hex_color("red;background:url(x)").is_err());
        assert!(domain("sirket.com").is_ok());
        assert!(domain("sirket.com/../x").is_err());
    }

    #[test]
    fn text_blocks_control_chars() {
        assert!(text("a\u{0}b", "x", 10).is_err());
        assert!(required("   ", "x", 10).is_err());
        assert!(text("0123456789a", "x", 10).is_err());
    }
}
