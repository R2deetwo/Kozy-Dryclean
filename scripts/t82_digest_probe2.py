#!/usr/bin/env python3
"""Task 82 — probe #2: the raw-body + x-now-digest header form of
POST /v2/files (the JSON batch array form now 400s)."""
import hashlib, json, urllib.request, urllib.error

TOK = open("/home/z/my-project/.env").read().split("VERCEL_TOKEN=")[1].splitlines()[0].strip()
TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"
BASE = "https://api.vercel.com"

data = b"t82 digest probe v2\n"
sha1_hex = hashlib.sha1(data).hexdigest()

attempts = [
    ("octet + x-now-digest", {
        "headers": {
            "Authorization": f"Bearer {TOK}",
            "Content-Type": "application/octet-stream",
            "x-now-digest": sha1_hex,
        },
        "body": data,
    }),
    ("octet + x-vercel-digest sha1-", {
        "headers": {
            "Authorization": f"Bearer {TOK}",
            "Content-Type": "application/octet-stream",
            "x-vercel-digest": f"sha1-{sha1_hex}",
        },
        "body": data,
    }),
]

for name, spec in attempts:
    req = urllib.request.Request(
        f"{BASE}/v2/files?teamId={TEAM}",
        data=spec["body"],
        headers=spec["headers"],
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            print(f"{name:32s} -> HTTP {r.status}: {r.read().decode()[:200]}")
    except urllib.error.HTTPError as e:
        print(f"{name:32s} -> HTTP {e.code}: {e.read().decode()[:200]}")
