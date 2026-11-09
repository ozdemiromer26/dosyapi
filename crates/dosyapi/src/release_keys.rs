//! Güncelleme imzası için güvenilen açık anahtarlar ve varsayılan güncelleme adresi.
//! Anahtar döndürme için listeye yeni anahtar eklenir, eskisi bir sürüm sonra çıkarılır.
//! Gizli anahtar asla depoya girmez (bkz. docs/GUNCELLEME.md).

/// Hex kodlu Ed25519 açık anahtarlar. Derleme sırasında `DOSYAPI_RELEASE_PUBKEYS`
/// (virgülle ayrılmış) ile verilir. Boşsa güncelleme denetimi kapalıdır.
pub fn trusted_keys() -> Vec<&'static str> {
    option_env!("DOSYAPI_RELEASE_PUBKEYS")
        .unwrap_or("")
        .split(',')
        .map(str::trim)
        .filter(|k| !k.is_empty())
        .collect()
}

pub fn default_update_url() -> &'static str {
    option_env!("DOSYAPI_UPDATE_URL").unwrap_or("")
}
