//! Tam yedek: veritabanı ve tüm dosyalar tek dosyada, şifreli ve doğrulanabilir.
//!
//! Biçim (DSYB, sürüm 1):
//! - Başlık (60 bayt): `DSYB` | sürüm (1) | anahtar kimliği (8) | oluşturma zamanı (i64) |
//!   tuz (32) | nonce öneki (7).
//! - Gövde: parçalar. Her parça `u32` (en üst bit: son parça; kalanı düz metin uzunluğu) ve
//!   AES-256-GCM şifreli metinden oluşur. Nonce = önek | sıra (u32) | son-parça bayrağı.
//!   Başlığın tamamı her parçada ek veri (AAD) olarak doğrulanır.
//! - Anahtar: `secret.key`'den türetilen yedek anahtarı + yedeğe özgü tuz (HKDF). Anahtar
//!   kimliği, yedeğin hangi `secret.key` ile alındığını anahtarı açığa vurmadan gösterir.
//! - Düz metin: kayıtlar. Kayıt = tür (1: dosya, 0: son) | ad uzunluğu (u16) | ad |
//!   boyut (u64) | veri. Son kaydın verisi JSON bildirimdir (sürüm, sayılar, veritabanı özeti).
//!
//! Tek bir baytın değişmesi, parçaların yer değiştirmesi, dosyanın kesilmesi, sona veri
//! eklenmesi ya da başka bir anahtarla üretilmiş yedek, çözme sırasında yakalanır. Yani
//! `secret.key` olmadan geçerli bir yedek üretilemez ve mevcut bir yedek fark edilmeden
//! değiştirilemez. Eski yedekler, oturum ve güncelleme dosyaları yedeğe girmez.

use crate::crypto::{KEY_LEN, Keyring, random_bytes};
use crate::db::{db_err, restrict_file};
use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use async_trait::async_trait;
use dosyapi_core::error::{AppError, AppResult};
use dosyapi_core::ports::{BackupInfo, BackupReport, BackupService, DataEraser, FileSource};
use hkdf::Hkdf;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::sqlite::{SqliteConnectOptions, SqliteConnection};
use sqlx::{Connection, SqlitePool};
use std::collections::HashSet;
use std::io::{self, BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::SystemTime;
use tokio::fs;
use tokio::io::AsyncReadExt;
use tokio::sync::{Mutex, RwLock};
use zeroize::Zeroizing;

const MAGIC: &[u8; 4] = b"DSYB";
const FORMAT: u8 = 1;
const ID_LEN: usize = 8;
const SALT_LEN: usize = 32;
const PREFIX_LEN: usize = 7;
const HEADER_LEN: usize = 4 + 1 + ID_LEN + 8 + SALT_LEN + PREFIX_LEN;
const CHUNK: usize = 1 << 20;
const LAST: u32 = 1 << 31;
const TAG_LEN: usize = 16;
const MANIFEST_MAX: usize = 1 << 20;
const DB_ENTRY: &str = "dosyapi.sqlite";
const OBJECTS: &str = "files/objects/";
pub const EXTENSION: &str = ".dsyb";
/// Yedeği kimin aldığı: zamanlanmış görev, Sistem Paneli, sunucu konsolu ya da bir işlem öncesi.
pub const LABELS: [&str; 5] = [
    "otomatik",
    "elle",
    "konsol",
    "guncelleme-oncesi",
    "sifirlama-oncesi",
];

fn broken(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message.to_string())
}

/// Okuma/yazma hatasını kullanıcıya anlatılabilir hataya çevirir.
fn io_app(error: io::Error) -> AppError {
    match error.kind() {
        io::ErrorKind::InvalidData => AppError::validation(error.to_string()),
        io::ErrorKind::UnexpectedEof => AppError::validation("Yedek eksik: dosya kesilmiş."),
        _ => AppError::internal(error),
    }
}

/// `secret.key`'den türetilen yedek anahtarı ve onun açık kimliği.
#[derive(Clone)]
pub struct BackupKeys {
    root: Arc<Zeroizing<[u8; KEY_LEN]>>,
    id: [u8; ID_LEN],
}

impl BackupKeys {
    #[allow(clippy::expect_used)]
    pub fn new(keyring: &Keyring) -> Self {
        let id_key = keyring.derive("backup-id");
        let mut mac = <Hmac<Sha256> as hmac::KeyInit>::new_from_slice(id_key.as_slice())
            .expect("HMAC her anahtar uzunluğunu kabul eder");
        mac.update(b"dosyapi-backup");
        let digest = mac.finalize().into_bytes();
        let mut id = [0u8; ID_LEN];
        id.copy_from_slice(&digest[..ID_LEN]);
        Self {
            root: Arc::new(keyring.derive("backup")),
            id,
        }
    }

    fn cipher(&self, salt: &[u8]) -> AppResult<Aes256Gcm> {
        let hk = Hkdf::<Sha256>::new(Some(salt), self.root.as_slice());
        let mut key = Zeroizing::new([0u8; KEY_LEN]);
        hk.expand(b"dosyapi backup v1", key.as_mut_slice())
            .map_err(|_| AppError::internal("yedek anahtarı türetilemedi"))?;
        Aes256Gcm::new_from_slice(key.as_slice()).map_err(AppError::internal)
    }
}

#[derive(Clone, Copy)]
struct Header([u8; HEADER_LEN]);

impl Header {
    fn new(keys: &BackupKeys, created_at: i64) -> Self {
        let mut bytes = [0u8; HEADER_LEN];
        bytes[..4].copy_from_slice(MAGIC);
        bytes[4] = FORMAT;
        bytes[5..13].copy_from_slice(&keys.id);
        bytes[13..21].copy_from_slice(&created_at.to_be_bytes());
        bytes[21..53].copy_from_slice(&random_bytes::<SALT_LEN>());
        bytes[53..].copy_from_slice(&random_bytes::<PREFIX_LEN>());
        Self(bytes)
    }

    /// Başlığı okur ve bu anahtarla açılabilir olduğunu denetler.
    fn parse(bytes: [u8; HEADER_LEN], keys: &BackupKeys) -> AppResult<Self> {
        let header = Self(bytes);
        if &bytes[..4] != MAGIC {
            return Err(AppError::validation("Bu dosya bir dosyapı yedeği değil."));
        }
        if bytes[4] != FORMAT {
            return Err(AppError::validation(
                "Yedek biçimi bu sürümle açılamıyor; daha yeni bir dosyapı sürümü gerekiyor.",
            ));
        }
        if !header.same_key(keys) {
            return Err(AppError::validation(
                "Bu yedek başka bir anahtarla alınmış; yedeği alan sunucunun secret.key dosyası gerekli.",
            ));
        }
        Ok(header)
    }

    fn same_key(&self, keys: &BackupKeys) -> bool {
        self.0[5..13] == keys.id
    }

    fn created_at(&self) -> i64 {
        let mut raw = [0u8; 8];
        raw.copy_from_slice(&self.0[13..21]);
        i64::from_be_bytes(raw)
    }

    fn salt(&self) -> &[u8] {
        &self.0[21..53]
    }

    fn prefix(&self) -> [u8; PREFIX_LEN] {
        let mut prefix = [0u8; PREFIX_LEN];
        prefix.copy_from_slice(&self.0[53..]);
        prefix
    }
}

fn chunk_nonce(prefix: &[u8; PREFIX_LEN], counter: u32, last: bool) -> [u8; 12] {
    let mut nonce = [0u8; 12];
    nonce[..PREFIX_LEN].copy_from_slice(prefix);
    nonce[PREFIX_LEN..11].copy_from_slice(&counter.to_be_bytes());
    nonce[11] = u8::from(last);
    nonce
}

/// Düz metni parçalara bölüp şifreleyerek yazar.
struct EncWriter<W: Write> {
    inner: W,
    cipher: Aes256Gcm,
    header: Header,
    counter: u32,
    buffer: Vec<u8>,
}

impl<W: Write> EncWriter<W> {
    fn new(mut inner: W, keys: &BackupKeys, header: Header) -> AppResult<Self> {
        inner.write_all(&header.0).map_err(io_app)?;
        Ok(Self {
            inner,
            cipher: keys.cipher(header.salt())?,
            header,
            counter: 0,
            buffer: Vec::with_capacity(CHUNK * 2),
        })
    }

    fn emit(&mut self, last: bool) -> io::Result<()> {
        let take = self.buffer.len().min(CHUNK);
        let nonce_bytes = chunk_nonce(&self.header.prefix(), self.counter, last);
        let nonce = Nonce::try_from(&nonce_bytes[..]).map_err(io::Error::other)?;
        let ciphertext = self
            .cipher
            .encrypt(
                &nonce,
                Payload {
                    msg: &self.buffer[..take],
                    aad: &self.header.0,
                },
            )
            .map_err(|_| io::Error::other("yedek şifrelenemedi"))?;
        let frame = take as u32 | if last { LAST } else { 0 };
        self.inner.write_all(&frame.to_be_bytes())?;
        self.inner.write_all(&ciphertext)?;
        self.buffer.drain(..take);
        self.counter = self
            .counter
            .checked_add(1)
            .ok_or_else(|| io::Error::other("parça sayacı taştı"))?;
        Ok(())
    }

    fn finish(mut self) -> io::Result<W> {
        self.emit(true)?;
        self.inner.flush()?;
        Ok(self.inner)
    }
}

impl<W: Write> Write for EncWriter<W> {
    fn write(&mut self, data: &[u8]) -> io::Result<usize> {
        self.buffer.extend_from_slice(data);
        // Son parçayı ayırt edebilmek için en az bir parça bellekte bekletilir.
        while self.buffer.len() > CHUNK {
            self.emit(false)?;
        }
        Ok(data.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

/// Parçaları çözerek okur; doğrulanmamış tek bayt bile dışarı verilmez.
struct DecReader<R: Read> {
    inner: R,
    cipher: Aes256Gcm,
    header: Header,
    counter: u32,
    buffer: Vec<u8>,
    pos: usize,
    done: bool,
}

impl<R: Read> DecReader<R> {
    fn new(inner: R, keys: &BackupKeys, header: Header) -> AppResult<Self> {
        Ok(Self {
            inner,
            cipher: keys.cipher(header.salt())?,
            header,
            counter: 0,
            buffer: Vec::new(),
            pos: 0,
            done: false,
        })
    }

    fn next_chunk(&mut self) -> io::Result<()> {
        let mut frame = [0u8; 4];
        self.inner.read_exact(&mut frame)?;
        let frame = u32::from_be_bytes(frame);
        let last = frame & LAST != 0;
        let len = (frame & !LAST) as usize;
        if len > CHUNK {
            return Err(broken("Yedek bozuk: parça boyutu geçersiz."));
        }
        let mut ciphertext = vec![0u8; len + TAG_LEN];
        self.inner.read_exact(&mut ciphertext)?;
        let nonce_bytes = chunk_nonce(&self.header.prefix(), self.counter, last);
        let nonce = Nonce::try_from(&nonce_bytes[..]).map_err(io::Error::other)?;
        self.buffer = self
            .cipher
            .decrypt(
                &nonce,
                Payload {
                    msg: &ciphertext,
                    aad: &self.header.0,
                },
            )
            .map_err(|_| {
                broken("Yedek bozuk ya da değiştirilmiş: bütünlük doğrulaması başarısız.")
            })?;
        self.pos = 0;
        self.counter = self
            .counter
            .checked_add(1)
            .ok_or_else(|| broken("Yedek bozuk: parça sayısı geçersiz."))?;
        if last {
            self.done = true;
            let mut extra = [0u8; 1];
            if self.inner.read(&mut extra)? != 0 {
                return Err(broken("Yedeğin sonuna fazladan veri eklenmiş."));
            }
        }
        Ok(())
    }
}

impl<R: Read> Read for DecReader<R> {
    fn read(&mut self, out: &mut [u8]) -> io::Result<usize> {
        while self.pos >= self.buffer.len() {
            if self.done {
                return Ok(0);
            }
            self.next_chunk()?;
        }
        let n = out.len().min(self.buffer.len() - self.pos);
        out[..n].copy_from_slice(&self.buffer[self.pos..self.pos + n]);
        self.pos += n;
        Ok(n)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Manifest {
    format: u8,
    version: String,
    created_at: i64,
    label: String,
    db_bytes: u64,
    db_sha256: String,
    files: u64,
    files_bytes: u64,
}

/// Yazılanı aynı anda özetler.
struct Tee<'a, W: Write> {
    inner: &'a mut W,
    hash: &'a mut Sha256,
}

impl<W: Write> Write for Tee<'_, W> {
    fn write(&mut self, data: &[u8]) -> io::Result<usize> {
        let n = self.inner.write(data)?;
        self.hash.update(&data[..n]);
        Ok(n)
    }
    fn flush(&mut self) -> io::Result<()> {
        self.inner.flush()
    }
}

fn put_head<W: Write>(out: &mut W, name: &str, size: u64) -> io::Result<()> {
    out.write_all(&[1])?;
    out.write_all(&(name.len() as u16).to_be_bytes())?;
    out.write_all(name.as_bytes())?;
    out.write_all(&size.to_be_bytes())
}

fn put_body<W: Write, R: Read>(out: &mut W, size: u64, source: R) -> io::Result<()> {
    let copied = io::copy(&mut source.take(size), out)?;
    if copied != size {
        return Err(io::Error::other("dosya yedeklenirken değişti"));
    }
    Ok(())
}

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
}

/// Yedekteki bir kaydın türü. Yalnızca bu iki biçimdeki adlar kabul edilir; yol geçişi olmaz.
enum Kind {
    Db,
    Object { dir: String, id: String },
}

fn classify(name: &str) -> Option<Kind> {
    if name == DB_ENTRY {
        return Some(Kind::Db);
    }
    let rest = name.strip_prefix(OBJECTS)?;
    let (dir, id) = rest.split_once('/')?;
    (valid_id(id) && dir.len() == 2.min(id.len()) && id.starts_with(dir)).then(|| Kind::Object {
        dir: dir.to_string(),
        id: id.to_string(),
    })
}

struct ObjectFile {
    name: String,
    path: PathBuf,
    size: u64,
}

/// Depodaki şifreli dosyalar. Yedek başladıktan sonra eklenenler (anlık görüntüde kaydı
/// olmayanlar) alınmaz.
fn list_objects(objects: &Path, cutoff: SystemTime) -> io::Result<Vec<ObjectFile>> {
    let mut out = Vec::new();
    let Ok(dirs) = std::fs::read_dir(objects) else {
        return Ok(out);
    };
    for dir in dirs {
        let dir = dir?;
        if !dir.file_type()?.is_dir() {
            continue;
        }
        let dir_name = dir.file_name().to_string_lossy().to_string();
        for file in std::fs::read_dir(dir.path())? {
            let file = file?;
            let id = file.file_name().to_string_lossy().to_string();
            let meta = file.metadata()?;
            let name = format!("{OBJECTS}{dir_name}/{id}");
            if !meta.is_file() || classify(&name).is_none() {
                continue;
            }
            if meta.modified().is_ok_and(|m| m > cutoff) {
                continue;
            }
            out.push(ObjectFile {
                name,
                path: file.path(),
                size: meta.len(),
            });
        }
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

#[cfg(unix)]
fn create_private(path: &Path) -> io::Result<std::fs::File> {
    use std::os::unix::fs::OpenOptionsExt;
    std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)
}

#[cfg(not(unix))]
fn create_private(path: &Path) -> io::Result<std::fs::File> {
    std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
}

#[cfg(unix)]
fn restrict_dir(path: &Path) -> AppResult<()> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700))
        .map_err(AppError::internal)
}

#[cfg(not(unix))]
fn restrict_dir(_path: &Path) -> AppResult<()> {
    Ok(())
}

struct WriteJob {
    keys: BackupKeys,
    snapshot: PathBuf,
    objects: PathBuf,
    out: PathBuf,
    created_at: i64,
    cutoff: SystemTime,
    label: String,
}

fn write_archive(job: &WriteJob) -> AppResult<()> {
    let file = create_private(&job.out).map_err(AppError::internal)?;
    let header = Header::new(&job.keys, job.created_at);
    let mut enc = EncWriter::new(BufWriter::new(file), &job.keys, header)?;

    let db_bytes = std::fs::metadata(&job.snapshot)
        .map_err(AppError::internal)?
        .len();
    let mut hash = Sha256::new();
    {
        let source = std::fs::File::open(&job.snapshot).map_err(AppError::internal)?;
        put_head(&mut enc, DB_ENTRY, db_bytes).map_err(io_app)?;
        let mut tee = Tee {
            inner: &mut enc,
            hash: &mut hash,
        };
        put_body(&mut tee, db_bytes, BufReader::new(source)).map_err(io_app)?;
    }

    let (mut files, mut files_bytes) = (0u64, 0u64);
    for object in list_objects(&job.objects, job.cutoff).map_err(AppError::internal)? {
        // Silinmiş olabilir; anlık görüntüde kaydı varsa doğrulama eksik olarak bildirir.
        let Ok(source) = std::fs::File::open(&object.path) else {
            continue;
        };
        put_head(&mut enc, &object.name, object.size).map_err(io_app)?;
        put_body(&mut enc, object.size, BufReader::new(source)).map_err(io_app)?;
        files += 1;
        files_bytes += object.size;
    }

    let manifest = Manifest {
        format: FORMAT,
        version: env!("CARGO_PKG_VERSION").into(),
        created_at: job.created_at,
        label: job.label.clone(),
        db_bytes,
        db_sha256: hex::encode(hash.finalize()),
        files,
        files_bytes,
    };
    let body = serde_json::to_vec(&manifest).map_err(AppError::internal)?;
    enc.write_all(&[0]).map_err(io_app)?;
    enc.write_all(&(body.len() as u32).to_be_bytes())
        .map_err(io_app)?;
    enc.write_all(&body).map_err(io_app)?;
    let writer = enc.finish().map_err(io_app)?;
    let file = writer
        .into_inner()
        .map_err(|e| AppError::internal(e.into_error()))?;
    file.sync_all().map_err(AppError::internal)
}

/// Okumanın sonucu: bildirim ve yedekte bulunan dosya kimlikleri.
struct Scan {
    manifest: Manifest,
    ids: HashSet<String>,
}

fn read_header(path: &Path, keys: &BackupKeys) -> AppResult<(Header, std::fs::File)> {
    let mut file = std::fs::File::open(path).map_err(|_| AppError::NotFound)?;
    let mut bytes = [0u8; HEADER_LEN];
    file.read_exact(&mut bytes)
        .map_err(|_| AppError::validation("Bu dosya bir dosyapı yedeği değil."))?;
    Ok((Header::parse(bytes, keys)?, file))
}

/// Yedeğin tamamını çözer ve doğrular. Veritabanı `db_out`'a yazılır; `objects_out`
/// verilirse dosyalar da oraya çıkarılır (geri yükleme), verilmezse yalnızca doğrulanır.
fn read_archive(
    path: &Path,
    keys: &BackupKeys,
    db_out: &Path,
    objects_out: Option<&Path>,
) -> AppResult<Scan> {
    let (header, file) = read_header(path, keys)?;
    let mut reader = DecReader::new(BufReader::new(file), keys, header)?;
    let mut ids = HashSet::new();
    let (mut files, mut files_bytes) = (0u64, 0u64);
    let mut db: Option<(u64, String)> = None;
    loop {
        let mut kind = [0u8; 1];
        reader.read_exact(&mut kind).map_err(io_app)?;
        match kind[0] {
            1 => {}
            0 => break,
            _ => return Err(AppError::validation("Yedek bozuk: kayıt türü geçersiz.")),
        }
        let mut len = [0u8; 2];
        reader.read_exact(&mut len).map_err(io_app)?;
        let len = u16::from_be_bytes(len) as usize;
        if len == 0 || len > 200 {
            return Err(AppError::validation("Yedek bozuk: kayıt adı geçersiz."));
        }
        let mut name = vec![0u8; len];
        reader.read_exact(&mut name).map_err(io_app)?;
        let name = String::from_utf8(name)
            .map_err(|_| AppError::validation("Yedek bozuk: kayıt adı geçersiz."))?;
        let mut size = [0u8; 8];
        reader.read_exact(&mut size).map_err(io_app)?;
        let size = u64::from_be_bytes(size);
        let mut body = (&mut reader).take(size);
        match classify(&name) {
            Some(Kind::Db) => {
                if db.is_some() {
                    return Err(AppError::validation("Yedek bozuk: veritabanı iki kez var."));
                }
                let out = create_private(db_out).map_err(AppError::internal)?;
                let mut out = BufWriter::new(out);
                let mut hash = Sha256::new();
                let mut tee = Tee {
                    inner: &mut out,
                    hash: &mut hash,
                };
                io::copy(&mut body, &mut tee).map_err(io_app)?;
                out.flush().map_err(AppError::internal)?;
                db = Some((size - body.limit(), hex::encode(hash.finalize())));
            }
            Some(Kind::Object { dir, id }) => {
                if !ids.insert(id.clone()) {
                    return Err(AppError::validation("Yedek bozuk: aynı dosya iki kez var."));
                }
                match objects_out {
                    Some(root) => {
                        let folder = root.join(&dir);
                        std::fs::create_dir_all(&folder).map_err(AppError::internal)?;
                        let mut out = BufWriter::new(
                            create_private(&folder.join(&id)).map_err(AppError::internal)?,
                        );
                        io::copy(&mut body, &mut out).map_err(io_app)?;
                        out.flush().map_err(AppError::internal)?;
                    }
                    None => {
                        io::copy(&mut body, &mut io::sink()).map_err(io_app)?;
                    }
                }
                files += 1;
                files_bytes += size;
            }
            None => return Err(AppError::validation("Yedek bozuk: tanınmayan kayıt adı.")),
        }
        if body.limit() != 0 {
            return Err(AppError::validation("Yedek eksik: dosya kesilmiş."));
        }
    }
    let mut len = [0u8; 4];
    reader.read_exact(&mut len).map_err(io_app)?;
    let len = u32::from_be_bytes(len) as usize;
    if len > MANIFEST_MAX {
        return Err(AppError::validation("Yedek bozuk: bildirim çok büyük."));
    }
    let mut body = vec![0u8; len];
    reader.read_exact(&mut body).map_err(io_app)?;
    let mut rest = [0u8; 1];
    if reader.read(&mut rest).map_err(io_app)? != 0 {
        return Err(AppError::validation(
            "Yedek bozuk: bildirimden sonra veri var.",
        ));
    }
    let manifest: Manifest = serde_json::from_slice(&body)
        .map_err(|_| AppError::validation("Yedek bozuk: bildirim okunamadı."))?;
    let Some((db_bytes, db_sha)) = db else {
        return Err(AppError::validation("Yedekte veritabanı yok."));
    };
    if manifest.created_at != header.created_at()
        || manifest.db_bytes != db_bytes
        || manifest.db_sha256 != db_sha
        || manifest.files != files
        || manifest.files_bytes != files_bytes
    {
        return Err(AppError::validation(
            "Yedek bozuk: bildirim içerikle uyuşmuyor.",
        ));
    }
    Ok(Scan { manifest, ids })
}

/// Çıkarılan veritabanının sağlamlığı ve kayıtlı her dosyanın yedekte olup olmadığı.
async fn check_db(db: &Path, ids: &HashSet<String>) -> AppResult<(bool, u64)> {
    let options = SqliteConnectOptions::new().filename(db).read_only(true);
    let mut conn = SqliteConnection::connect_with(&options)
        .await
        .map_err(|_| AppError::validation("Yedekteki veritabanı açılamadı."))?;
    let integrity: String = sqlx::query_scalar("PRAGMA integrity_check")
        .fetch_one(&mut conn)
        .await
        .map_err(|_| AppError::validation("Yedekteki veritabanı okunamadı."))?;
    let rows: Vec<String> = sqlx::query_scalar("SELECT id FROM files")
        .fetch_all(&mut conn)
        .await
        .map_err(|_| AppError::validation("Yedekteki veritabanı bu sürümle uyumlu değil."))?;
    let _ = conn.close().await;
    let missing = rows.iter().filter(|id| !ids.contains(*id)).count() as u64;
    Ok((integrity == "ok", missing))
}

fn report_from(scan: &Scan, integrity: bool, missing: u64) -> BackupReport {
    let message = if !integrity {
        "Yedekteki veritabanı bütünlük denetiminden geçmedi.".to_string()
    } else if missing > 0 {
        format!("Yedekte {missing} dosya eksik.")
    } else {
        "Yedek sağlam: her bayt doğrulandı.".to_string()
    };
    BackupReport {
        ok: integrity && missing == 0,
        message,
        created_at: scan.manifest.created_at,
        version: scan.manifest.version.clone(),
        db_bytes: scan.manifest.db_bytes,
        files: scan.manifest.files,
        files_bytes: scan.manifest.files_bytes,
        missing,
    }
}

fn failed(message: String) -> BackupReport {
    BackupReport {
        ok: false,
        message,
        created_at: 0,
        version: String::new(),
        db_bytes: 0,
        files: 0,
        files_bytes: 0,
        missing: 0,
    }
}

/// Bir yedek dosyasını uçtan uca doğrular. İçerik sorunları rapor olarak döner;
/// yalnızca beklenmeyen sistem hataları `Err` olur.
pub async fn verify_file(
    path: &Path,
    keys: &BackupKeys,
    scratch: &Path,
) -> AppResult<BackupReport> {
    fs::create_dir_all(scratch)
        .await
        .map_err(AppError::internal)?;
    let db = scratch.join(format!(
        ".dogrulama-{}.sqlite",
        hex::encode(random_bytes::<6>())
    ));
    let (source, target, keys2) = (path.to_path_buf(), db.clone(), keys.clone());
    let scanned = tokio::task::spawn_blocking(move || read_archive(&source, &keys2, &target, None))
        .await
        .map_err(AppError::internal)?;
    let result = match scanned {
        Ok(scan) => match check_db(&db, &scan.ids).await {
            Ok((integrity, missing)) => Ok(report_from(&scan, integrity, missing)),
            Err(AppError::Validation(message)) => Ok(failed(message)),
            Err(error) => Err(error),
        },
        Err(AppError::Validation(message)) => Ok(failed(message)),
        Err(error) => Err(error),
    };
    let _ = fs::remove_file(&db).await;
    result
}

/// Geri yüklemenin sonucu: önceki verinin kenara alındığı klasör.
pub struct Restored {
    pub previous: PathBuf,
    pub report: BackupReport,
}

/// Yedeği doğrular, geçici klasöre çıkarır ve ancak her şey sağlamsa mevcut veriyle
/// yer değiştirir. Mevcut veri silinmez, `onceki-<zaman>` klasörüne taşınır.
/// Sunucu durdurulmuşken çalıştırılmalıdır.
pub async fn restore_file(
    path: &Path,
    keys: &BackupKeys,
    database: &Path,
    files_root: &Path,
) -> AppResult<Restored> {
    let data_dir = database
        .parent()
        .ok_or_else(|| AppError::internal("veri klasörü bulunamadı"))?
        .to_path_buf();
    let stamp = stamp(time::OffsetDateTime::now_utc());
    let staging = data_dir.join(format!("geri-yukleme-{stamp}"));
    fs::create_dir_all(staging.join("files").join("objects"))
        .await
        .map_err(AppError::internal)?;
    restrict_dir(&staging)?;
    let staged_db = staging.join(DB_ENTRY);
    let staged_files = staging.join("files");

    let outcome = async {
        let (source, db, objects, keys2) = (
            path.to_path_buf(),
            staged_db.clone(),
            staged_files.join("objects"),
            keys.clone(),
        );
        let scan =
            tokio::task::spawn_blocking(move || read_archive(&source, &keys2, &db, Some(&objects)))
                .await
                .map_err(AppError::internal)??;
        let (integrity, missing) = check_db(&staged_db, &scan.ids).await?;
        let report = report_from(&scan, integrity, missing);
        if !report.ok {
            return Err(AppError::validation(report.message));
        }
        Ok(report)
    }
    .await;
    let report = match outcome {
        Ok(report) => report,
        Err(error) => {
            let _ = fs::remove_dir_all(&staging).await;
            return Err(error);
        }
    };

    let previous = data_dir.join(format!("onceki-{stamp}"));
    fs::create_dir_all(&previous)
        .await
        .map_err(AppError::internal)?;
    restrict_dir(&previous)?;
    for suffix in ["", "-wal", "-shm"] {
        let current = PathBuf::from(format!("{}{suffix}", database.display()));
        if fs::metadata(&current).await.is_ok() {
            let name = current
                .file_name()
                .ok_or_else(|| AppError::internal("veritabanı adı okunamadı"))?;
            fs::rename(&current, previous.join(name))
                .await
                .map_err(AppError::internal)?;
        }
    }
    if fs::metadata(files_root).await.is_ok() {
        fs::rename(files_root, previous.join("files"))
            .await
            .map_err(AppError::internal)?;
    }
    fs::rename(&staged_db, database)
        .await
        .map_err(AppError::internal)?;
    fs::rename(&staged_files, files_root)
        .await
        .map_err(AppError::internal)?;
    let _ = fs::remove_dir_all(&staging).await;
    restrict_file(database)?;
    Ok(Restored { previous, report })
}

fn stamp(at: time::OffsetDateTime) -> String {
    format!(
        "{:04}{:02}{:02}-{:02}{:02}{:02}",
        at.year(),
        at.month() as u8,
        at.day(),
        at.hour(),
        at.minute(),
        at.second()
    )
}

/// Yedek klasöründeki dosya adı: `dosyapi-YYYYAAGG-SSDDSS-<etiket>-<rastgele>.dsyb`.
pub fn valid_name(name: &str) -> bool {
    name.len() <= 96
        && name.starts_with("dosyapi-")
        && name.ends_with(EXTENSION)
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'.')
        && !name.contains("..")
}

fn label_of(name: &str) -> String {
    let core = name
        .strip_prefix("dosyapi-")
        .and_then(|n| n.strip_suffix(EXTENSION))
        .unwrap_or_default();
    // 15 karakter zaman damgası + '-' ... '-' + 6 karakter rastgele ek.
    if core.len() > 23 {
        core[16..core.len() - 7].to_string()
    } else {
        String::new()
    }
}

/// Sıradan bir dosyayı parça parça okur (yedek indirme).
struct PlainSource {
    file: fs::File,
}

#[async_trait]
impl FileSource for PlainSource {
    async fn next_chunk(&mut self) -> AppResult<Option<Vec<u8>>> {
        let mut buffer = vec![0u8; 256 * 1024];
        let n = self
            .file
            .read(&mut buffer)
            .await
            .map_err(AppError::internal)?;
        if n == 0 {
            return Ok(None);
        }
        buffer.truncate(n);
        Ok(Some(buffer))
    }
}

pub struct FullBackups {
    pool: SqlitePool,
    dir: PathBuf,
    files_root: PathBuf,
    secret_key: PathBuf,
    keys: BackupKeys,
    /// Dosya silmeleri yedek sürerken bekler; anlık görüntü ile dosyalar tutarlı kalır.
    gate: Arc<RwLock<()>>,
    busy: Mutex<()>,
}

impl FullBackups {
    pub fn new(
        pool: SqlitePool,
        dir: PathBuf,
        files_root: PathBuf,
        secret_key: PathBuf,
        keys: BackupKeys,
        gate: Arc<RwLock<()>>,
    ) -> Self {
        Self {
            pool,
            dir,
            files_root,
            secret_key,
            keys,
            gate,
            busy: Mutex::new(()),
        }
    }

    fn path_of(&self, name: &str) -> AppResult<PathBuf> {
        if !valid_name(name) {
            return Err(AppError::NotFound);
        }
        Ok(self.dir.join(name))
    }

    async fn info(&self, name: String, path: &Path) -> AppResult<BackupInfo> {
        let meta = fs::metadata(path).await.map_err(|_| AppError::NotFound)?;
        let (keys, owned) = (self.keys.clone(), path.to_path_buf());
        let header = tokio::task::spawn_blocking(move || read_header(&owned, &keys))
            .await
            .map_err(AppError::internal)?;
        let mtime = meta
            .modified()
            .ok()
            .and_then(|m| m.duration_since(std::time::UNIX_EPOCH).ok())
            .map_or(0, |d| d.as_secs() as i64);
        let (at, foreign) = match header {
            Ok((header, _)) => (header.created_at(), false),
            Err(_) => (mtime, true),
        };
        Ok(BackupInfo {
            label: label_of(&name),
            name,
            size: meta.len(),
            at,
            foreign,
        })
    }
}

#[async_trait]
impl BackupService for FullBackups {
    async fn create(&self, label: &str) -> AppResult<BackupInfo> {
        if !LABELS.contains(&label) {
            return Err(AppError::internal("yedek etiketi geçersiz"));
        }
        let _busy = self.busy.try_lock().map_err(|_| {
            AppError::conflict("Şu anda başka bir yedek alınıyor; bitmesini bekleyin.")
        })?;
        fs::create_dir_all(&self.dir)
            .await
            .map_err(AppError::internal)?;
        restrict_dir(&self.dir)?;
        let now = time::OffsetDateTime::now_utc();
        let name = format!(
            "dosyapi-{}-{label}-{}{EXTENSION}",
            stamp(now),
            hex::encode(random_bytes::<3>())
        );
        let target = self.dir.join(&name);
        let snapshot = self.dir.join(format!(".{name}.sqlite"));
        let part = self.dir.join(format!(".{name}.part"));

        let gate = self.gate.write().await;
        let cutoff = SystemTime::now();
        let snapshot_path = snapshot
            .to_str()
            .ok_or_else(|| AppError::internal("yedek yolu geçersiz"))?
            .to_string();
        let result = async {
            sqlx::query("VACUUM INTO ?")
                .bind(&snapshot_path)
                .execute(&self.pool)
                .await
                .map_err(db_err)?;
            let job = WriteJob {
                keys: self.keys.clone(),
                snapshot: snapshot.clone(),
                objects: self.files_root.join("objects"),
                out: part.clone(),
                created_at: now.unix_timestamp(),
                cutoff,
                label: label.to_string(),
            };
            tokio::task::spawn_blocking(move || write_archive(&job))
                .await
                .map_err(AppError::internal)?
        }
        .await;
        drop(gate);
        let _ = fs::remove_file(&snapshot).await;
        if let Err(error) = result {
            let _ = fs::remove_file(&part).await;
            return Err(error);
        }
        fs::rename(&part, &target)
            .await
            .map_err(AppError::internal)?;
        self.info(name, &target).await
    }

    async fn list(&self) -> AppResult<Vec<BackupInfo>> {
        let mut out = Vec::new();
        let Ok(mut entries) = fs::read_dir(&self.dir).await else {
            return Ok(out);
        };
        while let Some(entry) = entries.next_entry().await.map_err(AppError::internal)? {
            let name = entry.file_name().to_string_lossy().to_string();
            if !valid_name(&name) {
                continue;
            }
            out.push(self.info(name, &entry.path()).await?);
        }
        out.sort_by_key(|b| std::cmp::Reverse(b.at));
        Ok(out)
    }

    async fn verify(&self, name: &str) -> AppResult<BackupReport> {
        let path = self.path_of(name)?;
        if fs::metadata(&path).await.is_err() {
            return Err(AppError::NotFound);
        }
        verify_file(&path, &self.keys, &self.dir).await
    }

    async fn open(&self, name: &str) -> AppResult<(BackupInfo, Box<dyn FileSource>)> {
        let path = self.path_of(name)?;
        let info = self.info(name.to_string(), &path).await?;
        let file = fs::File::open(&path)
            .await
            .map_err(|_| AppError::NotFound)?;
        Ok((info, Box::new(PlainSource { file })))
    }

    async fn delete(&self, name: &str) -> AppResult<()> {
        let path = self.path_of(name)?;
        match fs::remove_file(&path).await {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Err(AppError::NotFound),
            Err(error) => Err(AppError::internal(error)),
        }
    }

    async fn prune(&self, label: &str, keep: usize) -> AppResult<usize> {
        let mut removed = 0;
        for info in self
            .list()
            .await?
            .into_iter()
            .filter(|b| b.label == label && !b.foreign)
            .skip(keep)
        {
            self.delete(&info.name).await?;
            removed += 1;
        }
        Ok(removed)
    }

    async fn secret_key(&self) -> AppResult<Vec<u8>> {
        fs::read(&self.secret_key).await.map_err(AppError::internal)
    }
}

/// Fabrika ayarlarına dönüş. Denetim günlüğü korunur: bu işlemin de izi kalmalı.
pub struct SqliteEraser {
    pub pool: SqlitePool,
    pub files_root: PathBuf,
}

#[async_trait]
impl DataEraser for SqliteEraser {
    async fn erase_all(&self) -> AppResult<()> {
        let mut tx = self.pool.begin().await.map_err(db_err)?;
        for table in [
            "sessions",
            "auth_tokens",
            "pendings",
            "history",
            "tasks",
            "todos",
            "project_notes",
            "totp_recovery",
            "messages",
            "request_outcomes",
            "conversations",
            "files",
            "project_authors",
            "projects",
            "authors",
            "contractors",
            "doc_types",
            "professions",
            "templates",
            "users",
            "roles",
            "settings",
        ] {
            sqlx::query(&format!("DELETE FROM {table}"))
                .execute(&mut *tx)
                .await
                .map_err(db_err)?;
        }
        tx.commit().await.map_err(db_err)?;
        let objects = self.files_root.join("objects");
        if fs::metadata(&objects).await.is_ok() {
            fs::remove_dir_all(&objects)
                .await
                .map_err(AppError::internal)?;
            fs::create_dir_all(&objects)
                .await
                .map_err(AppError::internal)?;
        }
        Ok(())
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use crate::db;

    struct Lab {
        root: PathBuf,
        backups: FullBackups,
        keys: BackupKeys,
    }

    async fn lab(tag: &str) -> Lab {
        let root = std::env::temp_dir().join(format!(
            "dosyapi-backup-{tag}-{}",
            hex::encode(random_bytes::<4>())
        ));
        std::fs::create_dir_all(root.join("files/objects/ab")).unwrap();
        let pool = db::connect(&root.join(DB_ENTRY)).await.unwrap();
        db::migrate(&pool).await.unwrap();
        sqlx::query("INSERT INTO roles (id, name, level, perms) VALUES ('r', 'Patron', 1, '{}')")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO projects (id, name, created_at) VALUES ('p', 'Proje', 0)")
            .execute(&pool)
            .await
            .ok();
        std::fs::write(root.join("files/objects/ab/abc-1"), b"sifreli-icerik").unwrap();
        std::fs::write(root.join("secret.key"), b"00").unwrap();
        let keys = BackupKeys::new(&Keyring::from_root([7u8; KEY_LEN]));
        let backups = FullBackups::new(
            pool,
            root.join("backups"),
            root.join("files"),
            root.join("secret.key"),
            keys.clone(),
            Arc::new(RwLock::new(())),
        );
        Lab {
            root,
            backups,
            keys,
        }
    }

    #[tokio::test]
    async fn roundtrip_verifies_and_restores() {
        let lab = lab("ok").await;
        let info = lab.backups.create("elle").await.unwrap();
        assert_eq!(info.label, "elle");
        assert!(!info.foreign);
        let report = lab.backups.verify(&info.name).await.unwrap();
        assert!(report.ok, "{}", report.message);
        assert_eq!(report.files, 1);

        std::fs::remove_file(lab.root.join("files/objects/ab/abc-1")).unwrap();
        let restored = restore_file(
            &lab.root.join("backups").join(&info.name),
            &lab.keys,
            &lab.root.join(DB_ENTRY),
            &lab.root.join("files"),
        )
        .await
        .unwrap();
        assert!(restored.previous.exists());
        assert_eq!(
            std::fs::read(lab.root.join("files/objects/ab/abc-1")).unwrap(),
            b"sifreli-icerik"
        );
    }

    #[tokio::test]
    async fn tampering_truncation_and_foreign_keys_are_detected() {
        let lab = lab("bad").await;
        let info = lab.backups.create("otomatik").await.unwrap();
        let path = lab.root.join("backups").join(&info.name);
        let original = std::fs::read(&path).unwrap();

        // Ortadan bir bayt değişti.
        let mut tampered = original.clone();
        let mid = tampered.len() / 2;
        tampered[mid] ^= 1;
        std::fs::write(&path, &tampered).unwrap();
        let report = lab.backups.verify(&info.name).await.unwrap();
        assert!(!report.ok);
        assert!(
            report.message.contains("değiştirilmiş"),
            "{}",
            report.message
        );

        // Sondan kesildi.
        std::fs::write(&path, &original[..original.len() - 40]).unwrap();
        assert!(!lab.backups.verify(&info.name).await.unwrap().ok);

        // Sona veri eklendi.
        let mut longer = original.clone();
        longer.extend_from_slice(b"ek");
        std::fs::write(&path, &longer).unwrap();
        assert!(!lab.backups.verify(&info.name).await.unwrap().ok);

        // Başlıktaki zaman değişti (AAD).
        let mut header = original.clone();
        header[20] ^= 1;
        std::fs::write(&path, &header).unwrap();
        assert!(!lab.backups.verify(&info.name).await.unwrap().ok);

        // Başka bir anahtar.
        std::fs::write(&path, &original).unwrap();
        let other = BackupKeys::new(&Keyring::from_root([9u8; KEY_LEN]));
        let report = verify_file(&path, &other, &lab.root).await.unwrap();
        assert!(!report.ok);
        assert!(
            report.message.contains("başka bir anahtar"),
            "{}",
            report.message
        );

        // Bozuk yedek geri yüklenmez ve mevcut veriye dokunulmaz.
        std::fs::write(&path, &tampered).unwrap();
        assert!(
            restore_file(
                &path,
                &lab.keys,
                &lab.root.join(DB_ENTRY),
                &lab.root.join("files")
            )
            .await
            .is_err()
        );
        assert!(lab.root.join("files/objects/ab/abc-1").exists());
    }

    #[tokio::test]
    async fn prune_keeps_newest_of_label() {
        let lab = lab("prune").await;
        for _ in 0..3 {
            lab.backups.create("otomatik").await.unwrap();
            tokio::time::sleep(std::time::Duration::from_millis(1100)).await;
        }
        lab.backups.create("elle").await.unwrap();
        assert_eq!(lab.backups.prune("otomatik", 1).await.unwrap(), 2);
        let left = lab.backups.list().await.unwrap();
        assert_eq!(left.len(), 2);
    }

    #[test]
    fn names_are_strict() {
        assert!(valid_name("dosyapi-20261112-155500-elle-a1b2c3.dsyb"));
        assert_eq!(
            label_of("dosyapi-20261112-155500-guncelleme-oncesi-a1b2c3.dsyb"),
            "guncelleme-oncesi"
        );
        assert!(!valid_name("../dosyapi-x.dsyb"));
        assert!(!valid_name("dosyapi-a/b.dsyb"));
        assert!(classify("files/objects/ab/abc").is_some());
        assert!(classify("files/objects/ab/../x").is_none());
        assert!(classify("files/objects/zz/abc").is_none());
        assert!(classify("secret.key").is_none());
    }
}
