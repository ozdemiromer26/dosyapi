# Kurulum

## Tek komutla kurulum (önerilen)

Gerekenler: Ubuntu/Debian gibi bir Linux sunucu (1 GB RAM yeterli) ve DNS'te sunucunun IP'sini gösteren bir alan adı
(ör. `dosya.sirket.com` için A kaydı).

```bash
curl -fsSL https://raw.githubusercontent.com/ozdemiromer26/dosyapi/main/deploy/kur.sh | sudo bash -s -- --alan-adi dosya.sirket.com
```

Betik sırasıyla:

1. Alan adının bu sunucuyu gösterip göstermediğini ve 80/443 portlarının boş olduğunu denetler.
2. Docker yoksa resmi betikle kurar (onay ister; `--evet` ile sormaz).
3. `/opt/dosyapi` altına `compose.yml`, `Caddyfile` ve `.env` yazar; yönetim aracını `/usr/local/bin/dosyapi-ctl` olarak kurar.
4. Uygulamayı ve Caddy'yi başlatır. Caddy HTTPS sertifikasını Let's Encrypt'ten kendisi alır ve yeniler.
5. Adresi ve tek kullanımlık **kurulum belirtecini** ekrana yazar.

Tarayıcıdan adresi açıp belirteci girin; şirket adı, master şifre ve ilk yönetici hesabını oluşturun.

Seçenekler: `--surum 1.2.3` (belirli sürüm), `--otomatik-guncelleme` (her gece yedek alıp günceller), `--evet`.

### Yönetim

| Komut | Ne yapar |
| --- | --- |
| `sudo dosyapi-ctl durum` | Servisler, sürüm, adres |
| `sudo dosyapi-ctl gunluk -f` | Canlı günlük |
| `sudo dosyapi-ctl yedekle` | Tutarlı yedek (birkaç saniyelik kesinti) → `/opt/dosyapi/yedekler` |
| `sudo dosyapi-ctl geri-yukle <dosya>` | Yedekten döner; mevcut veri `data.eski-*` olarak kenara alınır |
| `sudo dosyapi-ctl guncelle [sürüm]` | Önce yedek alır, yeni imaja geçer; sağlıklı açılmazsa önceki sürüme döner |
| `sudo dosyapi-ctl otomatik-guncelleme ac\|kapat` | Gece güncellemesi (04:00 civarı) |
| `sudo dosyapi-ctl belirtec` | Yeni kurulum belirteci (ilk kurulum bitmediyse) |
| `sudo dosyapi-ctl master-sifirla` | Master şifreyi ve master iki adımlı doğrulamayı sıfırlar |
| `sudo dosyapi-ctl kaldir` | Servisleri kaldırır; veriler kalır |

Yedek arşivi gizli anahtarı da içerir: sunucu dışında, güvenli bir yerde saklayın. Arşivi kaybetmek veriyi kaybetmek,
başkasının eline geçmesi veriyi açması demektir.

### Yerleşim

| Yol | İçerik |
| --- | --- |
| `/opt/dosyapi/.env` | Alan adı ve imaj sürümü |
| `/opt/dosyapi/data/config.toml` | Uygulama yapılandırması |
| `/opt/dosyapi/data/secret.key` | Ana şifreleme anahtarı |
| `/opt/dosyapi/data/app` | Veritabanı, şifreli dosyalar, uygulama içi yedekler |
| `/opt/dosyapi/yedekler` | `dosyapi-ctl yedekle` arşivleri (son 14 tanesi tutulur) |

### Güvenlik notları

- Uygulama konteyneri dışarıya port açmaz; trafiği yalnızca Caddy iletir. Konteyner salt okunur kök dosya sistemiyle,
  tüm Linux yetkileri düşürülmüş ve ayrıcalıksız kullanıcıyla (10001) çalışır.
- İmajlar GitHub Actions'ta derlenir, `ghcr.io` üzerinden yayınlanır; yapı kökeni (provenance) ve SBOM eklenir.

## Yayıncı için: Docker imajı

`v1.2.3` etiketi atıldığında `.github/workflows/release.yml` ikilileri derler ve `deploy/docker/Dockerfile.release` ile
`ghcr.io/ozdemiromer26/dosyapi:1.2.3` ve `:latest` imajlarını (amd64 + arm64) yayınlar. İlk yayından sonra GitHub'da
paketin görünürlüğünü **Public** yapın (Profile → Packages → dosyapi → Package settings); yoksa sunucular imajı indiremez.

## Linux sunucu (Docker olmadan)

```bash
sudo ./install.sh --url https://dosya.sirket.com
```

Betik şunları yapar: `dosyapi` adında ayrıcalıksız kullanıcı açar, ikiliyi `/opt/dosyapi/bin` altına koyar, yapılandırmayı
`/etc/dosyapi`, veriyi `/var/lib/dosyapi` altına yerleştirir ve systemd servislerini başlatır.

| Yol | İçerik |
| --- | --- |
| `/etc/dosyapi/config.toml` | Yapılandırma |
| `/etc/dosyapi/secret.key` | Ana şifreleme anahtarı. **Ayrıca yedekleyin.** |
| `/var/lib/dosyapi/dosyapi.sqlite` | Veritabanı |
| `/var/lib/dosyapi/files` | Şifreli dosyalar |
| `/var/lib/dosyapi/backups` | Günlük yedekler |

## HTTPS seçenekleri

**Yerleşik HTTPS.** Sunucu 80 ve 443 portlarını kullanır, sertifikayı Let's Encrypt'ten alır:

```bash
sudo ./install.sh --url https://dosya.sirket.com --tls
```

Kurulumdan sonra Sistem Paneli → Alan adı & DNS bölümünde *Otomatik HTTPS sertifikası*nı açıp kaydedin, sonra
`sudo systemctl restart dosyapi` çalıştırın.

**Ters vekil.** nginx için `deploy/nginx/dosyapi.conf` örneğini kullanın ve `config.toml` içinde `trust_proxy = true` yapın.
Bu ayar yalnızca sunucuya gerçekten vekil arkasından ulaşılıyorsa açılmalıdır; aksi hâlde istemci IP'si taklit edilebilir.

## Kaynaktan Docker ile derleme

Depo kökündeki `docker-compose.yml` imajı kaynak koddan derler; geliştirme ve deneme içindir, HTTPS içermez:

```bash
DOSYAPI_PUBLIC_URL=http://127.0.0.1:8080 docker compose up -d --build
docker compose logs dosyapi   # kurulum belirteci
```

## Yedekleme

Her gün otomatik yedek alınır. Elle almak için Sistem Paneli → Sistem ya da:

```bash
sudo -u dosyapi /opt/dosyapi/bin/dosyapi --config /etc/dosyapi/config.toml backup
```

Yedek veritabanını kapsar. Tam yedek için `/var/lib/dosyapi/files` klasörünü ve `/etc/dosyapi/secret.key` dosyasını da ayrı
bir yere kopyalayın. Anahtar olmadan yedek açılamaz.

## Master şifreyi unutursanız

Sunucu konsolundan sıfırlanır (iki adımlı doğrulamayı ve kilidi de kaldırır):

```bash
sudo -u dosyapi /opt/dosyapi/bin/dosyapi --config /etc/dosyapi/config.toml master-reset
```

## E-posta

Şifre sıfırlama ve davet e-postaları için Sistem Paneli → E-posta bölümünden SMTP girin. SMTP yoksa kullanıcılar kendi
şifrelerini sıfırlayamaz; yönetici Sistem Paneli'nden tek kullanımlık bağlantı üretip iletir.

## KVKK aydınlatma metni

Sistem Paneli → Şirket kimliği bölümünden şirketinizin aydınlatma metnini girin. Metin girildiğinde kayıt ekranında onay
kutusu çıkar; onaylamadan kayıt olunamaz ve onay zamanı saklanır. Metni hukuk danışmanınızla hazırlayın, varsayılan metin
yoktur. TC ve telefon gibi kişisel verilere erişim denetim günlüğüne `pii.access` olarak en çok saatte bir yazılır.
