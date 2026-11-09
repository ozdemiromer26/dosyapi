# Güncelleme sistemi

## Şirket yöneticisi için

Sistem Paneli → Sistem → **Güncelleme denetle**. Yeni sürüm varsa master şifreyle **Güncellemeyi kur**. Sistem veritabanını
yedekler, paketi indirir, imzasını doğrular, kurar ve yeniden başlatır. Yeni sürüm sağlıklı açılmazsa önceki sürüme döner.

Kanallar: Kararlı, Beta, Geliştirici.

## Nasıl çalışır

```
Uygulama (ayrıcalıksız)                      Güncelleyici (root, systemd)
  bildirimi ve imzayı indirir
  imzayı doğrular, sürümü karşılaştırır
  paketi indirir, özetini doğrular
  update/request.json yazar  ───────────▶    imzayı gömülü anahtarla YENİDEN doğrular
                                             paketi root'a ait klasöre kopyalar, özetler
                                             ikiliyi atomik değiştirir, servisi yeniden başlatır
                                             /healthz yanıt vermezse eski sürüme döner
```

Uygulama süreci `/opt/dosyapi/bin` altına yazamaz. Uygulama ele geçirilse bile imzasız paket kurulamaz.

## Yayıncı için: ilk hazırlık

**Bu adım yapılmadan güncelleme sistemi kapalıdır.** Derlemeye açık anahtar gömülmezse denetim "anahtar tanımlı değil" der.

```bash
./target/release/dosyapi release-keygen --out signing.key
```

- `signing.key` dosyasını depoya koymayın; GitHub'da `DOSYAPI_SIGNING_KEY` sırrı olarak saklayın.
- Yazdırılan açık anahtarı `DOSYAPI_RELEASE_PUBKEYS` değişkenine yazın.
- Bildirimlerin yayınlanacağı HTTPS adresini `DOSYAPI_UPDATE_URL` değişkenine yazın.

Bildirim adresi şu düzende olmalıdır:

```
<DOSYAPI_UPDATE_URL>/stable/manifest.json
<DOSYAPI_UPDATE_URL>/stable/manifest.json.sig
```

`v1.2.3` etiketi atıldığında `.github/workflows/release.yml` Linux x86_64 ve aarch64 için derler ve imzalar. Üretilen
`manifest.json` ile `.sig` dosyalarını yukarıdaki adrese kopyalamak yayını tamamlar (GitHub Pages ya da herhangi bir statik
HTTPS sunucusu yeterlidir).

Elle yayın:

```bash
scripts/make-manifest.py --version 1.2.3 --channel stable --min-version 1.0.0 \
  --base-url https://guncelleme.ornek.com/paket --notes notlar.txt \
  dist/dosyapi-1.2.3-linux-x86_64 dist/dosyapi-1.2.3-linux-aarch64
./target/release/dosyapi release-sign --key signing.key --manifest manifest.json
```

## Anahtar döndürme

`DOSYAPI_RELEASE_PUBKEYS` virgülle birden çok anahtar alır. Yeni anahtarı ekleyip bir sürüm yayınlayın, kurulumlar güncellendikten
sonra eskisini çıkarın.

## Veritabanı değişiklikleri

Göçler (`crates/dosyapi-infra/migrations`) açılışta otomatik uygulanır. Geri dönüşün çalışması için göçler **eklemeli**
olmalıdır: bir sürümde kolon kaldırmayın ya da yeniden adlandırmayın, önce kullanımını bırakıp sonraki sürümde silin. Eski ikili
yeni göçleri görmezden gelerek açılır. Yıkıcı bir göç gerekirse kurulumdan önce alınan `pre-update` yedeği geri yüklenmelidir.
