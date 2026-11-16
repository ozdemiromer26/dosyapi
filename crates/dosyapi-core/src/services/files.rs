//! Dosya yükleme/indirme. Uzantı izin listesi + içerik imzası denetlenir,
//! dosyalar diskte şifreli ve rastgele adla tutulur, indirme yetkiye bağlıdır.

use crate::error::{AppError, AppResult};
use crate::model::*;
use crate::ports::*;
use crate::services::audit::Auditor;
use crate::services::changes::*;
use crate::validate;
use sha2::{Digest, Sha256};
use std::sync::Arc;

pub const MAX_FILE_BYTES: u64 = 512 * 1024 * 1024;
pub const MAX_LOGO_BYTES: usize = 2 * 1024 * 1024;
/// İstemci fotoğrafı göndermeden önce küçültür; bu sınır yalnızca üst güvenlik sınırıdır.
pub const MAX_PHOTO_BYTES: usize = 3 * 1024 * 1024;

/// Hiçbir belge tipine eklenemeyen, hiçbir koşulda yüklenemeyen türler: çalıştırılabilir
/// programlar, betikler ve tarayıcıda kod çalıştırabilen biçimler. Platform bunların
/// dağıtım aracına dönüşmemeli.
const BLOCKED: &[&str] = &[
    "exe",
    "msi",
    "msp",
    "com",
    "scr",
    "pif",
    "cpl",
    "dll",
    "sys",
    "drv",
    "ocx",
    "bat",
    "cmd",
    "ps1",
    "psm1",
    "psd1",
    "vbs",
    "vbe",
    "js",
    "jse",
    "mjs",
    "cjs",
    "wsf",
    "wsh",
    "hta",
    "lnk",
    "reg",
    "inf",
    "jar",
    "class",
    "sh",
    "bash",
    "zsh",
    "csh",
    "ksh",
    "command",
    "app",
    "dmg",
    "pkg",
    "mpkg",
    "apk",
    "xapk",
    "ipa",
    "deb",
    "rpm",
    "run",
    "bin",
    "elf",
    "so",
    "dylib",
    "html",
    "htm",
    "xhtml",
    "shtml",
    "mht",
    "mhtml",
    "svg",
    "svgz",
    "xht",
    "php",
    "phtml",
    "phar",
    "asp",
    "aspx",
    "jsp",
    "cgi",
    "pl",
    "py",
    "pyc",
    "rb",
    "applescript",
    "scpt",
    "workflow",
    "desktop",
    "url",
    "webloc",
    "appref-ms",
    "gadget",
    "msc",
    "application",
    "xbap",
    "xll",
    "iqy",
    "settingcontent-ms",
];

/// Bir belge tipine yazılabilecek en çok uzantı.
pub const MAX_EXTENSIONS: usize = 40;

pub fn is_blocked(extension: &str) -> bool {
    BLOCKED.contains(&extension)
}

/// Şirket ayarlarında girilen uzantıları düzenler: küçük harf, baştaki nokta atılır,
/// virgül ya da boşlukla ayrılmış birden çok uzantı ayrılır, tekrarlar silinir.
/// Tehlikeli türler ve uzantı olamayacak değerler reddedilir.
pub fn extensions(input: &[String]) -> AppResult<Vec<String>> {
    let mut out: Vec<String> = Vec::new();
    for raw in input
        .iter()
        .flat_map(|v| v.split(|c: char| c == ',' || c == ';' || c.is_whitespace()))
    {
        let ext = raw.trim().trim_start_matches('.').to_lowercase();
        if ext.is_empty() {
            continue;
        }
        let shape = ext.len() <= 16
            && ext
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
        if !shape {
            return Err(AppError::validation(format!(
                "Geçersiz uzantı: {}. Yalnızca harf ve rakam kullanın (ör. pdf, mp4).",
                raw.chars().take(20).collect::<String>()
            )));
        }
        if is_blocked(&ext) {
            return Err(AppError::validation(format!(
                ".{ext} güvenlik nedeniyle yüklenebilecek türler arasına eklenemez."
            )));
        }
        if !out.contains(&ext) {
            out.push(ext);
        }
    }
    if out.len() > MAX_EXTENSIONS {
        return Err(AppError::validation(format!(
            "Bir belge tipine en çok {MAX_EXTENSIONS} uzantı eklenebilir."
        )));
    }
    Ok(out)
}

fn starts(head: &[u8], magic: &[u8]) -> bool {
    head.len() >= magic.len() && &head[..magic.len()] == magic
}

const ZIP: &[u8] = b"PK\x03\x04";
const OLE: &[u8] = &[0xD0, 0xCF, 0x11, 0xE0];

fn is_text(head: &[u8]) -> bool {
    !head.contains(&0)
}

fn riff(head: &[u8], form: &[u8; 4]) -> bool {
    head.len() >= 12 && &head[..4] == b"RIFF" && &head[8..12] == form
}

/// ISO taban medya biçimi (MP4, MOV, HEIC, 3GP…): 4. bayttan itibaren "ftyp".
fn iso_media(head: &[u8]) -> bool {
    head.len() >= 12 && &head[4..8] == b"ftyp"
}

/// Uzantısı ne olursa olsun reddedilen içerik: çalıştırılabilir dosyalar, betikler ve
/// tarayıcının sayfa olarak yorumlayabileceği HTML/SVG.
pub fn looks_dangerous(head: &[u8]) -> bool {
    const EXECUTABLE: &[&[u8]] = &[
        b"MZ",
        b"\x7fELF",
        b"#!",
        &[0xFE, 0xED, 0xFA, 0xCE],
        &[0xFE, 0xED, 0xFA, 0xCF],
        &[0xCE, 0xFA, 0xED, 0xFE],
        &[0xCF, 0xFA, 0xED, 0xFE],
        &[0xCA, 0xFE, 0xBA, 0xBE],
    ];
    if EXECUTABLE.iter().any(|m| starts(head, m)) {
        return true;
    }
    let text: Vec<u8> = head
        .iter()
        .skip_while(|b| b.is_ascii_whitespace() || **b == 0xEF || **b == 0xBB || **b == 0xBF)
        .take(64)
        .map(u8::to_ascii_lowercase)
        .collect();
    [
        &b"<!doctype html"[..],
        b"<html",
        b"<head",
        b"<body",
        b"<script",
        b"<svg",
        b"<?php",
        b"<?xml-stylesheet",
    ]
    .iter()
    .any(|m| starts(&text, m))
}

/// Uzantının vaat ettiği tür ile dosyanın ilk baytları uyuşmalı.
/// Böylece `.pdf` adıyla yüklenen çalıştırılabilir ya da HTML içerik reddedilir.
/// İmzası bilinmeyen türlerde (şirketin eklediği uzantılar) yalnızca tehlikeli içerik aranır.
pub fn content_matches(extension: &str, head: &[u8]) -> bool {
    if is_blocked(extension) || looks_dangerous(head) {
        return false;
    }
    match extension {
        "pdf" => starts(head, b"%PDF-"),
        "jpg" | "jpeg" => starts(head, &[0xFF, 0xD8, 0xFF]),
        "png" => starts(head, &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]),
        "gif" => starts(head, b"GIF87a") || starts(head, b"GIF89a"),
        "bmp" => starts(head, b"BM"),
        "webp" => riff(head, b"WEBP"),
        "tif" | "tiff" => starts(head, b"II*\0") || starts(head, b"MM\0*"),
        "heic" | "heif" | "avif" | "mp4" | "m4v" | "m4a" | "mov" | "3gp" => iso_media(head),
        "avi" => riff(head, b"AVI "),
        "wav" => riff(head, b"WAVE"),
        "mkv" | "webm" => starts(head, &[0x1A, 0x45, 0xDF, 0xA3]),
        "mp3" => {
            starts(head, b"ID3") || (head.len() >= 2 && head[0] == 0xFF && (head[1] & 0xE0) == 0xE0)
        }
        "dwg" => starts(head, b"AC10") || starts(head, b"AC1."),
        "ifc" => starts(head, b"ISO-10303-21"),
        "rvt" | "doc" | "xls" | "ppt" => starts(head, OLE),
        "skp" => starts(head, &[0xFF, 0xFE, 0xFF]),
        "docx" | "xlsx" | "pptx" | "odt" | "ods" | "odp" | "zip" => starts(head, ZIP),
        "rar" => starts(head, b"Rar!\x1A\x07"),
        "7z" => starts(head, &[0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]),
        "dxf" | "txt" | "csv" => is_text(head),
        _ => true,
    }
}

pub fn logo_mime(head: &[u8]) -> Option<&'static str> {
    if starts(head, &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        Some("image/png")
    } else if starts(head, &[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if head.len() >= 12 && &head[..4] == b"RIFF" && &head[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        None
    }
}

/// Belge tipinin kabul ettiği türlerin okunur listesi: "PDF, DWG, DXF".
fn extension_label(extensions: &[String]) -> String {
    extensions
        .iter()
        .map(|e| e.to_uppercase())
        .collect::<Vec<_>>()
        .join(", ")
}

#[derive(Clone)]
pub struct FileService {
    pub files: Arc<dyn FileRepo>,
    pub store: Arc<dyn FileStore>,
    pub projects: Arc<dyn ProjectRepo>,
    pub doc_types: Arc<dyn DocTypeRepo>,
    pub gate: ChangeGate,
    pub clock: Arc<dyn Clock>,
    pub audit: Auditor,
}

pub struct UploadRequest {
    pub project_id: Id,
    pub doc_type_id: Option<Id>,
    pub file_name: String,
}

impl FileService {
    pub async fn upload(
        &self,
        actor: &Actor,
        request: UploadRequest,
        reader: &mut dyn ChunkReader,
    ) -> AppResult<(StoredFile, Submitted)> {
        let mode = actor.project_mode();
        if !actor.can_files() || !mode.can_write() {
            return Err(AppError::Forbidden);
        }
        let project = self
            .projects
            .get(&request.project_id)
            .await?
            .ok_or(AppError::NotFound)?;
        let doc_type = match &request.doc_type_id {
            Some(id) => Some(self.doc_types.get(id).await?.ok_or(AppError::NotFound)?),
            None => None,
        };
        let name = validate::file_name(&request.file_name)?;
        let extension = validate::file_extension(&name);
        if extension.is_empty() {
            return Err(AppError::validation(
                "Dosyanın bir uzantısı olmalı (ör. .pdf).",
            ));
        }
        if is_blocked(&extension) {
            return Err(AppError::validation(format!(
                ".{extension} dosyaları güvenlik nedeniyle yüklenemez."
            )));
        }
        if let Some(d) = doc_type.as_ref().filter(|d| !d.extensions.is_empty())
            && !d.extensions.contains(&extension)
        {
            return Err(AppError::validation(format!(
                "Bu belge tipi yalnızca şu dosyaları kabul ediyor: {}.",
                extension_label(&d.extensions)
            )));
        }

        let id = new_id();
        let mut sink = self.store.create(&id).await?;
        let mut size: u64 = 0;
        let mut head: Vec<u8> = Vec::new();
        let mut hash = Sha256::new();
        let outcome: AppResult<()> = async {
            while let Some(chunk) = reader.next_chunk().await? {
                size += chunk.len() as u64;
                if size > MAX_FILE_BYTES {
                    return Err(AppError::PayloadTooLarge(
                        "Dosya 512 MB sınırını aşıyor.".into(),
                    ));
                }
                if head.len() < 4096 {
                    let need = 4096 - head.len();
                    head.extend_from_slice(&chunk[..need.min(chunk.len())]);
                }
                hash.update(&chunk);
                sink.write(&chunk).await?;
            }
            if size == 0 {
                return Err(AppError::validation("Dosya boş."));
            }
            if !content_matches(&extension, &head) {
                return Err(AppError::validation("Dosya içeriği uzantısıyla uyuşmuyor."));
            }
            Ok(())
        }
        .await;
        if let Err(error) = outcome {
            sink.abort().await;
            return Err(error);
        }
        sink.finish().await?;

        let file = StoredFile {
            id: id.clone(),
            project_id: project.id.clone(),
            doc_type_id: request.doc_type_id.clone(),
            name: name.clone(),
            size: size as i64,
            mime: "application/octet-stream".into(),
            sha256: hash.finalize().iter().map(|b| format!("{b:02x}")).collect(),
            by: actor.name.clone(),
            by_id: actor.user_id.clone(),
            at: self.clock.now(),
            state: FileState::Pending,
        };
        self.files.insert(&file).await?;

        let replace = doc_type.as_ref().is_some_and(|d| !d.multi);
        let slot = doc_type
            .as_ref()
            .map_or_else(|| "Ek dosya".to_string(), |d| d.name.clone());
        let change = Change {
            kind: PendingKind::Update,
            entity: Entity::Project,
            payload: PendingPayload::FileAdd {
                id: project.id.clone(),
                file_id: id,
                replace,
            },
            title: format!("Belge güncelleme: {slot}"),
            detail: format!("{} · {name} yüklendi", project.name),
            doc_key: request.doc_type_id,
            file_name: Some(format!("{name} yüklendi")),
        };
        let submitted = self.gate.submit(actor, mode, change).await?;
        Ok((file, submitted))
    }

    /// Onaya düşmüş dosyayı yalnızca yükleyen ve doğrudan düzenleyebilenler indirebilir.
    pub async fn open(
        &self,
        actor: &Actor,
        id: &str,
    ) -> AppResult<(StoredFile, Box<dyn FileSource>)> {
        if !actor.project_mode().can_read() {
            return Err(AppError::Forbidden);
        }
        let file = self.files.get(id).await?.ok_or(AppError::NotFound)?;
        if file.state == FileState::Pending
            && file.by_id != actor.user_id
            && !actor.project_mode().is_direct()
        {
            return Err(AppError::NotFound);
        }
        let source = self.store.open(id).await?;
        self.audit.user(actor, "file.download", id, "").await?;
        Ok((file, source))
    }

    pub async fn remove(&self, actor: &Actor, id: &str) -> AppResult<Submitted> {
        let mode = actor.project_mode();
        if !actor.can_files() || !mode.can_write() {
            return Err(AppError::Forbidden);
        }
        let file = self.files.get(id).await?.ok_or(AppError::NotFound)?;
        let project = self
            .projects
            .get(&file.project_id)
            .await?
            .ok_or(AppError::NotFound)?;
        let change = Change {
            kind: PendingKind::Update,
            entity: Entity::Project,
            payload: PendingPayload::FileRemove {
                id: project.id.clone(),
                file_id: id.to_string(),
            },
            title: format!("Belge güncelleme: {}", file.name),
            detail: format!("{} · {} kaldırıldı", project.name, file.name),
            doc_key: file.doc_type_id.clone(),
            file_name: Some(format!("{} kaldırıldı", file.name)),
        };
        self.gate.submit(actor, mode, change).await
    }

    /// Proje fotoğrafı yalnızca doğrudan düzenleme ve dosya yetkisi olanlarca değiştirilir;
    /// onaylı düzenleme kuyruğuna girmez. Yalnızca PNG, JPEG ve WEBP kabul edilir.
    pub async fn save_photo(&self, actor: &Actor, project_id: &str, bytes: &[u8]) -> AppResult<()> {
        if !actor.can_files() || !actor.project_mode().is_direct() {
            return Err(AppError::Forbidden);
        }
        self.projects
            .get(project_id)
            .await?
            .ok_or(AppError::NotFound)?;
        if bytes.len() > MAX_PHOTO_BYTES {
            return Err(AppError::PayloadTooLarge(
                "Fotoğraf en fazla 3 MB olabilir.".into(),
            ));
        }
        let mime = logo_mime(bytes)
            .ok_or_else(|| AppError::validation("Fotoğraf PNG, JPEG veya WEBP olmalı."))?;
        self.store.put_small(&photo_key(project_id), bytes).await?;
        self.projects
            .set_photo(project_id, mime, self.clock.now())
            .await?;
        self.audit
            .user(actor, "project.photo", project_id, "yüklendi")
            .await
    }

    pub async fn remove_photo(&self, actor: &Actor, project_id: &str) -> AppResult<()> {
        if !actor.can_files() || !actor.project_mode().is_direct() {
            return Err(AppError::Forbidden);
        }
        self.projects
            .get(project_id)
            .await?
            .ok_or(AppError::NotFound)?;
        self.projects.set_photo(project_id, "", 0).await?;
        self.store.delete(&photo_key(project_id)).await?;
        self.audit
            .user(actor, "project.photo", project_id, "kaldırıldı")
            .await
    }

    pub async fn photo(&self, actor: &Actor, project_id: &str) -> AppResult<(Vec<u8>, String)> {
        if !actor.project_mode().can_read() {
            return Err(AppError::Forbidden);
        }
        let project = self
            .projects
            .get(project_id)
            .await?
            .ok_or(AppError::NotFound)?;
        if project.photo_mime.is_empty() {
            return Err(AppError::NotFound);
        }
        let bytes = self
            .store
            .get_small(&photo_key(project_id))
            .await?
            .ok_or(AppError::NotFound)?;
        Ok((bytes, project.photo_mime))
    }

    /// Sistem panelinden sunucu dosyası silme.
    pub async fn master_remove(&self, id: &str, meta: &RequestMeta) -> AppResult<()> {
        let file = self.files.get(id).await?.ok_or(AppError::NotFound)?;
        self.files.delete(id).await?;
        self.store.delete(id).await?;
        self.audit.master(meta, "file.delete", &file.id, "").await
    }

    pub async fn master_open(
        &self,
        id: &str,
        meta: &RequestMeta,
    ) -> AppResult<(StoredFile, Box<dyn FileSource>)> {
        let file = self.files.get(id).await?.ok_or(AppError::NotFound)?;
        let source = self.store.open(id).await?;
        self.audit.master(meta, "file.download", id, "").await?;
        Ok((file, source))
    }

    pub async fn all(&self) -> AppResult<Vec<StoredFile>> {
        self.files.list().await
    }

    pub fn now(&self) -> Timestamp {
        self.clock.now()
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn rejects_mismatched_content() {
        assert!(content_matches("pdf", b"%PDF-1.7 ..."));
        assert!(!content_matches("pdf", b"<html><script>alert(1)</script>"));
        assert!(!content_matches("png", b"MZ\x90\x00"));
        assert!(!content_matches("exe", b"MZ\x90\x00"));
        assert!(!content_matches("svg", b"<svg onload=alert(1)>"));
        assert!(!content_matches("txt", b"a\0b"));
    }

    #[test]
    fn dangerous_extensions_are_not_allowed() {
        for ext in ["exe", "js", "html", "svg", "php", "sh", "bat"] {
            assert!(is_blocked(ext), "{ext} engellenmeli");
            assert!(extensions(&[ext.into()]).is_err(), "{ext} eklenmemeli");
            assert!(!content_matches(ext, b"zararsiz"), "{ext} kabul edilmemeli");
        }
    }

    #[test]
    fn custom_extensions_are_normalised() {
        let out = extensions(&[".MP4, mov".into(), "stl".into(), "mp4".into(), "".into()]).unwrap();
        assert_eq!(out, ["mp4", "mov", "stl"]);
        assert!(extensions(&["../x".into()]).is_err());
        assert!(extensions(&["a".repeat(17)]).is_err());
        let many: Vec<String> = (0..=MAX_EXTENSIONS).map(|i| format!("e{i}")).collect();
        assert!(extensions(&many).is_err());
    }

    #[test]
    fn unknown_types_only_reject_dangerous_content() {
        assert!(content_matches("stl", b"solid kup\nfacet normal 0 0 1"));
        assert!(content_matches("stl", &[0u8; 84]));
        assert!(!content_matches("stl", b"MZ\x90\x00"));
        assert!(!content_matches("stl", b"\x7fELF\x02"));
        assert!(!content_matches(
            "md",
            b"  <!DOCTYPE html><script>1</script>"
        ));
        assert!(!content_matches("xyz", b"<svg onload=alert(1)>"));
        assert!(content_matches("mp4", b"\0\0\0\x18ftypmp42\0\0\0\0"));
        assert!(!content_matches("mp4", b"%PDF-1.7"));
    }

    #[test]
    fn logo_rejects_svg() {
        assert!(logo_mime(b"<svg xmlns='x'>").is_none());
        assert_eq!(logo_mime(&[0xFF, 0xD8, 0xFF, 0xE0]), Some("image/jpeg"));
    }
}
