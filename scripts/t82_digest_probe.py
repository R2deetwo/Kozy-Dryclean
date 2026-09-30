#!/usr/bin/env python3
"""Task 82 — probe the current Vercel /v2/files digest format with one tiny
file, so the deploy recipe can be fixed (the old sha1-hex entry now 400s
with 'File digest missing')."""
import base64, hashlib, json, os, urllib.request, urllib.error

TOK = open("/home/z/my-project/.env").read().split("VERCEL_TOKEN=")[1].splitlines()[0].strip()
TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"
BASE = "https://api.vercel.com"

data = b"t82 digest probe\n"
b64 = base64.b64encode(data).decode()
sha1_hex = hashlib.sha1(data).hexdigest()
sha256_hex = hashlib.sha256(data).hexdigest()
sha1_b64 = base64.b64encode(hashlib.sha1(data).digest()).decode()
sha256_b64 = base64.b64encode(hashlib.sha256(data).digest()).decode()

variants = [
    ("sha1-hex", {"file": "src/t82-probe.txt", "data": b64, "encoding": "base64", "digest": sha1_hex}),
    ("sha1-prefixed-hex", {"file": "src/t82-probe.txt", "data": b64, "encoding": "base64", "digest": f"sha1-{sha1_hex}"}),
    ("sha1-prefixed-b64", {"file": "src/t82-probe.txt", "data": b64, "encoding": "base64", "digest": f"sha1-{sha1_b64}"}),
    ("sha256-prefixed-hex", {"file": "src/t82-probe.txt", "data": b64, "encoding": "base64", "digest": f"sha256-{sha256_hex}"}),
    ("sha256-prefixed-b64", {"file": "src/t82-probe.txt", "data": b64, "encoding": "base64", "digest": f"sha256-{sha256_b64}"}),
    ("no-digest", {"file": "src/t82-probe.txt", "data": b64, "encoding": "base64"}),
    ("sha-field", {"file": "src/t82-probe.txt", "data": b64, "encoding": "base64", "sha": sha1_hex}),
]

for name, entry in variants:
    req = urllib.request.Request(
        f"{BASE}/v2/files?teamId={TEAM}",
        data=json.dumps([entry]).encode(),
        headers={"Authorization": f"Bearer {TOK}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read().decode()
            print(f"{name:22s} -> HTTP {r.status}: {body[:200]}")
    except urllib.error.HTTPError as e:
        print(f"{name:22s} -> HTTP {e.code}: {e.read().decode()[:200]}")
