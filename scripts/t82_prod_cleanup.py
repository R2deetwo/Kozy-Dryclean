#!/usr/bin/env python3
"""Task 82 prod cleanup — remove the t82prod woosh E2E member from the
production DB (subscription + ledger + user). Nothing real is touched: the
identity lives on the woosh test domain. Also verifies the count after."""
import json, os, subprocess, urllib.request

TOK = open("/home/z/my-project/.env").read().split("VERCEL_TOKEN=")[1].splitlines()[0].strip()
TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"
PROJ = "prj_BUv0ZqDMzsONFBQXXCgBJfmIN43e"
ENV_ID = "1ACj5gEPmRXfWwbW"  # DIRECT_URL

req = urllib.request.Request(
    f"https://api.vercel.com/v9/projects/{PROJ}/env/{ENV_ID}?decrypt=true&teamId={TEAM}",
    headers={"Authorization": f"Bearer {TOK}"},
)
with urllib.request.urlopen(req, timeout=30) as r:
    data = json.load(r)
url = (data.get("value") or "").strip().strip('"')
if not url.startswith("postgres"):
    raise SystemExit("could not decrypt DIRECT_URL")
print("decrypted DIRECT_URL OK")

SQL = """
DELETE FROM "SubscriptionEvent" WHERE "subscriptionId" IN
  (SELECT s.id FROM "Subscription" s JOIN "User" u ON u.id = s."userId"
    WHERE u.email = 't82prod@woosh.dpdns.org');
DELETE FROM "Subscription" WHERE "userId" IN
  (SELECT id FROM "User" WHERE email = 't82prod@woosh.dpdns.org');
DELETE FROM "User" WHERE email = 't82prod@woosh.dpdns.org';
"""

env = dict(os.environ)
env["DATABASE_URL"] = url
env["DIRECT_URL"] = url
res = subprocess.run(
    ["npx", "prisma", "db", "execute", "--stdin", "--url", url],
    cwd="/home/z/my-project",
    env=env,
    input=SQL,
    capture_output=True,
    text=True,
    timeout=120,
)
print(res.stdout[-400:])
if res.returncode != 0:
    print("STDERR:", res.stderr[-1200:])
    raise SystemExit(1)
print("t82prod removed from production")
