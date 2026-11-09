# Kurulum

## Linux sunucu

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

## Docker

```bash
DOSYAPI_PUBLIC_URL=https://dosya.sirket.com docker compose up -d
docker compose logs dosyapi   # kurulum belirteci
```

Docker kurulumunda uygulama içi güncelleme yoktur; yeni imajı çekip yeniden başlatın.

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
