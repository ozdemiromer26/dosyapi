#!/usr/bin/env python3
"""Sürüm bildirimi üretir. İmzalamak için: dosyapi release-sign --key <anahtar> --manifest manifest.json

    scripts/make-manifest.py --version 1.2.0 --channel stable --min-version 1.0.0 \
        --base-url https://guncelleme.ornek.com/paket --notes notlar.txt \
        dist/dosyapi-1.2.0-linux-x86_64 dist/dosyapi-1.2.0-linux-aarch64
"""
import argparse
import datetime
import hashlib
import json
import os
import re

parser = argparse.ArgumentParser()
parser.add_argument("--version", required=True)
parser.add_argument("--channel", default="stable", choices=["stable", "beta", "dev"])
parser.add_argument("--min-version", default="0.0.0")
parser.add_argument("--base-url", required=True)
parser.add_argument("--notes", default="")
parser.add_argument("--out", default="manifest.json")
parser.add_argument("files", nargs="+")
args = parser.parse_args()

artifacts = []
for path in args.files:
    match = re.search(r"-(linux|macos)-(x86_64|aarch64)$", os.path.basename(path))
    if not match:
        raise SystemExit(f"Dosya adı -<os>-<mimari> ile bitmeli: {path}")
    with open(path, "rb") as fh:
        data = fh.read()
    artifacts.append({
        "os": match.group(1), "arch": match.group(2),
        "url": f"{args.base_url.rstrip('/')}/{os.path.basename(path)}",
        "sha256": hashlib.sha256(data).hexdigest(), "size": len(data),
    })

notes = ""
if args.notes:
    with open(args.notes, encoding="utf-8") as fh:
        notes = fh.read().strip()
manifest = {
    "product": "dosyapi", "channel": args.channel, "version": args.version, "releasedAt": datetime.date.today().isoformat(),
    "notes": notes, "minVersion": args.min_version, "artifacts": artifacts,
}
with open(args.out, "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, ensure_ascii=False, indent=2)
print(args.out)
