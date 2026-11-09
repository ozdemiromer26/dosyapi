//! Şifreli dosya deposu.
//!
//! Her dosya kendi rastgele anahtarıyla, 64 KiB'lik parçalar halinde AES-256-GCM ile
//! şifrelenir (STREAM yapısı). Dosya anahtarı ana anahtarla sarmalanıp başlığa yazılır.
//! Parça sırası ve son parça işareti nonce içinde olduğundan yeniden sıralama, parça
//! değiştirme ve kesme saldırıları çözme sırasında yakalanır.

use crate::crypto::{FieldCipher, KEY_LEN, random_bytes};
use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use async_trait::async_trait;
use dosyapi_core::error::{AppError, AppResult};
use dosyapi_core::ports::{FileSink, FileSource, FileStore};
use std::path::{Path, PathBuf};
use tokio::fs::{self, File, OpenOptions};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const MAGIC: &[u8; 4] = b"DSY1";
const CHUNK: usize = 64 * 1024;
const PREFIX_LEN: usize = 7;
const WRAPPED_LEN: usize = 12 + KEY_LEN + 16;
const HEADER_LEN: usize = MAGIC.len() + WRAPPED_LEN + PREFIX_LEN;

fn io_err(error: std::io::Error) -> AppError {
    AppError::internal(error)
}

fn chunk_nonce(prefix: &[u8; PREFIX_LEN], counter: u32, last: bool) -> [u8; 12] {
    let mut nonce = [0u8; 12];
    nonce[..PREFIX_LEN].copy_from_slice(prefix);
    nonce[PREFIX_LEN..11].copy_from_slice(&counter.to_be_bytes());
    nonce[11] = u8::from(last);
    nonce
}

pub struct EncryptedFileStore {
    root: PathBuf,
    wrap: FieldCipher,
}

impl EncryptedFileStore {
    pub async fn new(root: &Path, wrap: FieldCipher) -> AppResult<Self> {
        // Bağlantısı kopan yüklemelerin artıkları açılışta temizlenir.
        let _ = fs::remove_dir_all(root.join("tmp")).await;
        for dir in ["objects", "tmp"] {
            fs::create_dir_all(root.join(dir)).await.map_err(io_err)?;
        }
        restrict_dir(root)?;
        Ok(Self {
            root: root.to_path_buf(),
            wrap,
        })
    }

    /// Yol yalnızca kimlikten üretilir; kullanıcı dosya adı burada yer almaz.
    fn object_path(&self, id: &str) -> AppResult<PathBuf> {
        if id.is_empty()
            || id.len() > 64
            || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
        {
            return Err(AppError::internal("geçersiz nesne kimliği"));
        }
        Ok(self
            .root
            .join("objects")
            .join(&id[..id.len().min(2)])
            .join(id))
    }
}

#[cfg(unix)]
fn restrict_dir(path: &Path) -> AppResult<()> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700)).map_err(io_err)
}

#[cfg(not(unix))]
fn restrict_dir(_path: &Path) -> AppResult<()> {
    Ok(())
}

async fn create_private(path: &Path) -> AppResult<File> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    options.mode(0o600);
    options.open(path).await.map_err(io_err)
}

struct Sink {
    file: File,
    temp: PathBuf,
    target: PathBuf,
    cipher: Aes256Gcm,
    prefix: [u8; PREFIX_LEN],
    counter: u32,
    buffer: Vec<u8>,
}

impl Sink {
    async fn emit(&mut self, last: bool) -> AppResult<()> {
        let take = self.buffer.len().min(CHUNK);
        let nonce_bytes = chunk_nonce(&self.prefix, self.counter, last);
        let nonce = Nonce::try_from(&nonce_bytes[..]).map_err(AppError::internal)?;
        let ciphertext = self
            .cipher
            .encrypt(
                &nonce,
                Payload {
                    msg: &self.buffer[..take],
                    aad: MAGIC,
                },
            )
            .map_err(|_| AppError::internal("dosya şifrelenemedi"))?;
        self.file
            .write_all(&(ciphertext.len() as u32).to_be_bytes())
            .await
            .map_err(io_err)?;
        self.file.write_all(&ciphertext).await.map_err(io_err)?;
        self.buffer.drain(..take);
        self.counter = self
            .counter
            .checked_add(1)
            .ok_or_else(|| AppError::internal("parça sayacı taştı"))?;
        Ok(())
    }
}

#[async_trait]
impl FileSink for Sink {
    async fn write(&mut self, chunk: &[u8]) -> AppResult<()> {
        self.buffer.extend_from_slice(chunk);
        // Son parçayı ayırt edebilmek için en az bir parça bellekte bekletilir.
        while self.buffer.len() > CHUNK {
            self.emit(false).await?;
        }
        Ok(())
    }

    async fn finish(mut self: Box<Self>) -> AppResult<()> {
        self.emit(true).await?;
        self.file.sync_all().await.map_err(io_err)?;
        drop(std::mem::take(&mut self.buffer));
        if let Some(parent) = self.target.parent() {
            fs::create_dir_all(parent).await.map_err(io_err)?;
        }
        fs::rename(&self.temp, &self.target).await.map_err(io_err)
    }

    async fn abort(self: Box<Self>) {
        let _ = fs::remove_file(&self.temp).await;
    }
}

struct Source {
    file: File,
    cipher: Aes256Gcm,
    prefix: [u8; PREFIX_LEN],
    counter: u32,
    finished: bool,
    next_len: Option<usize>,
}

impl Source {
    async fn read_len(&mut self) -> AppResult<Option<usize>> {
        let mut raw = [0u8; 4];
        match self.file.read_exact(&mut raw).await {
            Ok(_) => Ok(Some(u32::from_be_bytes(raw) as usize)),
            Err(error) if error.kind() == std::io::ErrorKind::UnexpectedEof => Ok(None),
            Err(error) => Err(io_err(error)),
        }
    }
}

#[async_trait]
impl FileSource for Source {
    async fn next_chunk(&mut self) -> AppResult<Option<Vec<u8>>> {
        if self.finished {
            return Ok(None);
        }
        let corrupt = || AppError::internal("dosya bozuk veya değiştirilmiş");
        let length = self.next_len.take().ok_or_else(corrupt)?;
        if length > CHUNK + 16 {
            return Err(corrupt());
        }
        let mut ciphertext = vec![0u8; length];
        self.file
            .read_exact(&mut ciphertext)
            .await
            .map_err(|_| corrupt())?;
        self.next_len = self.read_len().await?;
        let last = self.next_len.is_none();
        let nonce_bytes = chunk_nonce(&self.prefix, self.counter, last);
        let nonce = Nonce::try_from(&nonce_bytes[..]).map_err(AppError::internal)?;
        let plain = self
            .cipher
            .decrypt(
                &nonce,
                Payload {
                    msg: &ciphertext,
                    aad: MAGIC,
                },
            )
            .map_err(|_| corrupt())?;
        self.counter = self.counter.checked_add(1).ok_or_else(corrupt)?;
        self.finished = last;
        Ok(Some(plain))
    }
}

#[async_trait]
impl FileStore for EncryptedFileStore {
    async fn create(&self, id: &str) -> AppResult<Box<dyn FileSink>> {
        let target = self.object_path(id)?;
        let temp = self.root.join("tmp").join(format!("{id}.part"));
        let mut file = create_private(&temp).await?;
        let key = random_bytes::<KEY_LEN>();
        let prefix = random_bytes::<PREFIX_LEN>();
        let wrapped = self.wrap.encrypt(&format!("file:{id}"), &key)?;
        file.write_all(MAGIC).await.map_err(io_err)?;
        file.write_all(&wrapped).await.map_err(io_err)?;
        file.write_all(&prefix).await.map_err(io_err)?;
        let cipher = Aes256Gcm::new_from_slice(&key).map_err(AppError::internal)?;
        Ok(Box::new(Sink {
            file,
            temp,
            target,
            cipher,
            prefix,
            counter: 0,
            buffer: Vec::with_capacity(CHUNK * 2),
        }))
    }

    async fn open(&self, id: &str) -> AppResult<Box<dyn FileSource>> {
        let path = self.object_path(id)?;
        let mut file = File::open(&path).await.map_err(|_| AppError::NotFound)?;
        let mut header = [0u8; HEADER_LEN];
        file.read_exact(&mut header)
            .await
            .map_err(|_| AppError::internal("dosya başlığı bozuk"))?;
        if &header[..4] != MAGIC {
            return Err(AppError::internal("dosya biçimi tanınmadı"));
        }
        let key = self
            .wrap
            .decrypt(&format!("file:{id}"), &header[4..4 + WRAPPED_LEN])?;
        let cipher = Aes256Gcm::new_from_slice(&key).map_err(AppError::internal)?;
        let mut prefix = [0u8; PREFIX_LEN];
        prefix.copy_from_slice(&header[4 + WRAPPED_LEN..]);
        let mut source = Source {
            file,
            cipher,
            prefix,
            counter: 0,
            finished: false,
            next_len: None,
        };
        source.next_len = source.read_len().await?;
        Ok(Box::new(source))
    }

    async fn delete(&self, id: &str) -> AppResult<()> {
        match fs::remove_file(self.object_path(id)?).await {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(io_err(error)),
        }
    }

    async fn put_small(&self, id: &str, bytes: &[u8]) -> AppResult<()> {
        self.delete(id).await?;
        let mut sink = self.create(id).await?;
        sink.write(bytes).await?;
        sink.finish().await
    }

    async fn get_small(&self, id: &str) -> AppResult<Option<Vec<u8>>> {
        let mut source = match self.open(id).await {
            Ok(source) => source,
            Err(AppError::NotFound) => return Ok(None),
            Err(error) => return Err(error),
        };
        let mut out = Vec::new();
        while let Some(chunk) = source.next_chunk().await? {
            out.extend_from_slice(&chunk);
        }
        Ok(Some(out))
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    async fn store(dir: &str) -> (EncryptedFileStore, PathBuf) {
        let root = std::env::temp_dir().join(format!(
            "dosyapi-store-{dir}-{}",
            crate::crypto::random_bytes::<4>()[0]
        ));
        let _ = fs::remove_dir_all(&root).await;
        let cipher = FieldCipher::new(&[9u8; KEY_LEN]).unwrap();
        (EncryptedFileStore::new(&root, cipher).await.unwrap(), root)
    }

    async fn read_all(s: &EncryptedFileStore, id: &str) -> AppResult<Vec<u8>> {
        let mut source = s.open(id).await?;
        let mut out = Vec::new();
        while let Some(c) = source.next_chunk().await? {
            out.extend_from_slice(&c);
        }
        Ok(out)
    }

    #[tokio::test]
    async fn roundtrip_various_sizes_and_never_plaintext() {
        let (s, root) = store("rt").await;
        for size in [1usize, CHUNK - 1, CHUNK, CHUNK + 1, CHUNK * 3] {
            let id = format!("file-{size}");
            let data = vec![0x41u8; size];
            let mut sink = s.create(&id).await.unwrap();
            for part in data.chunks(10_000) {
                sink.write(part).await.unwrap();
            }
            sink.finish().await.unwrap();
            assert_eq!(read_all(&s, &id).await.unwrap(), data);
            let raw = std::fs::read(s.object_path(&id).unwrap()).unwrap();
            assert!(
                !raw.windows(32).any(|w| w == [0x41u8; 32]),
                "düz metin diske yazılmamalı"
            );
        }
        let _ = fs::remove_dir_all(root).await;
    }

    #[tokio::test]
    async fn truncation_and_tampering_are_detected() {
        let (s, root) = store("tamper").await;
        let mut sink = s.create("victim").await.unwrap();
        sink.write(&vec![7u8; CHUNK * 3]).await.unwrap();
        sink.finish().await.unwrap();
        let path = s.object_path("victim").unwrap();
        let original = std::fs::read(&path).unwrap();

        let cut = HEADER_LEN + 4 + CHUNK + 16;
        std::fs::write(&path, &original[..cut]).unwrap();
        assert!(
            read_all(&s, "victim").await.is_err(),
            "kesilmiş dosya reddedilmeli"
        );

        let mut flipped = original.clone();
        flipped[HEADER_LEN + 100] ^= 1;
        std::fs::write(&path, &flipped).unwrap();
        assert!(
            read_all(&s, "victim").await.is_err(),
            "değiştirilmiş dosya reddedilmeli"
        );
        let _ = fs::remove_dir_all(root).await;
    }

    #[tokio::test]
    async fn rejects_path_traversal_ids() {
        let (s, root) = store("path").await;
        assert!(s.create("../../etc/passwd").await.is_err());
        assert!(s.open("..").await.is_err());
        let _ = fs::remove_dir_all(root).await;
    }
}
