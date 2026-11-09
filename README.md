# dosyapı

**Şantiyenin dosyası cebinde.** İnşaat firmaları için proje dosyası, müellif, müteahhit, görev ve belge yönetimi.

Her şirket kendi sunucusuna kurar: WordPress gibi, ama tek ikili dosya, ayrı veritabanı servisi yok. Sunucu Rust ile
yazıldı, arayüz telefonda ve masaüstünde tarayıcıdan çalışır.

## Özellikler

- Projeler, proje durumları, zorunlu/seçmeli belge ağacı, ek dosyalar
- Proje ekranında yerinde düzenleme: fotoğraf, iş durumu, adres, pafta, ada, parsel, notlar
- Projeye kişisel not: yalnızca yazan kullanıcı görür, kendiliğinden kaydedilir, diskte şifreli durur
- Sistem panelinde Hakkında: sürüm, son güncelleme tarihi, geliştiren
- İki adımlı doğrulama: QR ile kurulum, tek kullanımlık kodlar, 10 kurtarma kodu
- Tek komutla kurulum: Docker + otomatik HTTPS (`deploy/kur.sh`), yönetim için `dosyapi-ctl`
- Arsa sahipleri ve vekiller; hisse toplamının 1/1 olması denetlenir
- Müellif ve müteahhit kayıtları; proje başına meslek bazlı müellif ataması
- Rol ve kademe tabanlı yetki, alan bazlı onay kuyruğu, silmeyi geri alma
- Görevler ve kişisel notlar
- Word benzeri belge şablonu düzenleyici; metni seçilebilir PDF, gerçek Word (.docx) ve yazdırma çıktısı
- Şantiye panosu ve QR
- Sistem Paneli: şirket kimliği, roller, kullanıcılar, sunucu dosyaları, alan adı ve DNS, e-posta, güncelleme, yedek, denetim günlüğü
- KVKK aydınlatma metni onayı ve kişisel veri erişim günlüğü
- Türkçe/İngilizce, açık/koyu tema

## Kurulum

Gereksinim: systemd kullanan Linux sunucu. Depoda derlenmiş paket yoksa Rust ve Node.js de gerekir.

```bash
git clone <depo-adresi> dosyapi
cd dosyapi
sudo ./install.sh --url https://dosya.sirket.com
```

Betik bir **kurulum belirteci** yazar. Tarayıcıdan adrese gidin, belirteçle şirket adını, master şifreyi ve ilk yöneticiyi
oluşturun. Sonra Sistem Paneli'ne giriş ekranındaki *powered by dosyapı* yazısına 5 kez dokunarak ya da `/#sistem` adresinden
ulaşın.

Ayrıntılar: [docs/KURULUM.md](docs/KURULUM.md) · [docs/DNS.md](docs/DNS.md) · [docs/GUNCELLEME.md](docs/GUNCELLEME.md) · [SECURITY.md](SECURITY.md)

## Geliştirme

```bash
cd web && npm ci && npm run build && cd ..
cargo run -p dosyapi -- --config ./dev.toml init --data-dir ./data --secret-key ./dev.key
cargo run -p dosyapi -- --config ./dev.toml serve
```

| Komut | Ne yapar |
| --- | --- |
| `make test` | Rust testleri, clippy, TypeScript denetimi |
| `make pentest` | Geçici sunucuya karşı saldırı senaryoları |
| `make audit` | Bilinen açık taraması (Rust ve npm) |

## Mimari

```
crates/dosyapi-core    İş kuralları, yetki politikası, portlar. HTTP, SQL ve kripto bilmez.
crates/dosyapi-infra   Portların uygulamaları: SQLite, AES-256-GCM, Argon2id, SMTP, DNS, imzalı güncelleme.
crates/dosyapi         HTTP katmanı, CLI ve bileşim kökü. Web arayüzü ikiliye gömülür.
web/                   React + TypeScript. Ekranlar, görünüm modeli (vm/) ve API istemcisi ayrıdır.
security/              Sızma testi ve güncelleme saldırı testleri.
```

Bağımlılık yönü tek yönlüdür: `dosyapi → infra → core`. `core` dış dünyayı yalnızca `ports.rs` içindeki dar arayüzlerle
görür; yeni bir DNS sağlayıcısı ya da depo eklemek çekirdeği değiştirmez.
