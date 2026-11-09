use dosyapi_core::error::{AppError, AppResult};
use dosyapi_core::ports::QrRenderer;
use qrcode::QrCode;
use qrcode::render::svg;

pub struct SvgQr;

impl QrRenderer for SvgQr {
    fn svg(&self, text: &str) -> AppResult<String> {
        let code = QrCode::new(text.as_bytes()).map_err(AppError::internal)?;
        Ok(code
            .render::<svg::Color<'_>>()
            .min_dimensions(240, 240)
            .build())
    }
}
