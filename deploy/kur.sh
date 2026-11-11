#!/usr/bin/env bash
# dosyapı tek komutla kurulum (Docker + otomatik HTTPS).
#
#   curl -fsSL https://raw.githubusercontent.com/ozdemiromer26/dosyapi/main/deploy/kur.sh | sudo bash -s -- --domain dosya.sirket.com
#
# Seçenekler:
#   --domain <ad>      Sunucunun alan adı (DNS A kaydı bu sunucuyu göstermeli). Verilmezse sorulur.
#   --version <x.y.z>  Belirli bir sürüm (varsayılan: en yeni).
#   --from-source      Hazır imajı indirmek yerine sunucuda kaynak koddan derler. Hazır imaj
#                      bulunamazsa betik bunu kendisi önerir. (~10-30 dk; bellek azsa geçici takas açılır)
#   --auto-update      Her gece yedek alıp en yeni sürüme geçer.
#   --yes              Soru sormadan devam eder (Docker kurulumu ve kaynaktan derleme dahil).
set -euo pipefail

# Yayınlandığı GitHub deposu (küçük harf). Çatal (fork) için DOSYAPI_REPO ile değiştirilebilir.
REPO="${DOSYAPI_REPO:-ozdemiromer26/dosyapi}"
IMAGE="${DOSYAPI_IMAGE:-ghcr.io/${REPO}}"
DIR=/opt/dosyapi
APP_UID=10001

# Betik borudan (curl | bash) çalıştığında dosyası olmadığı için yardım burada tutulur.
usage() {
  cat <<'HELP'
dosyapı kurulumu — kullanım:
  curl -fsSL https://raw.githubusercontent.com/ozdemiromer26/dosyapi/main/deploy/kur.sh | sudo bash -s -- --domain dosya.sirket.com

  --domain <ad>      Sunucunun alan adı (DNS A kaydı bu sunucuyu göstermeli). Verilmezse sorulur.
  --version <x.y.z>  Belirli bir sürüm (varsayılan: en yeni).
  --from-source      Hazır imaj yerine sunucuda kaynak koddan derler (hazır imaj yoksa betik önerir).
  --auto-update      Her gece yedek alıp en yeni sürüme geçer.
  --yes              Soru sormadan devam eder.
HELP
}

DOMAIN="" VERSION="" AUTO_UPDATE=0 YES=0 SOURCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --version) VERSION="${2:-}"; shift 2 ;;
    --from-source) SOURCE=1; shift ;;
    --auto-update) AUTO_UPDATE=1; shift ;;
    --yes) YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Bilinmeyen seçenek: $1 (yardım: --help)" >&2; exit 1 ;;
  esac
done

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
info() { echo "› $*"; }
die() { echo "Hata: $*" >&2; exit 1; }
ask() { local reply; read -r -p "$1 " reply < /dev/tty; echo "$reply"; }
confirm() {
  [ "$YES" = 1 ] && return 0
  case "$(ask "$1 (evet/hayır)" | tr '[:upper:]' '[:lower:]')" in evet|e|yes|y) return 0 ;; *) return 1 ;; esac
}
dc() { docker compose --project-directory "$DIR" -f "$DIR/compose.yml" "$@"; }

say "dosyapı kurulumu"

# 1) Ön koşullar
[ "$(id -u)" -eq 0 ] || die "root yetkisi gerekli. Komutu 'sudo' ile çalıştırın."
[ "$(uname -s)" = "Linux" ] || die "Yalnızca Linux sunucular desteklenir."
case "$(uname -m)" in
  x86_64|amd64|aarch64|arm64) ;;
  *) die "Desteklenmeyen işlemci mimarisi: $(uname -m)" ;;
esac
command -v curl >/dev/null || die "curl gerekli (ör. apt install curl)."
if [ -n "$VERSION" ] && ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  die "Geçersiz sürüm: $VERSION"
fi

# Önceki kurulum: çalışıyorsa dokunulmaz; yarım kalmış ya da kaldırılmışsa veriler korunarak yeniden kurulur.
REINSTALL=0
if [ -e "$DIR/.env" ] || [ -e "$DIR/compose.yml" ]; then
  if command -v docker >/dev/null && [ -f "$DIR/compose.yml" ] \
     && [ -n "$(dc ps -q --status running dosyapi 2>/dev/null || true)" ]; then
    die "dosyapı bu sunucuda zaten çalışıyor. Güncellemek için: sudo dosyapi-ctl update"
  fi
  REINSTALL=1
  if [ -f "$DIR/data/config.toml" ]; then
    info "Önceki kurulumun verileri bulundu ($DIR/data); aynı verilerle yeniden kurulacak."
  else
    info "Yarım kalmış bir kurulum bulundu; kaldığı yerden devam ediliyor."
  fi
fi

# 2) Alan adı
if [ -z "$DOMAIN" ]; then
  [ "$YES" = 1 ] && die "--domain gerekli."
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
#    Docker'ın kendi port yönlendiricisi (docker-proxy) sayılmaz.
if command -v ss >/dev/null && ss -ltnpH '( sport = :80 or sport = :443 )' 2>/dev/null | grep -v docker-proxy | grep -q .; then
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

# 5) İmaj: hazır imaj indirilebiliyor mu? Değilse kaynaktan derlemeyi öner.
REF="main"; [ -n "$VERSION" ] && REF="v$VERSION"
IMAGE_REF="$IMAGE:${VERSION:-latest}"
if [ "$SOURCE" = 0 ]; then
  info "Hazır imaj indiriliyor: $IMAGE_REF"
  if ! docker pull -q "$IMAGE_REF" >/dev/null 2>&1; then
    echo
    echo "Hazır imaj indirilemedi ($IMAGE_REF): henüz yayınlanmamış ya da erişime kapalı olabilir."
    echo "Bunun yerine sunucuda kaynak koddan derlenebilir (10-30 dakika; bellek azsa geçici takas açılır)."
    confirm "Kaynak koddan derlensin mi?" || die "Vazgeçildi. Yayın imajı hazır olunca yeniden deneyin."
    SOURCE=1
  fi
fi

# 6) Dosyalar
say "Dosyalar hazırlanıyor ($DIR)"
RAW="${DOSYAPI_RAW:-https://raw.githubusercontent.com/$REPO/$REF/deploy/docker}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
install -d -m 0755 "$DIR"

if [ "$SOURCE" = 1 ]; then
  # Kaynak kod paketi indirilir; kurulum dosyaları da aynı sürümden alınır.
  command -v tar >/dev/null || die "tar gerekli."
  rm -rf "$DIR/kaynak"; install -d -m 0755 "$DIR/kaynak"
  info "Kaynak kod indiriliyor ($REPO @ $REF)"
  curl -fsSL "https://codeload.github.com/$REPO/tar.gz/$REF" | tar -xz -C "$DIR/kaynak" --strip-components=1
  HERE="$DIR/kaynak/deploy"
fi

fetch() {
  # Depodan (ya da indirilen kaynaktan) çalışılıyorsa yerel dosya, değilse depodaki kopya kullanılır.
  if [ -n "$HERE" ] && [ -f "$HERE/docker/$1" ]; then
    install -m "$3" "$HERE/docker/$1" "$2"
  else
    curl -fsSL "$RAW/$1" -o "$2.indiriliyor" && install -m "$3" "$2.indiriliyor" "$2" && rm -f "$2.indiriliyor"
  fi
}
fetch compose.yml "$DIR/compose.yml" 0644
fetch Caddyfile "$DIR/Caddyfile" 0644
fetch dosyapi-ctl /usr/local/bin/dosyapi-ctl 0755

if [ "$SOURCE" = 1 ]; then
  say "Kaynak koddan derleniyor (tek çekirdekli sunucuda 20-30 dakika sürebilir)"
  IMAGE="dosyapi-yerel"
  IMAGE_REF="$(DOSYAPI_DIR="$DIR" DOSYAPI_FRESH=0 /usr/local/bin/dosyapi-ctl build "$REF" "$REPO")"
fi

install -d -m 0700 -o "$APP_UID" -g "$APP_UID" "$DIR/data"
install -d -m 0700 "$DIR/yedekler"
umask 077
cat > "$DIR/.env" <<ENV
DOSYAPI_DOMAIN=$DOMAIN
DOSYAPI_REPO=$REPO
DOSYAPI_IMAGE=$IMAGE
DOSYAPI_IMAGE_REF=$IMAGE_REF
DOSYAPI_SOURCE=$SOURCE
DOSYAPI_SOURCE_REF=$REF
ENV
umask 022

# Güvenlik duvarı açıksa web portlarını aç.
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null && ufw allow 443/udp >/dev/null
  info "ufw: 80 ve 443 açıldı"
fi

# 7) Başlat
say "Başlatılıyor"
dc pull caddy
dc up -d

ok=0
for _ in $(seq 1 90); do
  if dc exec -T caddy wget -q -T 3 -O /dev/null http://dosyapi:8080/healthz >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
[ "$ok" = 1 ] || die "Uygulama açılmadı. Günlükler: sudo dosyapi-ctl logs"

TOKEN="$(dc logs --no-log-prefix dosyapi 2>/dev/null | sed -n 's/.*Kurulum belirteci: *//p' | tail -n1)"

if [ "$AUTO_UPDATE" = 1 ]; then
  /usr/local/bin/dosyapi-ctl auto-update on
fi

say "Kurulum tamamlandı"
if [ -n "$TOKEN" ]; then
  TOKEN_LINE="$TOKEN"
elif [ "$REINSTALL" = 1 ]; then
  TOKEN_LINE="(önceki veriler kullanıldı; ilk kurulum daha önce bitmediyse: sudo dosyapi-ctl token)"
else
  TOKEN_LINE="(alınamadı; 'sudo dosyapi-ctl token' ile yenisini üretin)"
fi
cat <<DONE
  Adres              : https://$DOMAIN
  Kurulum belirteci  : $TOKEN_LINE

  Tarayıcıdan adresi açın, belirteci girin; şirket adı, master şifre ve ilk yönetici
  hesabını oluşturun. Belirteç bir kez kullanılır. HTTPS sertifikası ilk istekte alınır;
  sayfa ilk açılışta birkaç saniye bekletebilir.

  Veriler            : $DIR/data   (gizli anahtar dahil; yedekleri sunucu dışında saklayın)
  Yönetim            : sudo dosyapi-ctl help
    sudo dosyapi-ctl status       sudo dosyapi-ctl backup
    sudo dosyapi-ctl update       sudo dosyapi-ctl logs -f
DONE
