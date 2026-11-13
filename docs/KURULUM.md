# Kurulum

## Gereksinimler

| | En az | Not |
| --- | --- | --- |
| İşletim sistemi | Ubuntu 22.04+ / Debian 12+ (64 bit, amd64 veya arm64) | systemd kullanan başka dağıtımlar da çalışır |
| Bellek | 1 GB | Kaynak koddan derlemede 3 GB; az ise betik derleme süresince geçici takas açar |
| Disk | 2 GB + belgeler | Kaynak koddan derlemede Docker için ~6 GB boş yer |
| Ağ | 80 ve 443 portları açık | Let's Encrypt sertifikası için |
| Alan adı | Sunucu IP'sini gösteren A kaydı | Ör. `dosya.sirket.com`; deneme için `sslip.io` (aşağıda) |

## Tek komutla kurulum (önerilen)

```bash
curl -fsSL https://raw.githubusercontent.com/ozdemiromer26/dosyapi/main/deploy/kur.sh | sudo bash -s -- --domain dosya.sirket.com
```

Betik sırasıyla:

1. Alan adının bu sunucuyu gösterip göstermediğini ve 80/443 portlarının boş olduğunu denetler.
2. Docker yoksa resmi betikle kurar (onay ister; `--yes` ile sormaz).
3. Hazır imajı indirir. İmaj bulunamazsa (henüz yayınlanmamışsa) sunucuda kaynak koddan derlemeyi önerir.
4. `/opt/dosyapi` altına `compose.yml`, `Caddyfile` ve `.env` yazar; yönetim aracını `/usr/local/bin/dosyapi-ctl` olarak kurar.
5. Uygulamayı ve Caddy'yi başlatır. Caddy HTTPS sertifikasını Let's Encrypt'ten kendisi alır ve yeniler.
6. Adresi ve tek kullanımlık **kurulum belirtecini** ekrana yazar.

Tarayıcıdan adresi açıp kurulum sihirbazını tamamlayın (bkz. [Kurulumdan sonra](#kurulumdan-sonra)).

Kurulum yarıda kalırsa ya da `uninstall` ile kaldırıldıysa betik yeniden çalıştırılabilir: çalışan bir kurulum yoksa
kaldığı yerden devam eder, mevcut veriler (`/opt/dosyapi/data`) korunur.

| Seçenek | Ne yapar |
| --- | --- |
| `--domain <ad>` | Alan adı (verilmezse sorulur) |
| `--version 1.2.3` | Belirli bir sürüm |
| `--from-source` | Hazır imaj yerine sunucuda kaynak koddan derler (10-30 dakika; bellek 3 GB'tan azsa derleme süresince geçici takas açılır; Docker diskinde ~6 GB boş yer gerekir). Kaynak kurulumunda `dosyapi-ctl update` de yeni sürümü sunucuda derler. |
| `--auto-update` | Her gece yedek alıp en yeni sürüme geçer |
| `--yes` | Soru sormadan devam eder |

Alan adınız yoksa denemek için IP'den türetilen bir ad kullanabilirsiniz: sunucu IP'si `203.0.113.5` ise
`--domain 203-0-113-5.sslip.io`. Bu ad doğrudan sunucuya çözülür ve Let's Encrypt sertifikası alınabilir.

### Kurulumdan sonra

1. **Kurulum sihirbazı** (tarayıcıda, dört adım): kurulum belirteci → şirket adı → Sistem Paneli (master) şifresi →
   ilk yönetici hesabı. Belirteç yanlışsa sihirbaz son adımda bunu söyler ve ilk adıma döner. Belirteci kaybettiyseniz
   `sudo dosyapi-ctl token` yenisini üretir.
2. **Sistem Paneli** `https://dosya.sirket.com/#sistem` adresindedir; master şifreyle girilir. Şirket kullanıcıları
   bu adresi bilmek zorunda değildir.
3. Sistem Paneli'nde önerilen ilk ayarlar:
   - **Güvenlik:** master için iki adımlı doğrulamayı açın.
   - **E-posta:** SMTP girin; yoksa kullanıcılar şifrelerini kendileri sıfırlayamaz.
   - **Roller ve kullanıcılar:** kademeleri ve yetkileri düzenleyin, ekibi ekleyin (her kullanıcıya tek kullanımlık
     davet bağlantısı üretilir).
   - **Şirket kimliği:** logo, ana renk ve KVKK aydınlatma metni.

### Yönetim

| Komut | Ne yapar |
| --- | --- |
| `sudo dosyapi-ctl status` | Servisler, sürüm, adres |
| `sudo dosyapi-ctl logs -f` | Canlı günlük |
| `sudo dosyapi-ctl start` / `restart` | Başlat / yeniden başlat |
| `sudo dosyapi-ctl backup [klasör]` | Tam yedek (veritabanı + dosyalar, şifreli) alır ve doğrular; uygulama durmaz. Klasör verilirse yedek ve `secret.key` oraya da kopyalanır |
| `sudo dosyapi-ctl verify <yedek> [--key secret.key]` | Yedeğin bütünlüğünü uçtan uca doğrular (başka sunucunun yedeği için `--key`) |
| `sudo dosyapi-ctl restore <yedek> [--key secret.key]` | Yedeği doğrular, uygulamayı durdurup geri yükler; mevcut veri `data/app/onceki-*` klasörüne taşınır |
| `sudo dosyapi-ctl update [version]` | Önce yedek alır, yeni sürüme geçer; sağlıklı açılmazsa önceki sürüme döner |
| `sudo dosyapi-ctl build [ref]` | Kaynak koddan imaj derler (`main` ya da `v1.2.3`) |
| `sudo dosyapi-ctl auto-update on\|off` | Gece güncellemesi (04:00 civarı) |
| `sudo dosyapi-ctl token` | Yeni kurulum belirteci (ilk kurulum bitmediyse) |
| `sudo dosyapi-ctl master-reset` | Master şifreyi sıfırlar; master iki adımlı doğrulaması, kilit ve panel oturumları da kalkar |
| `sudo dosyapi-ctl master-disable` | Sistem Paneli'ni kapatır; açık panel oturumları düşer, yalnızca `master-enable` açar |
| `sudo dosyapi-ctl master-enable` | Sistem Paneli'ni açar; hatalı denemelerden gelen geçici kilidi ve sayacı sıfırlar (şifre değişmez) |
| `sudo dosyapi-ctl factory-reset` | Tüm veriyi siler. Önce tam yedek alır; onay için sunucu adresini aynen yazmanız istenir |
| `sudo dosyapi-ctl uninstall` | Servisleri kaldırır; veriler kalır |

Yedek dosyası `secret.key` olmadan açılamaz; ikisini ayrı yerlerde, sunucu dışında saklayın. Anahtarı kaybetmek veriyi
kaybetmek, ikisinin birlikte başkasının eline geçmesi veriyi açması demektir. Ayrıntı: [Yedekleme](#yedekleme).

### Yerleşim

| Yol | İçerik |
| --- | --- |
| `/opt/dosyapi/.env` | Alan adı ve imaj sürümü |
| `/opt/dosyapi/data/config.toml` | Uygulama yapılandırması |
| `/opt/dosyapi/data/secret.key` | Ana şifreleme anahtarı |
| `/opt/dosyapi/data/app` | Veritabanı ve şifreli dosyalar |
| `/opt/dosyapi/data/app/backups` | Tam yedekler (`.dsyb`): otomatik, panelden ve konsoldan alınanlar |

### Güvenlik notları

- Uygulama konteyneri dışarıya port açmaz; trafiği yalnızca Caddy iletir. Konteyner salt okunur kök dosya sistemiyle,
  tüm Linux yetkileri düşürülmüş ve ayrıcalıksız kullanıcıyla (10001) çalışır.
- İmajlar GitHub Actions'ta derlenir, `ghcr.io` üzerinden yayınlanır; yapı kökeni (provenance) ve SBOM eklenir.
  Hazır imaj yoksa ya da indirilemiyorsa betik `--from-source` ile sunucuda derlemeyi önerir.

## Yayıncı için: Docker imajı

`v1.2.3` etiketi atıldığında `.github/workflows/release.yml` ikilileri derler ve `deploy/docker/Dockerfile.release` ile
`ghcr.io/ozdemiromer26/dosyapi:1.2.3` ve `:latest` imajlarını (amd64 + arm64) yayınlar. İlk yayından sonra GitHub'da
paketin görünürlüğünü **Public** yapın (Profile → Packages → dosyapi → Package settings); yoksa sunucular imajı indiremez.

## Linux sunucu (Docker olmadan)

```bash
sudo ./install.sh --url https://dosya.sirket.com
```

Depoda derlenmiş paket yoksa Rust (1.95+) ve Node.js (22+) gerekir; betik ikiliyi derler. `dosyapi` adında ayrıcalıksız
kullanıcı açar, ikiliyi `/opt/dosyapi/bin` altına koyar, yapılandırmayı `/etc/dosyapi`, veriyi `/var/lib/dosyapi` altına
yerleştirir, systemd servislerini başlatır ve kurulum belirtecini yazar. Sonrası Docker kurulumundaki gibidir:
[Kurulumdan sonra](#kurulumdan-sonra).

| Yol | İçerik |
| --- | --- |
| `/etc/dosyapi/config.toml` | Yapılandırma |
| `/etc/dosyapi/secret.key` | Ana şifreleme anahtarı. **Ayrıca yedekleyin.** |
| `/var/lib/dosyapi/dosyapi.sqlite` | Veritabanı |
| `/var/lib/dosyapi/files` | Şifreli dosyalar |
| `/var/lib/dosyapi/backups` | Tam yedekler (`.dsyb`) |

## HTTPS seçenekleri

**Yerleşik HTTPS.** Sunucu 80 ve 443 portlarını kullanır, sertifikayı Let's Encrypt'ten alır:

```bash
sudo ./install.sh --url https://dosya.sirket.com --tls
```

Kurulumdan sonra Sistem Paneli → Alan adı & DNS bölümünde *Otomatik HTTPS sertifikası*nı açıp kaydedin, sonra
`sudo systemctl restart dosyapi` çalıştırın.

**Ters vekil.** nginx için `deploy/nginx/dosyapi.conf` örneğini kullanın ve `config.toml` içinde `trust_proxy = true` yapın.
Bu ayar yalnızca sunucuya gerçekten vekil arkasından ulaşılıyorsa açılmalıdır; aksi hâlde istemci IP'si taklit edilebilir.

Canlı güncelleme `/api/v1/events` adresinde uzun süre açık kalan bir bağlantıdır (Server-Sent Events). Uygulama
`X-Accel-Buffering: no` başlığını gönderdiği için nginx olayları tamponlamaz; 20 saniyede bir canlı tutma sinyali
gittiği için `proxy_read_timeout` 60 saniyeden kısa olmamalıdır (örnekte 300). Başka bir vekil kullanıyorsanız bu yolda
yanıt tamponlamayı ve sıkıştırmayı kapatın. Docker kurulumundaki Caddy için bu ayar hazırdır. Bağlantı kurulamazsa
uygulama yine çalışır, yalnızca değişiklikler birkaç saniye gecikmeyle görünür.

## Kaynaktan Docker ile derleme

Depo kökündeki `docker-compose.yml` imajı kaynak koddan derler; geliştirme ve deneme içindir, HTTPS içermez:

```bash
DOSYAPI_PUBLIC_URL=http://127.0.0.1:8080 docker compose up -d --build
docker compose logs dosyapi   # kurulum belirteci
```

## Yedekleme

Yedek **tam yedektir**: veritabanı ve tüm yüklenen dosyalar tek bir `.dsyb` dosyasındadır. Dosya `secret.key`'den
türetilen anahtarla şifreli ve kimlik doğrulamalıdır: tek bir bayt değişirse, dosya kesilirse ya da başka bir sunucunun
anahtarıyla alınmışsa doğrulama bunu yakalar ve geri yükleme yapılmaz. Eski yedekler yedeğe girmez.

Geri yüklemek için **iki dosya** gerekir: yedek dosyası ve o sunucunun `secret.key` dosyası.

- **Otomatik:** Sistem Paneli → Sistem → Yedekler'de aralık (6 saatten haftaya) ve saklanacak sayı seçilir. Varsayılan: her
  gün, son 7 otomatik yedek. Sayı dolunca en eski otomatik yedek silinir; elle alınanlar siz silene kadar kalır.
- **Panelden:** "Şimdi yedek al", listeden İndir / Doğrula / Sil. Anahtar dosyası aynı bölümden master şifreyle indirilir.
- **Konsoldan:**

```bash
sudo dosyapi-ctl backup                    # Docker
sudo dosyapi-ctl backup /mnt/usb/dosyapi   # yedek + secret.key bu klasöre de kopyalanır
sudo -u dosyapi /opt/dosyapi/bin/dosyapi --config /etc/dosyapi/config.toml backup   # systemd
```

### Doğrulama ve geri yükleme

```bash
sudo dosyapi-ctl verify /opt/dosyapi/data/app/backups/dosyapi-....dsyb
sudo dosyapi-ctl restore /opt/dosyapi/data/app/backups/dosyapi-....dsyb
```

Başka bir sunucunun yedeğini (ör. sunucu taşırken) geri yüklerken o sunucunun anahtarını verin; anahtar bu sunucunun
anahtarı olur, eskisi de saklanır:

```bash
sudo dosyapi-ctl restore yedek.dsyb --key secret.key
```

Geri yükleme önce yedeğin tamamını doğrular, veritabanı bütünlüğünü ve her kayıtlı dosyanın yedekte olduğunu denetler; ancak
sonra mevcut veriyle yer değiştirir. Mevcut veri silinmez, `onceki-<zaman>` klasörüne taşınır. systemd kurulumunda önce
servisi durdurun (`sudo systemctl stop dosyapi`), komutu `dosyapi` kullanıcısıyla çalıştırın, sonra başlatın.

## Sistem Paneli: şifre, kilit, kapatma

5 hatalı master şifre denemesinde panel geçici olarak kilitlenir (1 dakikadan başlar, en çok 1 saat). Kilit ekranında açılma
zamanı, deneme sayısı ve son denemenin IP adresi görünür. Hemen açmak ya da paneli tamamen kapatıp açmak için:

```bash
sudo dosyapi-ctl master-enable     # kilidi ve sayacı sıfırlar, kapalıysa açar
sudo dosyapi-ctl master-disable    # paneli kapatır; yalnızca master-enable açar
sudo dosyapi-ctl master-reset      # master şifreyi unuttuysanız: yeni şifre (2FA ve kilit de sıfırlanır)
```

systemd kurulumunda aynı komutlar `sudo -u dosyapi /opt/dosyapi/bin/dosyapi --config /etc/dosyapi/config.toml <komut>`
biçiminde çalışır. Tüm bu işlemler denetim günlüğüne yazılır.

## Fabrika ayarlarına dönüş

```bash
sudo dosyapi-ctl factory-reset
```

Tüm projeler, belgeler, kullanıcılar ve ayarlar silinir; denetim günlüğü kalır. Önce otomatik bir tam yedek alınır ve
doğrulanır. Yanlışlıkla çalıştırılmasın diye yalnızca etkileşimli terminalde çalışır ve sunucunun alan adını (yoksa şirket
adını) aynen yazmanızı ister. Sonunda yeni kurulum belirteci verilir. Sistem Paneli'ndeki karşılığı master şifre ve onay
metni ister.

## E-posta

Şifre sıfırlama ve davet e-postaları için Sistem Paneli → E-posta bölümünden SMTP girin. SMTP yoksa kullanıcılar kendi
şifrelerini sıfırlayamaz; yönetici Sistem Paneli'nden tek kullanımlık bağlantı üretip iletir.

## KVKK aydınlatma metni

Sistem Paneli → Şirket kimliği bölümünden şirketinizin aydınlatma metnini girin. Metin girildiğinde kayıt ekranında onay
kutusu çıkar; onaylamadan kayıt olunamaz ve onay zamanı saklanır. Metni hukuk danışmanınızla hazırlayın, varsayılan metin
yoktur. TC ve telefon gibi kişisel verilere erişim denetim günlüğüne `pii.access` olarak en çok saatte bir yazılır.
