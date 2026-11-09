# Çok aşamalı derleme: son imaj yalnızca ikili dosyayı içerir.
FROM node:24-bookworm-slim AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM rust:1-bookworm AS server
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
COPY --from=web /src/web/dist web/dist
ARG DOSYAPI_RELEASE_PUBKEYS=""
ARG DOSYAPI_UPDATE_URL=""
ENV DOSYAPI_RELEASE_PUBKEYS=$DOSYAPI_RELEASE_PUBKEYS DOSYAPI_UPDATE_URL=$DOSYAPI_UPDATE_URL
RUN cargo build --release --locked -p dosyapi

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN useradd --system --uid 10001 --home-dir /data --shell /usr/sbin/nologin dosyapi
COPY --from=server /src/target/release/dosyapi /usr/local/bin/dosyapi
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
USER 10001:10001
VOLUME /data
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
