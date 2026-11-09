#!/bin/sh
# İlk açılışta yapılandırma ve gizli anahtar oluşturur; belirteci günlüğe yazar.
# DOSYAPI_TRUST_PROXY=1: konteyner yalnızca iç ağdaki ters vekile (Caddy) açıksa verilir;
# o zaman istemci IP'si X-Forwarded-For başlığından okunur.
set -eu
CONFIG=/data/config.toml
if [ ! -f "$CONFIG" ]; then
  dosyapi --config "$CONFIG" init --data-dir /data/app --secret-key /data/secret.key \
    --public-url "${DOSYAPI_PUBLIC_URL:?DOSYAPI_PUBLIC_URL gerekli}" --listen 0.0.0.0:8080
fi
# Ortam değişkeni her açılışta yapılandırmaya yansıtılır (açma ve kapama).
if [ "${DOSYAPI_TRUST_PROXY:-0}" = "1" ]; then
  sed -i 's/^trust_proxy = .*/trust_proxy = true/' "$CONFIG"
else
  sed -i 's/^trust_proxy = .*/trust_proxy = false/' "$CONFIG"
fi
exec dosyapi --config "$CONFIG" serve
