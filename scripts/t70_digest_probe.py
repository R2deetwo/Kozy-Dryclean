#!/usr/bin/env python3
"""Probe the /v2/files API digest format with a tiny file."""
import base64, hashlib, json, urllib.request, urllib.error

TOK = "REDACTED_INVALID_PASTED_TOKEN"
TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"

content = b"probe digest format v1\n"
b64 = base64.b64encode(content).decode()

candidates = [
    ("sha1-content", hashlib.sha1(content).hexdigest()),
    ("sha1-b64", hashlib.sha1(b64.encode()).hexdigest()),
    ("sha512-content", hashlib.sha512(content).hexdigest()),
    ("sha256-content", hashlib.sha256(content).hexdigest()),
    ("sha1-prefixed", "sha1-" + hashlib.sha1(content).hexdigest()),
]

for name, digest in candidates:
    body = [{"file": "src/__probe.txt", "data": b64, "encoding": "base64", "digest": digest}]
    req = urllib.request.Request(
        f"https://api.vercel.com/v2/files?teamId={TEAM}",
        data=json.dumps(body).encode(),
        method="POST",
        headers={"Authorization": f"Bearer {TOK}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"{name}: {r.status} {r.read().decode()[:200]}")
    except urllib.error.HTTPError as e:
        print(f"{name}: {e.code} {e.read().decode()[:200]}")
