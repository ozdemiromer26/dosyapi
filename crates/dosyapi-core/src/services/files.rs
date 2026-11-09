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

const PDF: &[&str] = &["pdf"];
const IMAGE: &[&str] = &["jpg", "jpeg", "png", "webp", "tif", "tiff", "heic"];
const CAD: &[&str] = &["dwg", "dxf", "ifc", "rvt", "skp"];
const OFFICE: &[&str] = &["doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods"];
const OTHER: &[&str] = &["zip", "rar", "7z", "txt", "csv"];

fn allowed_extensions(accept: DocAccept) -> Vec<&'static str> {
    let groups: &[&[&str]] = match accept {
        DocAccept::Pdf => &[PDF],
        DocAccept::Pdfimg => &[PDF, IMAGE],
        DocAccept::Image => &[IMAGE],
        DocAccept::Cad => &[CAD],
        DocAccept::Office => &[OFFICE],
        DocAccept::All => &[PDF, IMAGE, CAD, OFFICE, OTHER],
    };
    groups.iter().flat_map(|g| g.iter().copied()).collect()
}

fn starts(head: &[u8], magic: &[u8]) -> bool {
    head.len() >= magic.len() && &head[..magic.len()] == magic
}

const ZIP: &[u8] = b"PK\x03\x04";
const OLE: &[u8] = &[0xD0, 0xCF, 0x11, 0xE0];

fn is_text(head: &[u8]) -> bool {
    !head.contains(&0)
}

/// Uzantının vaat ettiği tür ile dosyanın ilk baytları uyuşmalı.
/// Böylece `.pdf` adıyla yüklenen çalıştırılabilir ya da HTML içerik reddedilir.
pub fn content_matches(extension: &str, head: &[u8]) -> bool {
    match extension {
        "pdf" => starts(head, b"%PDF-"),
        "jpg" | "jpeg" => starts(head, &[0xFF, 0xD8, 0xFF]),
        "png" => starts(head, &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]),
        "webp" => head.len() >= 12 && &head[..4] == b"RIFF" && &head[8..12] == b"WEBP",
        "tif" | "tiff" => starts(head, b"II*\0") || starts(head, b"MM\0*"),
        "heic" => head.len() >= 12 && &head[4..8] == b"ftyp",
        "dwg" => starts(head, b"AC10") || starts(head, b"AC1."),
        "ifc" => starts(head, b"ISO-10303-21"),
        "rvt" | "doc" | "xls" | "ppt" => starts(head, OLE),
        "skp" => starts(head, &[0xFF, 0xFE, 0xFF]),
        "docx" | "xlsx" | "pptx" | "odt" | "ods" | "zip" => starts(head, ZIP),
        "rar" => starts(head, b"Rar!\x1A\x07"),
        "7z" => starts(head, &[0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]),
        "dxf" | "txt" | "csv" => is_text(head),
        _ => false,
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

fn accept_label(accept: DocAccept) -> &'static str {
    match accept {
        DocAccept::All => "izin verilen dosya tipleri",
        DocAccept::Pdf => "PDF",
        DocAccept::Pdfimg => "PDF veya görsel",
        DocAccept::Image => "görsel",
        DocAccept::Cad => "çizim (DWG/DXF)",
        DocAccept::Office => "ofis belgesi",
    }
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
        let accept = doc_type.as_ref().map_or(DocAccept::All, |d| d.accept);
        let name = validate::file_name(&request.file_name)?;
        let extension = validate::file_extension(&name);
        if !allowed_extensions(accept).contains(&extension.as_str()) {
            return Err(AppError::validation(format!(
                "Bu dosya tipi kabul edilmiyor: yalnızca {}.",
                accept_label(accept)
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
        let all = allowed_extensions(DocAccept::All);
        for ext in ["exe", "js", "html", "svg", "php", "sh", "bat"] {
            assert!(!all.contains(&ext), "{ext} kabul edilmemeli");
        }
    }

    #[test]
    fn logo_rejects_svg() {
        assert!(logo_mime(b"<svg xmlns='x'>").is_none());
        assert_eq!(logo_mime(&[0xFF, 0xD8, 0xFF, 0xE0]), Some("image/jpeg"));
    }
}
