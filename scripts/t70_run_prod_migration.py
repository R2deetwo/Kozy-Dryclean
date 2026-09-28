#!/usr/bin/env python3
"""Fetch the decrypted prod DATABASE_URL from Vercel and run the phase-70
Shoe Club migration against it (URL stays in the environment, never a file)."""
import json, os, subprocess, urllib.request

TOK = "REDACTED_INVALID_PASTED_TOKEN"
TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"
PROJ = "prj_BUv0ZqDMzsONFBQXXCgBJfmIN43e"
ENV_ID = "m2jwp99GnW3xFxno"  # DATABASE_URL (from the project env listing)

req = urllib.request.Request(
    f"https://api.vercel.com/v9/projects/{PROJ}/env/{ENV_ID}?decrypt=true&teamId={TEAM}",
    headers={"Authorization": f"Bearer {TOK}"},
)
with urllib.request.urlopen(req, timeout=30) as r:
    data = json.load(r)

url = (data.get("value") or "").strip().strip('"')
if not url.startswith("postgres"):
    raise SystemExit(f"could not decrypt DATABASE_URL: {json.dumps(data)[:300]}")

print("decrypted DATABASE_URL OK (len", len(url), ")")
env = dict(os.environ)
env["DATABASE_URL"] = url
env.pop("DIRECT_URL", None)  # avoid the sandbox sqlite global leaking in
res = subprocess.run(
    ["bun", "run", "scripts/t70_prod_club_migration.ts"],
    cwd="/home/z/my-project",
    env=env,
    capture_output=True,
    text=True,
)
print(res.stdout)
if res.returncode != 0:
    print(res.stderr[-1500:])
    raise SystemExit(1)
