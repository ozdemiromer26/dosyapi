"""Sürüm yükseltme (göç) testi: önceki sürümün verisi yeni sürümde eksiksiz açılıyor mu?

Kullanım:
    git worktree add /tmp/eski v0.1.0 && (cd /tmp/eski/web && npm ci && npm run build) && (cd /tmp/eski && cargo build -p dosyapi)
    python3 security/goc_testi.py /tmp/eski/target/debug/dosyapi target/debug/dosyapi

Eski ikiliyle kurulum, örnek veri, onay bekleyen talep ve konsol yedeği oluşturulur; aynı veri
klasörü yeni ikiliyle açılır. Göçlerin uygulandığı, verinin (şifreli alanlar dahil) korunduğu,
eski talebin onaylanabildiği ve eski yedeğin doğrulanıp geri yüklenebildiği denetlenir.
"""
import glob
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pentest as P  # noqa: E402

OLD, NEW = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
ok = []


def check(name, cond, info=""):
    ok.append(bool(cond))
    print(("  ok  " if cond else " FAIL ") + name + ("" if cond else f"  -> {info}"))


lab = P.Lab(OLD)
try:
    creds = P.setup(lab)
    ctx = P.seed(lab, creds)
    admin, site, pm, master = ctx["admin"], ctx["site"], ctx["pm"], ctx["master"]
    pid = ctx["project"]
    # Eski sürümde onay bekleyen bir proje düzenlemesi bırak.
    roles = {r["level"]: r for r in admin.refresh()["roles"]}
    r = site.put(f"/projects/{pid}", P.project_body(note="eski sürüm talebi"))
    check("v0.1.0: onaylı düzenleme kuyruğa düştü", r.status == 200 and r.json()["result"] == "queued", r.text)
    before = admin.refresh()
    lab.halt()
    out = lab.cli("backup")
    check("v0.1.0: konsol yedeği alındı", out.returncode == 0, out.stderr + out.stdout)
    backup = sorted(glob.glob(os.path.join(lab.dir, "data", "backups", "*.dsyb")))[-1]

    # Aynı veri klasörünü yeni sürümle aç.
    lab.binary = NEW
    lab.start()
    db = sqlite3.connect(os.path.join(lab.dir, "data", "dosyapi.sqlite"))
    versions = [r[0] for r in db.execute("SELECT version FROM _sqlx_migrations ORDER BY version")]
    db.close()
    check("göçler uygulandı", versions == list(range(1, len(versions) + 1)) and len(versions) >= 2, versions)
    admin = lab.client().login("admin@sirket.test", creds["admin"])
    after = admin.refresh()
    p_old = next(p for p in before["projects"] if p["id"] == pid)
    p_new = next(p for p in after["projects"] if p["id"] == pid)
    same = all(p_new[k] == p_old[k] for k in ("name", "contractorId", "ada", "parsel", "mahalle", "street", "status", "owners", "proxy"))
    check("proje verisi (şifreli arsa sahipleri dahil) korundu", same, (p_old, p_new))
    check("eski projede YİBF ve firma boş", p_new["yibf"] == "" and p_new["inspectionId"] == "" and p_new["inspection"] == "", p_new)
    check("müellifler korundu", [a["tc"] for a in after["authors"]] == [a["tc"] for a in before["authors"]])
    c = after["contractors"][0]
    check("eski müteahhitte yetkili TC boş", c["ownerTc"] == "" and c["title"] == before["contractors"][0]["title"], c)
    check("yapı denetim listesi boş", after["inspections"] == [], after.get("inspections"))
    pm = lab.client().login("pm@sirket.test", creds["pm"])
    queued = next((p for p in pm.refresh()["pendings"] if p["entity"] == "project"), None)
    check("eski sürümün onay talebi okunuyor", queued is not None, pm.refresh()["pendings"])
    if queued:
        r = pm.post(f"/approvals/{queued['id']}/approve", {})
        note = next(p for p in admin.refresh()["projects"] if p["id"] == pid)["note"]
        check("eski sürümün talebi onaylanıp uygulanıyor", r.status == 204 and note == "eski sürüm talebi", (r.status, note))
    r = admin.post("/inspections", {"name": "Göç Denetim", "phone": "", "inspectors": [{"name": "A B", "tc": "56789012345"}]})
    fid = r.json().get("id")
    r = admin.put(f"/projects/{pid}", P.project_body(note="eski sürüm talebi", yibf="7654321", inspectionId=fid))
    p_new = next(p for p in admin.refresh()["projects"] if p["id"] == pid)
    check("göç sonrası YİBF ve firma yazılabiliyor", r.status == 200 and p_new["yibf"] == "7654321" and p_new["inspection"] == "Göç Denetim", (r.text, p_new))

    # v0.1.0 yedeği yeni sürümle doğrulanıp geri yükleniyor (eski yedek kabul edilmeli).
    lab.halt()
    out = lab.cli("verify", backup)
    check("v0.1.0 yedeği yeni sürümle doğrulanıyor", out.returncode == 0, out.stdout + out.stderr)
    out = lab.cli("restore", backup, "--yes")
    check("v0.1.0 yedeği yeni sürüme geri yükleniyor", out.returncode == 0, out.stdout + out.stderr)
    lab.start()
    admin = lab.client().login("admin@sirket.test", creds["admin"])
    restored = admin.refresh()
    p_r = next(p for p in restored["projects"] if p["id"] == pid)
    check("geri yüklenen eski veri yeni şemayla açılıyor", p_r["note"] == p_old["note"] and p_r["yibf"] == "" and restored["inspections"] == [], p_r)
    log = open(os.path.join(lab.dir, "server.log")).read()
    check("günlükte panik yok", "panicked" not in log, log[-300:])
finally:
    lab.stop()
print(f"\n{sum(ok)}/{len(ok)} göç kontrolü geçti")
sys.exit(0 if all(ok) else 1)
