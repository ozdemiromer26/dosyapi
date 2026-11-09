#!/usr/bin/env python3
"""Güncelleme sisteminin uçtan uca sınaması: imza, geri alma ve kurcalama saldırıları.

    python3 security/update_test.py --keygen          # test anahtarı üretir, açık anahtarı yazar
    DOSYAPI_RELEASE_PUBKEYS=<açık> cargo build -p dosyapi
    python3 security/update_test.py --bin target/debug/dosyapi --key <gizli>

Yalnızca 127.0.0.1 üzerinde çalışır; `systemctl` çağrısı sahte betikle değiştirilir.
"""
import argparse, hashlib, http.server, json, os, platform, re, secrets, shutil, stat, subprocess, sys, tempfile, threading, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from client import Client  # noqa: E402

PORT, FILES = 18101, 18102
OS = {"Darwin": "macos", "Linux": "linux"}[platform.system()]
ARCH = {"arm64": "aarch64", "aarch64": "aarch64", "x86_64": "x86_64"}[platform.machine()]
RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append(bool(ok))
    print(("  ok  " if ok else " FAIL ") + name + ("" if ok else f"  -> {str(detail)[:240]}"))


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def manifest(root, binary, key, version, channel="stable", signer=None, minimum="0.0.0"):
    os.makedirs(os.path.join(root, channel), exist_ok=True)
    name = f"dosyapi-{version}-{OS}-{ARCH}"
    with open(binary, "rb") as fh:
        data = fh.read()
    shutil.copy(binary, os.path.join(root, name))
    body = {"product": "dosyapi", "channel": channel, "version": version, "releasedAt": "2026-11-06", "notes": "Test", "minVersion": minimum,
            "artifacts": [{"os": OS, "arch": ARCH, "url": f"http://127.0.0.1:{FILES}/{name}", "sha256": hashlib.sha256(data).hexdigest(), "size": len(data)}]}
    path = os.path.join(root, channel, "manifest.json")
    with open(path, "w") as fh:
        json.dump(body, fh)
    subprocess.run([signer, "release-sign", "--key", key, "--manifest", path], check=True, capture_output=True)
    return path


def updater(binary, config, target, env, timeout=3, health=None):
    return subprocess.run([binary, "--config", config, "updater-apply", "--binary", target, "--service", "sahte",
                           "--health-url", health or f"http://127.0.0.1:{PORT}/healthz", "--health-timeout", str(timeout)],
                          env=env, capture_output=True, text=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--bin", default="target/debug/dosyapi")
    p.add_argument("--key", default="")
    p.add_argument("--keygen", default="")
    a = p.parse_args()
    binary = os.path.abspath(a.bin)
    work = tempfile.mkdtemp(prefix="dosyapi-update-")
    data, conf, www = os.path.join(work, "data"), os.path.join(work, "config.toml"), os.path.join(work, "www")
    os.makedirs(www)
    out = subprocess.run([binary, "--config", conf, "init", "--data-dir", data, "--secret-key", os.path.join(work, "secret.key"),
                          "--public-url", f"http://127.0.0.1:{PORT}", "--listen", f"127.0.0.1:{PORT}"], capture_output=True, text=True, check=True).stdout
    token = re.search(r"Kurulum belirteci: (\S+)", out).group(1)
    text = open(conf).read()
    text = text.replace('base_url = ""', f'base_url = "http://127.0.0.1:{FILES}"').replace('installer = "none"', 'installer = "systemd"').replace("allow_insecure_localhost = false", "allow_insecure_localhost = true")
    open(conf, "w").write(text)
    handler = lambda *x, **k: Quiet(*x, directory=www, **k)
    files = http.server.ThreadingHTTPServer(("127.0.0.1", FILES), handler)
    threading.Thread(target=files.serve_forever, daemon=True).start()
    env = dict(os.environ, DOSYAPI_INSECURE_FAST_HASH="1", RUST_LOG="error")
    log = open(os.path.join(work, "server.log"), "w")
    server = subprocess.Popen([binary, "--config", conf, "serve"], env=env, stdout=log, stderr=log)
    try:
        for _ in range(100):
            try:
                if Client(port=PORT).request("GET", "/healthz").status == 200:
                    break
            except OSError:
                time.sleep(0.1)
        master_pw = "Tst-" + secrets.token_urlsafe(18)
        r = Client(port=PORT).post("/setup", {"setupToken": token, "companyName": "Test", "masterPassword": master_pw, "adminName": "Y", "adminEmail": "a@b.test", "adminPassword": "Tst-" + secrets.token_urlsafe(18)})
        assert r.status == 204, r.text
        m = Client(port=PORT).master_login(master_pw)

        r = m.post("/master/update/check")
        check("bildirim yokken hata güvenli döner", r.status == 503, r.status)

        path = manifest(www, binary, a.key, "0.2.0", signer=binary)
        info = m.post("/master/update/check").json()
        check("imzalı bildirim kabul edilir, yeni sürüm görünür", info.get("available") is True and info.get("latest") == "0.2.0", info)

        original = open(path).read()
        open(path, "w").write(original.replace("0.2.0", "9.9.9"))
        r = m.post("/master/update/check")
        check("kurcalanmış bildirim reddedilir", r.status == 503 and "imza" in r.text.lower(), (r.status, r.text))
        open(path, "w").write(original)

        other = os.path.join(work, "baska.key")
        subprocess.run([binary, "release-keygen", "--out", other], check=True, capture_output=True)
        subprocess.run([binary, "release-sign", "--key", other, "--manifest", path], check=True, capture_output=True)
        r = m.post("/master/update/check")
        check("yabancı anahtarla imza reddedilir", r.status == 503, (r.status, r.text))
        path = manifest(www, binary, a.key, "0.0.1", signer=binary)
        info = m.post("/master/update/check").json()
        check("eski sürüme dönüş teklif edilmez", info.get("available") is False, info)
        path = manifest(www, binary, a.key, "0.2.0", signer=binary, minimum="0.1.5")
        info = m.post("/master/update/check").json()
        check("ara sürüm gerektiren güncelleme engellenir", info.get("available") and info.get("blockedReason"), info)
        path = manifest(www, binary, a.key, "0.2.0", signer=binary)

        check("yanlış master şifreyle kurulmaz", m.post("/master/update/apply", {"password": "yanlis"}).status == 400)
        name = f"dosyapi-0.2.0-{OS}-{ARCH}"
        pristine = open(os.path.join(www, name), "rb").read()
        open(os.path.join(www, name), "ab").write(b"KOTU")
        r = m.post("/master/update/apply", {"password": master_pw})
        check("özeti tutmayan paket indirilse de reddedilir", r.status == 503, (r.status, r.text))
        open(os.path.join(www, name), "wb").write(pristine)

        r = m.post("/master/update/apply", {"password": master_pw})
        check("doğrulanan paket sıraya alınır", r.status == 200, (r.status, r.text))
        state = os.path.join(data, "update")
        request = json.load(open(os.path.join(state, "request.json")))
        staged = os.path.join(state, request["file"])

        fake = os.path.join(work, "fakebin")
        os.makedirs(fake)
        # İlk yeniden başlatmada sağlık ucu yok (yeni sürüm açılmıyor), ikincisinde var (eski sürüm açıldı).
        mark, health = os.path.join(work, "mark"), os.path.join(www, "healthz")
        with open(os.path.join(fake, "systemctl"), "w") as fh:
            fh.write(f'#!/bin/sh\nif [ -f "{mark}" ]; then touch "{health}"; fi\ntouch "{mark}"\nexit 0\n')
        os.chmod(os.path.join(fake, "systemctl"), 0o755)
        renv = dict(os.environ, PATH=fake + os.pathsep + os.environ["PATH"], RUST_LOG="error")
        target = os.path.join(work, "kurulu-ikili")
        with open(target, "wb") as fh:
            fh.write(b"ESKI-SURUM")

        saved_req = open(os.path.join(state, "request.json")).read()
        bad = os.path.join(state, "kotu.bin")
        open(bad, "wb").write(b"#!/bin/sh\nid\n")
        evil = dict(request, file="kotu.bin")
        json.dump(evil, open(os.path.join(state, "request.json"), "w"))
        res = updater(binary, conf, target, renv)
        check("ele geçirilmiş uygulama sahte paket kurduramaz", res.returncode != 0 and open(target, "rb").read() == b"ESKI-SURUM", res.stderr)

        open(os.path.join(state, "request.json"), "w").write(json.dumps(dict(request, file="../../../../etc/passwd")))
        res = updater(binary, conf, target, renv)
        check("yol geçişli iş emri reddedilir", res.returncode != 0 and open(target, "rb").read() == b"ESKI-SURUM", res.stderr)

        link = os.path.join(state, "baglanti.bin")
        os.symlink("/etc/passwd", link)
        open(os.path.join(state, "request.json"), "w").write(json.dumps(dict(request, file="baglanti.bin")))
        res = updater(binary, conf, target, renv)
        check("sembolik bağlantı izlenmez", res.returncode != 0 and open(target, "rb").read() == b"ESKI-SURUM", res.stderr)

        forged = json.load(open(os.path.join(state, "manifest.json")))
        forged["version"] = "9.0.0"
        raw_manifest = open(os.path.join(state, "manifest.json")).read()
        json.dump(forged, open(os.path.join(state, "manifest.json"), "w"))
        open(os.path.join(state, "request.json"), "w").write(saved_req)
        res = updater(binary, conf, target, renv)
        check("diskte değiştirilen bildirim root tarafında yakalanır", res.returncode != 0 and open(target, "rb").read() == b"ESKI-SURUM", res.stderr)
        open(os.path.join(state, "manifest.json"), "w").write(raw_manifest)

        open(os.path.join(state, "request.json"), "w").write(saved_req)
        res = updater(binary, conf, target, renv, timeout=3, health=f"http://127.0.0.1:{FILES}/healthz")
        restored = os.path.exists(target) and open(target, "rb").read() == b"ESKI-SURUM"
        status = json.load(open(os.path.join(data, "update-status", "status.json")))
        check("açılmayan sürümde otomatik geri dönüş", res.returncode != 0 and restored and status["state"] == "rolled_back", (res.stderr, status))

        open(os.path.join(state, "request.json"), "w").write(saved_req)
        res = updater(binary, conf, target, renv)
        same = hashlib.sha256(open(target, "rb").read()).hexdigest() == hashlib.sha256(pristine).hexdigest()
        status = json.load(open(os.path.join(data, "update-status", "status.json")))
        check("doğru paket kurulur ve durum bildirilir", res.returncode == 0 and same and status["state"] == "done", (res.stderr, status))
        check("kurulan dosya çalıştırılabilir", bool(os.stat(target).st_mode & stat.S_IXUSR))
        check("eski sürüm geri dönüş için saklanır", open(target + ".prev" if os.path.exists(target + ".prev") else target.replace("kurulu-ikili", "kurulu-ikili.prev"), "rb").read() == b"ESKI-SURUM")
        check("panel durumu okuyabilir", m.get("/master/update/status").json().get("state") == "done")
    finally:
        server.terminate(); server.wait(timeout=10); files.shutdown(); log.close()
        shutil.rmtree(work, ignore_errors=True)
    print(f"\n{sum(RESULTS)}/{len(RESULTS)} test geçti")
    sys.exit(0 if all(RESULTS) else 1)


if __name__ == "__main__":
    main()
