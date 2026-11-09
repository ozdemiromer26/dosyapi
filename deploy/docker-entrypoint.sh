#!/bin/sh
# İlk açılışta yapılandırma ve gizli anahtar oluşturur; belirteci günlüğe yazar.
set -eu
CONFIG=/data/config.toml
if [ ! -f "$CONFIG" ]; then
  dosyapi --config "$CONFIG" init --data-dir /data/app --secret-key /data/secret.key \
    --public-url "${DOSYAPI_PUBLIC_URL:?DOSYAPI_PUBLIC_URL gerekli}" --listen 0.0.0.0:8080
fi
exec dosyapi --config "$CONFIG" serve
