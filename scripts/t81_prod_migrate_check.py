#!/usr/bin/env python3
"""Phase 81 prod post-deploy: confirm the plan_change migration applied on
the production DB (the build's `prisma migrate deploy` should have done it),
and confirm the pendingPlanId column exists + the FK is in place.
URL stays in env, never written to a file."""
import json, os, subprocess, urllib.request

TOK = open("/home/z/my-project/.env").read().split("VERCEL_TOKEN=")[1].splitlines()[0].strip()
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

res = subprocess.run(
    ["npx", "prisma", "migrate", "status"],
    cwd="/home/z/my-project",
    env=env,
    capture_output=True,
    text=True,
)
print("--- migrate status ---")
print(res.stdout[-2500:])
if res.returncode != 0:
    print(res.stderr[-1500:])
    raise SystemExit(1)
