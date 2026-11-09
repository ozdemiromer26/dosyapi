.PHONY: build web server test pentest audit

build: web server

web:
	cd web && npm ci && npm run build

server:
	cargo build --release --locked -p dosyapi

test:
	cargo test --workspace --locked
	cargo clippy --workspace --all-targets --locked -- -D warnings
	cd web && npx tsc --noEmit

pentest:
	cargo build -p dosyapi --locked
	python3 security/pentest.py --bin target/debug/dosyapi

audit:
	cargo audit
	cd web && npm audit --omit=dev
