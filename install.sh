#!/usr/bin/env bash
# dosyapı kurulum betiği. Debian/Ubuntu/RHEL tabanlı, systemd kullanan Linux sunucular içindir.
#
#   sudo ./install.sh --url https://dosya.sirket.com             # ters vekil arkasında
#   sudo ./install.sh --url https://dosya.sirket.com --tls       # yerleşik HTTPS (80 ve 443 portları)
#
# Depoda derlenmiş `dist/dosyapi-<mimari>` varsa onu kullanır; yoksa kaynaktan derler.
set -euo pipefail

PUBLIC_URL=""
BUILTIN_TLS=0
LISTEN="127.0.0.1:8080"
PREFIX=/opt/dosyapi
CONF=/etc/dosyapi
DATA=/var/lib/dosyapi

usage() { sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --url) PUBLIC_URL="${2:-}"; shift 2 ;;
    --listen) LISTEN="${2:-}"; shift 2 ;;
    --tls) BUILTIN_TLS=1; shift ;;
    -h|--help) usage ;;
    *) echo "Bilinmeyen seçenek: $1" >&2; usage 1 ;;
  esac
done

[ "$(id -u)" -eq 0 ] || { echo "Bu betik root olarak çalıştırılmalı (sudo)." >&2; exit 1; }
[ "$(uname -s)" = "Linux" ] || { echo "Yalnızca Linux desteklenir." >&2; exit 1; }
command -v systemctl >/dev/null || { echo "systemd gerekli." >&2; exit 1; }
case "$PUBLIC_URL" in
  http://*|https://*) ;;
  *) echo "--url zorunlu (ör. https://dosya.sirket.com)." >&2; exit 1 ;;
esac
if [ -e "$CONF/config.toml" ]; then
  echo "Mevcut kurulum bulundu ($CONF/config.toml). Güncelleme için Sistem Paneli'ni kullanın." >&2
  exit 1
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCH="$(uname -m)"
PREBUILT="$HERE/dist/dosyapi-$ARCH"

if [ ! -f "$PREBUILT" ]; then
  if ! command -v cargo >/dev/null || ! command -v npm >/dev/null; then
    echo "Derlenmiş paket yok ve kaynaktan derlemek için Rust ile Node.js gerekli." >&2
    echo "Rust: https://rustup.rs  Node.js: https://nodejs.org" >&2
    exit 1
  fi
  echo "==> Kaynaktan derleniyor (birkaç dakika sürebilir)"
  (cd "$HERE" && make build)
  mkdir -p "$HERE/dist"
  cp "$HERE/target/release/dosyapi" "$PREBUILT"
fi

echo "==> Kullanıcı ve klasörler hazırlanıyor"
id dosyapi >/dev/null 2>&1 || useradd --system --home-dir "$DATA" --shell /usr/sbin/nologin dosyapi
install -d -m 0755 -o root -g root "$PREFIX" "$PREFIX/bin"
install -d -m 0750 -o root -g dosyapi "$CONF"
install -d -m 0750 -o dosyapi -g dosyapi "$DATA"
install -m 0755 -o root -g root "$PREBUILT" "$PREFIX/bin/dosyapi"

if [ "$BUILTIN_TLS" -eq 1 ]; then LISTEN="0.0.0.0:80"; fi

echo "==> Yapılandırma ve gizli anahtar oluşturuluyor"
INIT_OUTPUT="$("$PREFIX/bin/dosyapi" --config "$CONF/config.toml" init \
  --data-dir "$DATA" --secret-key "$CONF/secret.key" --public-url "$PUBLIC_URL" --listen "$LISTEN")"
sed -i 's/^installer = .*/installer = "systemd"/' "$CONF/config.toml"
if [ "$BUILTIN_TLS" -eq 1 ]; then
  sed -i '/^\[paths\]/i https_listen = "0.0.0.0:443"\n' "$CONF/config.toml"
fi
chown root:dosyapi "$CONF/config.toml"; chmod 0640 "$CONF/config.toml"
chown dosyapi:dosyapi "$CONF/secret.key"; chmod 0600 "$CONF/secret.key"
chown -R dosyapi:dosyapi "$DATA"
# Güncelleme durum klasörü root'a aittir: uygulama yalnızca okuyabilir.
install -d -m 0750 -o root -g dosyapi "$DATA/update-status"
install -d -m 0750 -o dosyapi -g dosyapi "$DATA/update"

echo "==> Servisler kuruluyor"
install -m 0644 "$HERE/deploy/systemd/dosyapi.service" /etc/systemd/system/dosyapi.service
install -m 0644 "$HERE/deploy/systemd/dosyapi-updater.service" /etc/systemd/system/dosyapi-updater.service
install -m 0644 "$HERE/deploy/systemd/dosyapi-updater.path" /etc/systemd/system/dosyapi-updater.path
if [ "$BUILTIN_TLS" -eq 1 ]; then
  mkdir -p /etc/systemd/system/dosyapi.service.d
  printf '[Service]\nAmbientCapabilities=CAP_NET_BIND_SERVICE\nCapabilityBoundingSet=CAP_NET_BIND_SERVICE\n' \
    > /etc/systemd/system/dosyapi.service.d/tls.conf
fi
systemctl daemon-reload
systemctl enable --now dosyapi.service dosyapi-updater.path

echo
echo "$INIT_OUTPUT" | grep -E 'Kurulum belirteci' || true
cat <<NOTE

dosyapı kuruldu ve çalışıyor.
  Adres          : $PUBLIC_URL
  Gizli anahtar  : $CONF/secret.key  (mutlaka ayrıca yedekleyin; kaybolursa veriler açılamaz)
  Veri           : $DATA

Sıradaki adım: Tarayıcıdan adrese gidin ve yukarıdaki belirteçle kurulumu tamamlayın.
Kurulum yapılana kadar sunucuyu güvenilmeyen ağa açmayın; HTTPS yoksa SSH tüneli kullanın.
NOTE
