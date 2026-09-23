#!/usr/bin/env python3
"""Pull production env vars from Vercel (for the p55 QA run + prod test rig).
Writes work/p55-env.env (BREVO_*, DIRECT_URL, DATABASE_URL, NEXTAUTH_*) and
prints which keys were found — values are never printed."""
import json
import os
import urllib.request

TOKEN = "REDACTED_OLD_VERCEL_TOKEN"
TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"
PROJECT = "prj_BUv0ZqDMzsONFBQXXCgBJfmIN43e"
BASE = "https://api.vercel.com"

WANT = [
    "BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME",
    "DIRECT_URL", "DATABASE_URL", "NEXTAUTH_URL", "NEXTAUTH_SECRET",
    "TERMII_API_KEY",
]

req = urllib.request.Request(
    f"{BASE}/v9/projects/{PROJECT}/env?teamId={TEAM}",
    headers={"Authorization": f"Bearer {TOKEN}"},
)
with urllib.request.urlopen(req) as r:
    data = json.loads(r.read().decode())

found = {}
for env in data.get("envs", []):
    key = env.get("key")
    if key not in WANT:
        continue
    # decrypt each value via its own endpoint
    vr = urllib.request.Request(
        f"{BASE}/v1/projects/{PROJECT}/env/{env['id']}?teamId={TEAM}",
        headers={"Authorization": f"Bearer {TOKEN}"},
    )
    with urllib.request.urlopen(vr) as r2:
        detail = json.loads(r2.read().decode())
    val = detail.get("value") or ""
    targets = ",".join(env.get("target", []))
    found[key] = (val, targets)

os.makedirs("work", exist_ok=True)
with open("work/p55-env.env", "w") as f:
    for key, (val, targets) in found.items():
        f.write(f'{key}="{val}"\n')
    # sane defaults for anything missing
    f.write('BREVO_SENDER_NAME="Kozy Care"\n')

for key in WANT:
    if key in found:
        print(f"FOUND  {key}  (targets: {found[key][1]})")
    else:
        print(f"MISSING {key}")
