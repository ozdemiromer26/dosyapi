import DOMPurify from "dompurify";

/**
 * Sunucu şablonu kaydederken temizler. Bu ikinci hat, DOM'a yazılmadan hemen önce
 * çalışır; CSP ise üçüncü hattır.
 */
export function cleanHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["contenteditable"],
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "svg", "math", "link", "meta", "base"],
    ALLOW_DATA_ATTR: true,
  });
}
