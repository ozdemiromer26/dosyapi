//! Belge şablonu HTML temizleyici (izin listesi). Kaydetmeden önce sunucuda çalışır;
//! istemcideki DOMPurify ve CSP ikinci ve üçüncü savunma hattıdır.

use ammonia::{Builder, UrlRelative};
use dosyapi_core::ports::HtmlSanitizer;
use std::borrow::Cow;
use std::collections::HashSet;

const TAGS: &[&str] = &[
    "p",
    "br",
    "div",
    "span",
    "b",
    "strong",
    "i",
    "em",
    "u",
    "s",
    "strike",
    "sub",
    "sup",
    "h1",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "blockquote",
    "hr",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "colgroup",
    "col",
    "img",
    "font",
];

const ATTRIBUTES: &[&str] = &[
    "style",
    "align",
    "colspan",
    "rowspan",
    "width",
    "height",
    "data-v",
    "data-repeat",
    "data-pb",
    "data-sig",
    "data-hdr",
    "data-band",
    "data-fc",
    "data-bc",
    "data-bw",
    "data-bm",
    "contenteditable",
    "color",
    "face",
    "size",
];

const STYLE_PROPERTIES: &[&str] = &[
    "color",
    "background",
    "background-color",
    "border",
    "border-top",
    "border-right",
    "border-bottom",
    "border-left",
    "border-collapse",
    "border-color",
    "border-style",
    "border-width",
    "border-radius",
    "font",
    "font-family",
    "font-size",
    "font-style",
    "font-weight",
    "text-align",
    "text-decoration",
    "text-indent",
    "text-transform",
    "line-height",
    "letter-spacing",
    "margin",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "padding",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "width",
    "height",
    "min-width",
    "max-width",
    "vertical-align",
    "table-layout",
    "page-break-before",
    "page-break-after",
    "page-break-inside",
    "break-before",
    "break-after",
    "break-inside",
    "box-decoration-break",
    "-webkit-box-decoration-break",
    "outline",
    "outline-offset",
    "display",
    "white-space",
    "float",
    "clear",
    "object-fit",
];

fn safe_style(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    ![
        "url(",
        "expression",
        "@import",
        "javascript:",
        "behavior:",
        "\\",
    ]
    .iter()
    .any(|bad| lower.contains(bad))
}

fn safe_image(value: &str) -> bool {
    let is_data = [
        "data:image/png;base64,",
        "data:image/jpeg;base64,",
        "data:image/webp;base64,",
    ]
    .iter()
    .any(|prefix| value.starts_with(prefix));
    is_data || value == "/api/v1/public/logo"
}

pub struct AmmoniaSanitizer {
    builder: Builder<'static>,
}

impl Default for AmmoniaSanitizer {
    fn default() -> Self {
        let mut builder = Builder::empty();
        builder
            .tags(TAGS.iter().copied().collect())
            .generic_attributes(ATTRIBUTES.iter().copied().collect())
            .tag_attributes(
                [("img", ["src", "alt"].into_iter().collect::<HashSet<_>>())]
                    .into_iter()
                    .collect(),
            )
            .url_schemes(["data"].into_iter().collect())
            .url_relative(UrlRelative::PassThrough)
            .link_rel(None)
            .filter_style_properties(STYLE_PROPERTIES.iter().copied().collect())
            .attribute_filter(|element, attribute, value| match (element, attribute) {
                (_, "style") if !safe_style(value) => None,
                ("img", "src") if !safe_image(value) => None,
                (_, "contenteditable") if value != "false" => None,
                _ => Some(Cow::Borrowed(value)),
            });
        Self { builder }
    }
}

impl HtmlSanitizer for AmmoniaSanitizer {
    fn sanitize(&self, html: &str) -> String {
        self.builder.clean(html).to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn clean(html: &str) -> String {
        AmmoniaSanitizer::default().sanitize(html)
    }

    #[test]
    fn removes_scripts_and_handlers() {
        let out =
            clean(r#"<p onclick="x()">a</p><script>alert(1)</script><img src=x onerror=alert(1)>"#);
        assert!(
            !out.contains("onclick") && !out.contains("script") && !out.contains("onerror"),
            "{out}"
        );
    }

    #[test]
    fn removes_dangerous_urls() {
        for payload in [
            r#"<a href="javascript:alert(1)">x</a>"#,
            r#"<iframe src="https://kotu.example"></iframe>"#,
            r#"<svg onload=alert(1)></svg>"#,
            r#"<img src="https://kotu.example/iz.png">"#,
            r#"<img src="data:text/html;base64,PHNjcmlwdD4=">"#,
            r#"<img src="data:image/svg+xml;base64,PHN2Zz4=">"#,
            r#"<p style="background:url(https://kotu.example/x)">a</p>"#,
            r#"<style>@import 'x';</style>"#,
            r#"<form action="/x"><input></form>"#,
            r#"<meta http-equiv="refresh" content="0;url=https://kotu.example">"#,
        ] {
            let out = clean(payload);
            assert!(
                !out.contains("kotu.example")
                    && !out.contains("javascript:")
                    && !out.contains("data:text")
                    && !out.contains("svg"),
                "{payload} -> {out}"
            );
        }
    }

    #[test]
    fn keeps_document_markup() {
        let html = r#"<table style="width:100%"><tbody><tr data-repeat="muellifler"><td style="border:1px solid #444"><span data-v="muellifler[].ad" contenteditable="false">Ad</span></td></tr></tbody></table><div data-pb="1"></div>"#;
        let out = clean(html);
        assert!(
            out.contains("data-repeat=\"muellifler\"")
                && out.contains("data-v=")
                && out.contains("data-pb")
                && out.contains("border:1px solid #444"),
            "{out}"
        );
    }

    #[test]
    fn keeps_inline_images() {
        let out = clean(
            r#"<img src="data:image/png;base64,iVBOR=" alt="x"><img src="/api/v1/public/logo">"#,
        );
        assert!(
            out.contains("data:image/png") && out.contains("/api/v1/public/logo"),
            "{out}"
        );
    }
}
