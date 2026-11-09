# Alan adı ve DNS

Sistem Paneli → **Alan adı & DNS** bölümünden yönetilir.

1. Alan adını (`dosya.sirket.com`) ve sunucunun genel IP adresini girin, kaydedin.
2. **DNS'i doğrula** düğmesi gerekli kayıtları gerçek DNS ile karşılaştırır. Her kayıt *Doğru*, *Eksik* ya da *Farklı değer* olarak görünür.
3. Kayıtları alan adı sağlayıcınıza elle girin ya da Cloudflare kullanıyorsanız API belirteci ekleyip **Kayıtları sağlayıcıya yaz** düğmesine basın.

| Kayıt | Amaç | Zorunlu |
| --- | --- | --- |
| A / AAAA | Alan adını sunucuya yönlendirir | Evet |
| CAA | Sertifikayı yalnızca Let's Encrypt verebilir (otomatik HTTPS açıksa) | Hayır |
| TXT (SPF) | E-postaların sahte gönderilmesini zorlaştırır (SMTP ayarlıysa) | Hayır |
| TXT (DMARC) | Sahte e-postaların işlenme kuralı (SMTP ayarlıysa) | Hayır |

Doğrulama, sunucunun yerel önbelleğinden bağımsız sonuç için Cloudflare'in şifreli DNS (DoH) hizmetini kullanır. Bu istekte
yalnızca şirketin alan adı gönderilir.

Cloudflare API belirteci yalnızca ilgili bölge için **DNS: Edit** yetkisine sahip olmalıdır. Belirteç şifreli saklanır ve bir
daha gösterilmez.

## Yeni sağlayıcı eklemek

`dosyapi_core::ports::DnsProvider` arayüzünü uygulayıp `crates/dosyapi/src/app.rs` içindeki `providers` listesine ekleyin.
Çekirdek kod değişmez.
