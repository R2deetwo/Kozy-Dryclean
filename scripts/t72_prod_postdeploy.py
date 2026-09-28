#!/usr/bin/env python3
"""Phase 72 prod post-deploy: verify the new migration applied on the prod
DB, and publish the default rider pay rates (500/500) ONLY if they are
currently 0/0 (never override an office decision). URL stays in env,
never written to a file."""
import json, os, subprocess, urllib.request

TOK = "REDACTED_INVALID_PASTED_TOKEN"
TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"
PROJ = "prj_BUv0ZqDMzsONFBQXXCgBJfmIN43e"
ENV_ID = "1ACj5gEPmRXfWwbW"  # DIRECT_URL (pooled DATABASE_URL times out for DDL)

req = urllib.request.Request(
    f"https://api.vercel.com/v9/projects/{PROJ}/env/{ENV_ID}?decrypt=true&teamId={TEAM}",
    headers={"Authorization": f"Bearer {TOK}"},
)
with urllib.request.urlopen(req, timeout=30) as r:
    data = json.load(r)

url = (data.get("value") or "").strip().strip('"')
if not url.startswith("postgres"):
    raise SystemExit(f"could not decrypt DIRECT_URL: {json.dumps(data)[:300]}")

print("decrypted DIRECT_URL OK (len", len(url), ")")
env = dict(os.environ)
env["DIRECT_URL"] = url
env["DATABASE_URL"] = url
env.pop("DATABASE_URL", None) if False else None

# 1) migrate status — the build's migrate deploy should have applied
#    20260928100000_rider_pay_partner_portal.
res = subprocess.run(
    ["npx", "prisma", "migrate", "status"],
    cwd="/home/z/my-project",
    env=env,
    capture_output=True,
    text=True,
)
print("--- migrate status ---")
print(res.stdout[-2000:])
if res.returncode != 0:
    print(res.stderr[-1500:])
    raise SystemExit(1)

# 2) publish default rider rates only if currently unpublished (0/0).
res2 = subprocess.run(
    ["node", "scripts/t72_rates.cjs"],
    cwd="/home/z/my-project",
    env=env,
    capture_output=True,
    text=True,
)
print("--- rider rates ---")
print(res2.stdout)
if res2.returncode != 0:
    print(res2.stderr[-1500:])
    raise SystemExit(1)
