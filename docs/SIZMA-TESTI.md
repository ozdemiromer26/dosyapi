# Sızma testi raporu

Tarih: 2026-11-09. Hedef: yerel test örneği (`127.0.0.1`), sürüm 0.1.0. Testleri yazılımı geliştiren taraf yaptı; bu rapor
bağımsız denetimin yerini tutmaz.

## Sonuçlar

| Sınama | Araç | Sonuç |
| --- | --- | --- |
| Saldırı senaryoları | `security/pentest.py` | 298/298 geçti (hata ayıklama derlemesi) |
| Sürüm derlemesi, gerçek Argon2id | `pentest.py --timing` | 307/307 geçti |
| Kullanıcı numaralandırma süresi | `pentest.py --timing` | Olmayan hesap 72 ms, var olan hesap 72 ms |
| Güncelleme saldırıları | `security/update_test.py` | 18/18 geçti |
| SQL enjeksiyonu taraması | sqlmap 1.10 (seviye 3, risk 2) | İki turda toplam 8 farklı uç noktada enjeksiyon bulunmadı |
| Bilinen açıklar | `cargo audit`, `npm audit` | 0 açık (bir istisna aşağıda) |
| Statik denetim | clippy `-D warnings`, TypeScript, shellcheck | Temiz |
| Birim testleri | `cargo test` | 44/44 geçti |
| Temiz kopyadan derleme | `make build` | Geçti |

sqlmap kimliği doğrulanmış oturumla proje, müellif, not, profil uç noktalarını ve URL yolunu taradı. Uygulamaya binlerce yük
ulaştı (yalnızca işlenenler: 2.178 proje güncellemesi, 1.375 müellif, 329 not, 206 profil güncellemesi). Tablolar sağlam kaldı,
`PRAGMA integrity_check` temiz, sunucu günlüğünde hata yok.

Onay ve müteahhit değişikliklerinden sonra tarama güncel kodda yinelendi: proje, müteahhit, müellif güncellemesi, aydınlatma
metni ve URL yolu. İşlenen yük sayısı 1.128 proje, 969 müellif, 443 müteahhit, 230 aydınlatma güncellemesidir. Sonuç aynı.

`cargo audit` istisnası: `RUSTSEC-2023-0071` (`rsa`). Paket yalnızca kullanılmayan sqlx-mysql sürücüsü yüzünden `Cargo.lock`
içinde görünür, derlenmez. `cargo tree -i rsa` boş döner.

## Kapsanan saldırılar

| Alan | Senaryolar |
| --- | --- |
| Kurulum | Belirteçsiz kurulum, zayıf şifre, ikinci kez kurulum ile ele geçirme |
| Erişim | 18 uç noktada oturumsuz erişim, uydurma çerez, kullanıcı ve master oturumunun birbirine geçmesi |
| Yetki | Dikey ve yatay yetki aşımı, IDOR, kendi talebini onaylama, kademe atlama, kişisel veri maskeleme |
| Onay akışı | Bekleyen kayıtta ikinci değişiklik, onay sırasında ezme, alan dışı değişiklik, kullanılan müteahhidi silme, projeyle görev silinmesi |
| KVKK | Aydınlatma onayı olmadan kayıt, onay zamanının saklanması, yetkisiz metin değişimi |
| Proje ayrıntısı | Toplamı 1/1 olmayan ya da kesir olmayan hisse; fotoğraf olarak SVG, HTML, çalıştırılabilir ve büyük dosya; onaylı ve salt okuma rolüyle fotoğraf değişimi; CSRF; diskte düz fotoğraf; proje silinince fotoğrafın kalması; kişisel notu başka kullanıcının okuması, bootstrap'a sızması, CSRF'siz ya da oturumsuz erişim, aşırı uzun ve denetim karakterli not, diskte düz not, proje silinince notun kalması |
| Görev ve iki adımlı doğrulama | Başkasının ya da atananın görevi düzenlemesi, düzenlemede üst kademeye atama, takvimde olmayan tarih (2030-13-45), bilinmeyen alan, CSRF; iki adımlı doğrulamayı yanlış kodla açma, açıkken kodsuz giriş, yanlış şifreyle ya da CSRF'siz kapatma, kapattıktan sonra normal giriş; aynı TOTP kodunu ikinci kez kullanma (kullanıcı ve master), kurulum kodunu girişte tekrar kullanma, kurtarma kodunun ikinci kullanımı, başka hesabın kurtarma kodu, yenilemeden sonra eski kod, açıkken şifresiz yeniden kurulum, diskte düz kurtarma kodu. 2FA senaryoları IP giriş sınırını paylaşmamak için ayrı bir test sunucusunda koşar. |
| Mesajlaşma | Üçüncü kişinin konuşmayı okuması (IDOR), listesine ya da bootstrap'ına sızma, oturumsuz okuma, CSRF'siz gönderim, kendine ve olmayan kişiye gönderim, SQL enjeksiyonlu alıcı kimliği, boş/aşırı uzun/denetim karakterli mesaj, gönderen alanını taklit, geçersiz sayfa parametresi, diskte düz mesaj, toplu gönderim (oran sınırı) |
| Toplu atama | Rol, durum ve kimlik alanlarını isteğe ekleme |
| CSRF | Belirteçsiz istek, başka oturumun belirteci, yabancı köken, giriş CSRF'si, CORS |
| Enjeksiyon | SQL yükleri, kalıcı XSS, CSS enjeksiyonu, e-posta başlık enjeksiyonu, denetim karakterleri, derin JSON, büyük gövde |
| Dosya | Sahte uzantı, çift uzantı, SVG, HTML, boş dosya, yol geçişi, başlık enjeksiyonu, diskte düz veri araması |
| Oturum | Sabitleme, çıkış sonrası yeniden kullanım, şifre değişiminde oturum kapatma, belirteç tekrarı |
| Kaba kuvvet | Hesap kilidi, master kilidi, `X-Forwarded-For` ile sınır aşma |
| Denetim günlüğü | Değiştirme, silme, doğrudan veritabanı müdahalesinin tespiti |
| Güncelleme | Kurcalanmış bildirim, yabancı anahtar, sürüm geri alma, bozuk paket, sahte iş emri, yol geçişi, sembolik bağlantı, geri dönüş |

## Bulunan ve kapatılan sorunlar

| # | Önem | Sorun | Nasıl bulundu | Çözüm |
| --- | --- | --- | --- | --- |
| 1 | Yüksek | Güncelleyicide denetim ile kurulum arasında uygulama süreci paketi değiştirebiliyordu (TOCTOU, root yetkisine yükselme) | Kod incelemesi | Paket root'a ait klasöre kopyalanıp o kopya üzerinden özetlenir |
| 2 | Yüksek | Root, uygulamanın yazabildiği klasöre durum dosyası yazıyordu; sembolik bağlantıyla başka dosya ezilebilirdi | Kod incelemesi | Durum klasörü root'a ait; paket `O_NOFOLLOW` ile açılır |
| 3 | Orta | İstek zaman aşımı katmanı tanımlı ama bağlı değildi | Kod incelemesi | Yönlendiriciye bağlandı |
| 4 | Orta | Hızlı parola özeti bayrağı sürüm derlemesinde de açılabiliyordu | Kod incelemesi | Yalnızca hata ayıklama derlemesinde var |
| 5 | Orta | E-posta değişimi şifre istemiyordu; ele geçen oturum hesabı devralabilirdi | Kod incelemesi | Mevcut şifre zorunlu |
| 6 | Orta | Bilinen açıklı bağımlılıklar: `hickory-proto`, `time`, `ctutils`, `lodash.merge` | cargo audit, npm audit | Güncellendi; DNS kütüphanesi ve `html-docx-js` tamamen kaldırıldı |
| 7 | Düşük | Yanlış türde oturum çerezi denemesi geçerli oturumu siliyordu | pentest.py | Yalnızca süresi dolan oturum silinir |
| 8 | Düşük | Proje yetkisi olmayan rollere onay geçmişi gidiyordu | Kod incelemesi | Filtrelendi |
| 9 | Düşük | Bağlantısı kopan yüklemeler geçici dosya bırakıyordu | Kod incelemesi | Açılışta temizlenir |
| 10 | Düşük | HTTPS'ten HTTP'ye yönlendirme izleniyordu | Kod incelemesi | `https_only` |
| 11 | İşlev | Aynı saniyedeki iki yedek çakışıyordu | update_test.py | Ad benzersizleştirildi |
| 12 | İşlev | Geri dönüş durumu "başarısız" olarak yazılıyordu | update_test.py | Durumlar ayrıldı |
| 13 | İşlev | Geri dönen eski sürüm, yeni göçleri görünce açılamazdı | Kod incelemesi | Eksik göç yok sayılır; göçler eklemeli olmalı |
| 14 | Orta | Onay, talep açıldıktan sonra yapılan değişiklikleri tüm kaydı yazarak eziyordu | Tasarım incelemesi | Talep yalnızca değişen alanları taşır; kayıt talep açılınca kilitlenir, parmak izi tutmazsa onay reddedilir |
| 15 | Orta | Kişisel verilere erişim günlüğe yazılmıyordu | Tasarım incelemesi | Kişisel veri içeren açılış `pii.access` olarak en çok saatte bir denetim günlüğüne yazılır |
| 16 | Düşük | Müteahhit projeye metinle bağlıydı; adı değişen kayıt kopuyordu | Tasarım incelemesi | Yabancı anahtar, `ON DELETE RESTRICT` |
| 17 | Düşük | Silinen projenin görevleri sahipsiz kalıyordu | Tasarım incelemesi | `ON DELETE CASCADE` |
| 18 | Düşük | Arayüz yolları her HTTP yöntemine 200 dönüyordu | Yük testi | Yalnızca GET ve HEAD; diğerleri 405 |
| 19 | Düşük | Tarih doğrulayıcı yalnızca biçime bakıyordu; 2030-13-45 gibi takvimde olmayan günler görev tarihi olarak kaydedilebiliyordu | pentest.py | Ay ve gün (artık yıl dahil) denetleniyor; birim testi eklendi |
| 20 | Orta | Geçerli TOTP kodu ~90 sn içinde tekrar kullanılabiliyordu; oturumu ele geçiren biri iki adımlı doğrulamayı şifresiz yeniden kurarak kapatabiliyordu (kullanıcı ve master) | Kod incelemesi | Zaman adımı kaydediliyor ve yalnızca ileri gidiyor; açıkken yeniden kurulum reddediliyor |
| 21 | Düşük | Büyük gövde testi bağlantı erken kapandığında testi çökertiyordu | pentest.py | Kopan bağlantı da ret sayılıyor |

## Sınanamayanlar

Bu ortamda (macOS, Docker yok, genel alan adı yok) çalıştırılamadı. Üretimden önce gerçek ortamda deneyin:

- `install.sh` ve systemd birimleri Linux'ta hiç çalıştırılmadı; yalnızca shellcheck geçti.
- Docker kurulumu (`deploy/kur.sh`, `dosyapi-ctl`, `compose.yml`, `Dockerfile.release`) hiç çalıştırılmadı: geliştirme makinesinde Docker yok. Betikler shellcheck ve `bash -n`, compose dosyası YAML ayrıştırmasından geçti. İlk yayından önce gerçek bir sunucuda baştan sona denenmeli.
- Docker imajı derlenmedi.
- Let's Encrypt sertifika alımı denenmedi; genel alan adı gerekir.
- Cloudflare API yazımı denenmedi; DNS doğrulama gerçek DNS ile denendi.
- SMTP ile gerçek e-posta gönderimi denenmedi.
- Word çıktısı Microsoft Word ve LibreOffice ile açılmadı; python-docx ve macOS `textutil` ile okundu. PDF üretimi tarayıcıda çalıştı, sonuç pypdf ve macOS ile doğrulandı.
- GitHub Actions iş akışları çalıştırılmadı.
