#!/usr/bin/env python3
"""Task 82 — READ-ONLY prod inspection: find users who signed up but never
got a working membership/payment (the two real people who tried to join and
could not pay). No writes, no emails — just understanding their exact state
so the recovery path can be verified for it."""
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
SELECT u.id, u.email, u.name, u.role, u."emailVerified" IS NOT NULL AS verified,
       u."createdAt",
       (SELECT count(*) FROM "Order" o WHERE o."userId" = u.id) AS orders,
       (SELECT count(*) FROM "Subscription" s WHERE s."userId" = u.id) AS subs
FROM "User" u
WHERE u.role IN ('B2C','B2B')
ORDER BY u."createdAt" DESC
LIMIT 40;
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
print(res.stdout[-6000:])
if res.returncode != 0:
    print("STDERR:", res.stderr[-2000:])
    raise SystemExit(1)

SQL2 = """
SELECT s.id, u.email, s.status, s."planId", s."pricePaid", s."paymentMethod",
       s."periodEnd", s."cancelAtPeriodEnd", s."createdAt", s."paystackRef"
FROM "Subscription" s JOIN "User" u ON u.id = s."userId"
ORDER BY s."createdAt" DESC LIMIT 30;
"""
res2 = subprocess.run(
    ["npx", "prisma", "db", "execute", "--stdin", "--url", url],
    cwd="/home/z/my-project",
    env=env,
    input=SQL2,
    capture_output=True,
    text=True,
    timeout=120,
)
print(res2.stdout[-6000:])
