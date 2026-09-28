#!/usr/bin/env python3
"""Task 73 prod rates publish: set the owner's rider-rate decision explicitly
(1500/1500 — prod was on the phase-72 defaults of 500/500) and seed the three
new distance keys only-if-missing. URL stays in env, never written to a file."""
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

res = subprocess.run(
    ["npx", "tsx", "scripts/t73_publish_rates.ts"],
    cwd="/home/z/my-project",
    env=env,
    capture_output=True,
    text=True,
)
print(res.stdout)
if res.returncode != 0:
    print(res.stderr[-1500:])
    raise SystemExit(1)
print("PROD RATES PUBLISHED")
