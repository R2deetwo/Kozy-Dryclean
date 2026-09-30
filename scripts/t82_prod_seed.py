#!/usr/bin/env python3
"""Task 82 — PROD seed: the E2E member + her kit tag + admin, straight into
the production DB through DIRECT_URL (decrypted from Vercel env, never
written to a file). Everything is a woosh test identity; no real customer is
touched. Idempotent — wipes prior t82prod rows first."""
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

-- bcrypt hash of T82Prod!2026 (computed locally, embedded — no seeding deps)
INSERT INTO "User" (id, email, name, phone, role, "passwordHash", "emailVerified",
                    "marketingOptIn", "accessStatus", "mustChangePassword",
                    "signupDiscountUsed", "lastMilestoneSent", "referralCredit",
                    "createdAt", "updatedAt")
VALUES ('t82produser00000000000000000', 't82prod@woosh.dpdns.org', 'Prod Tester T82',
        '+234700000982', 'B2C',
        '$2b$10$Q8Ze7GOWKly8kQXtI6rxm.rMq2iEKkZx84jRk2N/zickseNTC0b6a',
        now(), true, 'ACTIVE', false, false, 0, 0, now(), now());

INSERT INTO "Subscription" (id, "userId", "planId", status, "pricePaid",
                            "paymentMethod", "paystackRef", "kitTag", "kitState",
                            "createdAt", "updatedAt")
SELECT 't82prodsub000000000000000000', u.id, p.id, 'PENDING_ACTIVATION', 0,
       'BANK_TRANSFER', 'SUB-T82PROD', 'KZK-T82PRD', 'PENDING_DELIVERY', now(), now()
FROM "User" u, "SubscriptionPlan" p
WHERE u.email = 't82prod@woosh.dpdns.org' AND p.code = 'ESSENTIALS';

SELECT count(*) AS t82_rows FROM "User" WHERE email = 't82prod@woosh.dpdns.org';
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
print(res.stdout[-800:])
if res.returncode != 0:
    print("STDERR:", res.stderr[-1500:])
    raise SystemExit(1)
print("seeded t82prod@woosh.dpdns.org (PENDING ESSENTIALS + kit tag KZK-T82PRD)")
