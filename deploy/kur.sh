#!/usr/bin/env bash
# dosyapı tek komutla kurulum (Docker + otomatik HTTPS).
#
#   curl -fsSL https://raw.githubusercontent.com/ozdemiromer26/dosyapi/main/deploy/kur.sh | sudo bash -s -- --alan-adi dosya.sirket.com
#
# Seçenekler:
#   --alan-adi <ad>        Sunucunun alan adı (DNS A/AAAA kaydı bu sunucuyu göstermeli). Verilmezse sorulur.
#   --surum <x.y.z>        Belirli bir sürüm (varsayılan: en yeni).
#   --otomatik-guncelleme  Her gece yedek alıp en yeni sürüme geçer.
#   --evet                 Soru sormadan devam eder (Docker kurulumu dahil).
set -euo pipefail

# Yayınlandığı GitHub deposu (küçük harf). Çatal (fork) için DOSYAPI_REPO ile değiştirilebilir.
REPO="${DOSYAPI_REPO:-ozdemiromer26/dosyapi}"
IMAGE="${DOSYAPI_IMAGE:-ghcr.io/${REPO}}"
DIR=/opt/dosyapi
APP_UID=10001

DOMAIN="" VERSION="" AUTO_UPDATE=0 YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --alan-adi) DOMAIN="${2:-}"; shift 2 ;;
    --surum) VERSION="${2:-}"; shift 2 ;;
    --otomatik-guncelleme) AUTO_UPDATE=1; shift ;;
    --evet) YES=1; shift ;;
    -h|--help) sed -n '2,12p' "$0" 2>/dev/null || true; exit 0 ;;
    *) echo "Bilinmeyen seçenek: $1" >&2; exit 1 ;;
  esac
done

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
info() { echo "› $*"; }
die() { echo "Hata: $*" >&2; exit 1; }
ask() { local reply; read -r -p "$1 " reply < /dev/tty; echo "$reply"; }
confirm() { [ "$YES" = 1 ] && return 0; [ "$(ask "$1 (evet/hayır)")" = "evet" ]; }

say "dosyapı kurulumu"

# 1) Ön koşullar
[ "$(id -u)" -eq 0 ] || die "root yetkisi gerekli. Komutu 'sudo' ile çalıştırın."
[ "$(uname -s)" = "Linux" ] || die "Yalnızca Linux sunucular desteklenir."
case "$(uname -m)" in
  x86_64|amd64|aarch64|arm64) ;;
  *) die "Desteklenmeyen işlemci mimarisi: $(uname -m)" ;;
esac
command -v curl >/dev/null || die "curl gerekli (ör. apt install curl)."
[ -e "$DIR/.env" ] && die "Bu sunucuda zaten kurulum var. Güncellemek için: sudo dosyapi-ctl guncelle"
if [ -n "$VERSION" ] && ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  die "Geçersiz sürüm: $VERSION"
fi

# 2) Alan adı
if [ -z "$DOMAIN" ]; then
  [ "$YES" = 1 ] && die "--alan-adi gerekli."
  DOMAIN="$(ask "Alan adı (ör. dosya.sirket.com):")"
fi
DOMAIN="$(printf '%s' "$DOMAIN" | tr '[:upper:]' '[:lower:]')"
[[ "$DOMAIN" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]] || die "Geçersiz alan adı: $DOMAIN"

# DNS bu sunucuyu gösteriyor mu? (HTTPS sertifikası için gerekli; yalnızca uyarı.)
PUBLIC_IP="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
RESOLVED="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || true)"
if [ -n "$PUBLIC_IP" ] && [ "$RESOLVED" != "$PUBLIC_IP" ]; then
  echo "Uyarı: $DOMAIN şu an ${RESOLVED:-hiçbir adrese} çözümleniyor, bu sunucu ise $PUBLIC_IP."
  echo "       DNS'te $DOMAIN için A kaydını $PUBLIC_IP yapın; HTTPS sertifikası ancak o zaman alınır."
  confirm "Yine de devam edilsin mi?" || die "Vazgeçildi."
fi

# 3) 80 ve 443 portları boş olmalı (Caddy sertifika ve trafik için kullanır).
if command -v ss >/dev/null && ss -ltnH '( sport = :80 or sport = :443 )' | grep -q .; then
  die "80 ya da 443 portunu başka bir program kullanıyor (ör. nginx/apache). Önce onu durdurun."
fi

# 4) Docker
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  say "Docker kurulu değil"
  echo "Docker'ın resmi kurulum betiği (get.docker.com) çalıştırılacak."
  confirm "Docker kurulsun mu?" || die "Docker olmadan kurulum yapılamaz."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
docker compose version >/dev/null 2>&1 || die "Docker Compose eklentisi bulunamadı."

# 5) Dosyalar
say "Dosyalar hazırlanıyor ($DIR)"
REF="main"; [ -n "$VERSION" ] && REF="v$VERSION"
RAW="${DOSYAPI_RAW:-https://raw.githubusercontent.com/$REPO/$REF/deploy/docker}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
install -d -m 0755 "$DIR"
fetch() {
  # Depodan çalıştırılıyorsa yerel dosya, değilse yayın deposundaki kopya kullanılır.
  if [ -n "$HERE" ] && [ -f "$HERE/docker/$1" ]; then
    install -m "$3" "$HERE/docker/$1" "$2"
  else
    curl -fsSL "$RAW/$1" -o "$2.indiriliyor" && install -m "$3" "$2.indiriliyor" "$2" && rm -f "$2.indiriliyor"
  fi
}
fetch compose.yml "$DIR/compose.yml" 0644
fetch Caddyfile "$DIR/Caddyfile" 0644
fetch dosyapi-ctl /usr/local/bin/dosyapi-ctl 0755

install -d -m 0700 -o "$APP_UID" -g "$APP_UID" "$DIR/data"
install -d -m 0700 "$DIR/yedekler"
umask 077
cat > "$DIR/.env" <<ENV
DOSYAPI_DOMAIN=$DOMAIN
DOSYAPI_IMAGE=$IMAGE
DOSYAPI_IMAGE_REF=$IMAGE:${VERSION:-latest}
ENV
umask 022

# Güvenlik duvarı açıksa web portlarını aç.
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null && ufw allow 443/udp >/dev/null
  info "ufw: 80 ve 443 açıldı"
fi

# 6) Başlat
say "Başlatılıyor"
docker compose --project-directory "$DIR" -f "$DIR/compose.yml" pull
docker compose --project-directory "$DIR" -f "$DIR/compose.yml" up -d

ok=0
for _ in $(seq 1 90); do
  if docker compose --project-directory "$DIR" -f "$DIR/compose.yml" exec -T caddy \
       wget -q -T 3 -O /dev/null http://dosyapi:8080/healthz >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
[ "$ok" = 1 ] || die "Uygulama açılmadı. Günlükler: sudo dosyapi-ctl gunluk"

TOKEN="$(docker compose --project-directory "$DIR" -f "$DIR/compose.yml" logs --no-log-prefix dosyapi 2>/dev/null \
  | sed -n 's/.*Kurulum belirteci: *//p' | tail -n1)"

if [ "$AUTO_UPDATE" = 1 ]; then
  /usr/local/bin/dosyapi-ctl otomatik-guncelleme ac
fi

say "Kurulum tamamlandı"
cat <<DONE
  Adres              : https://$DOMAIN
  Kurulum belirteci  : ${TOKEN:-(alınamadı; 'sudo dosyapi-ctl belirtec' ile yenisini üretin)}

  Tarayıcıdan adresi açın, belirteci girin; şirket adı, master şifre ve ilk yönetici
  hesabını oluşturun. Belirteç bir kez kullanılır.

  Veriler            : $DIR/data   (gizli anahtar dahil; yedekleri sunucu dışında saklayın)
  Yönetim            : sudo dosyapi-ctl yardim
    sudo dosyapi-ctl durum        sudo dosyapi-ctl yedekle
    sudo dosyapi-ctl guncelle     sudo dosyapi-ctl gunluk -f
DONE
