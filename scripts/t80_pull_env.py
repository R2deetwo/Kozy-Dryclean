#!/usr/bin/env python3
"""t80_pull_env.py — pull DIRECT_URL + PAYSTACK keys from Vercel prod env (current token).
Writes work/t80-env.env; never prints values."""
import json
import os
import urllib.request

TOKEN = "REDACTED_SECRET"
BASE = "https://api.vercel.com"

# discover the project id from .vercel/project.json
pid = None
team = None
try:
    with open(".vercel/project.json") as f:
        pj = json.load(f)
    pid = pj.get("projectId")
    team = pj.get("orgId") or pj.get("teamId")
except Exception as e:
    print("no .vercel/project.json:", e)

if not pid:
    # fall back: list projects
    req = urllib.request.Request(f"{BASE}/v9/projects?limit=20", headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req) as r:
        data = json.loads(r.read().decode())
    for p in data.get("projects", []):
        if "kozy" in (p.get("name") or "").lower():
            pid = p["id"]
            print("found project:", p["name"], pid)
            break

qs = f"?teamId={team}" if team else ""
req = urllib.request.Request(
    f"{BASE}/v9/projects/{pid}/env{qs}",
    headers={"Authorization": f"Bearer {TOKEN}"},
)
with urllib.request.urlopen(req) as r:
    data = json.loads(r.read().decode())

WANT = ["DIRECT_URL", "DATABASE_URL", "PAYSTACK_SECRET_KEY", "PAYSTACK_PUBLIC_KEY", "NEXTAUTH_URL"]
found = {}
for env in data.get("envs", []):
    key = env.get("key")
    if key not in WANT:
        continue
    vr = urllib.request.Request(
        f"{BASE}/v1/projects/{pid}/env/{env['id']}{qs}",
        headers={"Authorization": f"Bearer {TOKEN}"},
    )
    with urllib.request.urlopen(vr) as r2:
        detail = json.loads(r2.read().decode())
    val = detail.get("value") or ""
    found[key] = val
    print(f"FOUND  {key}  (targets: {','.join(env.get('target') or [])}, len={len(val)})")

os.makedirs("work", exist_ok=True)
with open("work/t80-env.env", "w") as f:
    for k, v in found.items():
        f.write(f'{k}="{v}"\n')

for k in WANT:
    if k not in found:
        print(f"MISSING {k}")
