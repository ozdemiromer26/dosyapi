# Güvenlik

Bu belge sistemin neye karşı nasıl korunduğunu, nasıl sınandığını ve **neyi kapsamadığını** anlatır.

## Açık bildirimi

Güvenlik açıklarını herkese açık kanaldan yazmayın; depo sahibine özel olarak bildirin.

## Tehdit modeli ve önlemler

| Risk | Önlem |
| --- | --- |
| SQL enjeksiyonu | Tüm sorgular parametre bağlamalı. Kullanıcı girdisi SQL metnine eklenmez. |
| XSS | Şablon HTML'i sunucuda izin listesiyle temizlenir (ammonia), DOM'a yazılmadan önce DOMPurify, ek olarak katı CSP (`script-src 'self'`). React metni kaçışlar. |
| CSRF | SameSite=Strict çerez, oturuma bağlı CSRF belirteci, `Origin` ve `Sec-Fetch-Site` denetimi. |
| Yetki aşımı | Her servis yöntemi başında sunucu tarafı denetim; politika `core/policy.rs` içinde saf fonksiyonlardır. İstemcideki gizleme güvenlik sınırı değildir. |
| IDOR | Kimlikler UUID; görev ve notlarda sahiplik denetimi, başkasının kaydı için 404. |
| Toplu atama | Girdi türleri `deny_unknown_fields`: şema dışı alan isteği reddeder. |
| Parola sızıntısı | Argon2id (64 MiB, 3 tur), en az 12 karakter ve zxcvbn denetimi. Belirteçler veritabanında yalnızca anahtarlı özet olarak durur. |
| Kaba kuvvet | IP bazlı sınır ve kademeli hesap kilidi: art arda 3 hatalı şifrede 5 dk, 6'da 15 dk, 9'da 60 dk, 12'de süresiz kilit; kilitliyken denemeler sayılmaz, doğru şifre de girmez. Süresiz kilidi yalnızca Sistem Paneli açar (şifre sıfırlama açmaz). Sistem Paneli kullanıcıya süreli ya da süresiz yasak da verebilir; yasak açık oturumları hemen kapatır. Master girişi 5 hatalı denemede geçici kilitlenir (1 dakikadan başlayıp 1 saate kadar artar); kilitliyken doğru şifre de girmez. Kilit ekranı yalnızca açılma zamanını, deneme sayısını ve son denemenin IP adresini gösterir. Kilit sunucu konsolundan `dosyapi-ctl master-enable` ile hemen kaldırılır; panel `master-disable` ile tamamen kapatılabilir, kapalıyken açık panel oturumları da düşer. `X-Forwarded-For` yalnızca açıkça güvenilen vekilden okunur. |
| Kullanıcı numaralandırma | Giriş, kayıt ve şifre sıfırlama hesap varlığını ele vermez; olmayan hesapta da parola özeti hesaplanır. |
| Veri sızıntısı | TC, telefon, adres ve bekleyen talepler AES-256-GCM ile alan düzeyinde şifreli; dosyalar diskte şifreli ve rastgele adlı. Bağlam (AAD) sayesinde şifreli değer başka satıra taşınamaz. Salt okuma rolleri kişisel veriyi maskeli alır. |
| Zararlı dosya | Uzantı izin listesi ve içerik imzası denetimi; indirme her zaman ek olarak ve ikili türle sunulur. SVG kabul edilmez. Proje fotoğrafı yalnızca PNG/JPEG/WEBP olabilir, türü içerikten belirlenir; tarayıcıda yeniden kodlandığı için EXIF ve konum bilgisi sunucuya gitmez. |
| Kişisel proje notu | Not yalnızca yazan kullanıcıya döner; anahtar her zaman oturumdaki kullanıcıdır, istemciden kullanıcı kimliği alınmaz. Gövde AES-256-GCM ile şifrelenir; şifreleme bağlamı kullanıcı ve projeyi içerdiği için satır başka bir kullanıcıya taşınırsa çözülemez. Proje ya da kullanıcı silinince notlar da silinir. |
| İki adımlı doğrulama | TOTP (RFC 6238); gizli anahtar şifreli saklanır. Kabul edilen zaman adımı kaydedilir ve yalnızca ileri gider: aynı kod ikinci kez geçmez (eşzamanlı iki girişte de yalnızca biri). 10 tek kullanımlık kurtarma kodu verilir; yalnızca kullanıcıya bağlı SHA-256 özetleri tutulur, kullanılan kod tek sorguda silinir. Açıkken yeniden kurulum ve kodların yenilenmesi şifre ister. Deneme sayısı oran sınırlıdır. |
| Mesajlaşma | Birebir konuşmayı yalnızca iki tarafı görür; üye olmayana konuşma "yok" (404) döner. Gövde AES-256-GCM ile, mesaj ve konuşma kimliğine bağlı bağlamla şifrelenir; yöneticiler ve sistem paneli içeriği okuyamaz. Gönderen her zaman oturumdaki kullanıcıdır. Mesaj 4000 karakterle, gönderim dakikada 30 ile sınırlı; arayüz içeriği düz metin olarak basar. |
| Yol geçişi | Disk yolu yalnızca sunucunun ürettiği kimlikten oluşur; kullanıcı dosya adı diske yazılmaz. |
| Host zehirlenmesi | Host başlığı doğrulanır; bağlantılar yapılandırılmış adresten üretilir. |
| Güncelleme saldırısı | Ed25519 imzalı bildirim, SHA-256 bağlı paket, sürüm geri alma engeli, kanal bağlama. Uygulama süreci kendi ikilisine yazamaz; root güncelleyici imzayı kendisi doğrular ve paketi root'a ait klasöre kopyaladıktan sonra özetler. |
| Onay ezmesi | Talep yalnızca değişen alanları taşır; onay bekleyen kayıt kilitlidir, kayıt yine de değiştiyse onay reddedilir. |
| İz silme | Denetim günlüğü anahtarlı hash zinciridir; veritabanı tetikleyicileri değişikliği engeller, doğrudan müdahale panelden tespit edilir. |
| Canlı güncelleme | `/api/v1/events` (Server-Sent Events) yalnızca oturum açmış kullanıcıya açılır ve hiçbir kayıt taşımaz: yalnızca "değişti" sinyali gönderir; istemci veriyi `/bootstrap` ile kendi yetkisiyle yeniden çeker. Oturum 30 sn'de bir yeniden denetlenir, geçersizse akış kapanır; bu denetim oturumu tazelemez. Kullanıcı başına 8, toplam 1000 akış sınırı vardır. Sinyal yalnızca başarılı değiştirici isteklerden sonra gider; reddedilen istekler ve oturum işlemleri sinyal üretmez. |
| Yedek kurcalama | Tam yedek (veritabanı + dosyalar) tek dosyadır; `secret.key`'den HKDF ile türetilen, her yedeğe ayrı tuzlu anahtarla 1 MiB'lik parçalar hâlinde AES-256-GCM ile şifrelenir. Parça sırası ve son-parça işareti nonce'a, başlığın tamamı her parçaya ek veri (AAD) olarak bağlıdır: tek bayt değişikliği, parçaların yer değiştirmesi, kesilme, sona veri eklenmesi ya da başka anahtarla üretilmiş yedek doğrulamada yakalanır. Yani `secret.key` olmadan geçerli yedek üretilemez. Geri yükleme önce tamamını doğrular, veritabanı bütünlüğünü (`integrity_check`) ve her kayıtlı dosyanın yedekte olduğunu denetler; ancak sonra mevcut veriyle yer değiştirir, mevcut veriyi silmez. Yedekteki kayıt adları izin listesindedir (yol geçişi olmaz). Anahtar dosyası panelden yalnızca master şifre yeniden girilerek indirilir; indirme, doğrulama ve silme denetim günlüğüne yazılır. |
| Sunucu sızması | systemd sertleştirmesi; süreç ayrıcalıksız, yalnızca veri klasörüne yazabilir. |

### Prototipten bilinçli sapmalar

| Prototip | Üretim | Neden |
| --- | --- | --- |
| Demo hesaplar, `1234` şifresi | Yok | Varsayılan parola, ele geçirmenin en kolay yoludur. |
| Varsayılan kullanıcı şifresi | Tek kullanımlık davet bağlantısı | Sabit şifre tüm hesapları aynı anda riske atar. |
| En az 4 karakter | En az 12 karakter, zxcvbn | |
| SVG logo | PNG/JPEG/WEBP | SVG betik taşıyabilir. |
| Yüklenen dosya her role açık | Onaydaki dosya yalnızca yükleyene ve onaylayana açık | |
| Herkes TC numarasını görür | Yazma yetkisi yoksa maskeli; erişim denetim günlüğüne yazılır | KVKK veri minimizasyonu ve izlenebilirlik. |
| "Kullanıcı yönetimi" yetkisi proje onaylayabilir | Yalnızca o varlıkta doğrudan düzenleme yetkisi olan onaylar | Görevler ayrılığı. |
| Onay tüm kaydı yazar | Yalnızca talep edilen alanlar yazılır | Sonraki değişiklikler ezilmez. |

## Sınama

```bash
make test       # birim testleri
make pentest    # 440 saldırı senaryosu (--timing ile 450)
python3 security/update_test.py --help   # güncelleme saldırıları
make audit      # cargo audit + npm audit
```

Ek olarak sqlmap ile kimliği doğrulanmış uç noktalar tarandı. Sonuçlar için [docs/SIZMA-TESTI.md](docs/SIZMA-TESTI.md).

## Kapsam dışı ve sizin sorumluluğunuzda olanlar

- **Hesap kilidi kötüye kullanılabilir.** E-posta adresini bilen biri 12 hatalı deneme yaparak bir hesabı süresiz kilitleyebilir
  (bilinçli tercih: kaba kuvvete karşı kesin durdurma). Açık oturumlar etkilenmez; kilidi Sistem Paneli → Kullanıcılar'dan
  kaldırın. IP bazlı sınır aynı adresten yapılabilecek deneme sayısını ayrıca kısıtlar.

- **Bağımsız denetim yapılmadı.** Bu testler yazılımı yazan tarafın testleridir; canlı öncesi bağımsız sızma testi önerilir.
- **`secret.key` kaybı geri döndürülemez.** Yedekler bu anahtar olmadan açılamaz. Anahtarı yedeklerden ayrı, güvenli bir yerde
  saklayın: ikisini birlikte ele geçiren veriyi açar. Sistem Paneli anahtarı master şifreyle indirmeye izin verir; ele geçmiş
  bir panel oturumu zaten tüm veriye erişebildiği için bu ek bir yetki vermez, ama indirme denetim günlüğünde izlenmelidir.
- **HTTPS zorunludur.** Düz HTTP'de çerezler `Secure` olmaz. `--url https://...` kullanın.
- **Sistem Paneli internete açıktır.** Master şifreye ek olarak iki adımlı doğrulamayı açın; mümkünse `/api/v1/master` yolunu ters vekilde IP ile sınırlandırın.
- **Dosyalarda virüs taraması yoktur.** Yüklenen dosyalar çalıştırılmaz ama kullanıcıların indirdiği içerik taranmaz.
- **Disk tam şifrelemesi yoktur.** Şirket adı, proje adı, notlar gibi kişisel olmayan alanlar veritabanında düz metindir; sunucu diskini de şifreleyin.
- **KVKK uyumu yalnızca teknik önlemlerden ibaret değildir.** Sistem Paneli'nden girilen aydınlatma metni kayıtta onaylatılır; metnin içeriği, saklama süresi ve VERBİS kaydı şirketin yükümlülüğüdür.
