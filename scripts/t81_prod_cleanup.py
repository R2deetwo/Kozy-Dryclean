#!/usr/bin/env python3
"""Task 81 prod cleanup — remove the woosh E2E test members created while
verifying the payment UX on kozycare.ng (unverified signups + the two full
test members with subscriptions). Nothing real is touched: the emails all end
in @woosh.dpdns.org (the owner's test domain). URL stays in env, never a file."""
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
print("decrypted DIRECT_URL OK (len", len(url), ")")

SQL = """
DO $$
DECLARE
  u RECORD;
  removed_users int := 0;
  removed_subs int := 0;
BEGIN
  FOR u IN SELECT id, email FROM "User" WHERE email LIKE '%@woosh.dpdns.org'
            AND email LIKE 'yw9bers2ab%'
  LOOP
    DELETE FROM "SubscriptionEvent" WHERE "subscriptionId" IN
      (SELECT id FROM "Subscription" WHERE "userId" = u.id);
    DELETE FROM "Subscription" WHERE "userId" = u.id;
    DELETE FROM "User" WHERE id = u.id;
    removed_users := removed_users + 1;
  END LOOP;
  RAISE NOTICE 'woosh partial-signup removed: %', removed_users;
END $$;

DELETE FROM "SubscriptionEvent" WHERE "subscriptionId" IN
  (SELECT s.id FROM "Subscription" s JOIN "User" u ON u.id = s."userId"
    WHERE u.email IN ('98ym6zfuax@woosh.dpdns.org', 'gwtwdq57ug@woosh.dpdns.org'));
DELETE FROM "Subscription" WHERE "userId" IN
  (SELECT id FROM "User" WHERE email IN ('98ym6zfuax@woosh.dpdns.org', 'gwtwdq57ug@woosh.dpdns.org'));
DELETE FROM "User" WHERE email IN ('98ym6zfuax@woosh.dpdns.org', 'gwtwdq57ug@woosh.dpdns.org');

SELECT count(*) AS remaining_woosh_t81 FROM "User"
  WHERE email IN ('98ym6zfuax@woosh.dpdns.org', 'gwtwdq57ug@woosh.dpdns.org', 'yw9bers2ab@woosh.dpdns.org');
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
)
print(res.stdout[-1500:] if res.stdout else "(no stdout)")
if res.returncode != 0:
    print(res.stderr[-1500:])
    raise SystemExit(1)

# Final proof: zero t81 test rows remain.
check = subprocess.run(
    ["npx", "prisma", "db", "execute", "--stdin", "--url", url],
    cwd="/home/z/my-project",
    env=env,
    input='SELECT count(*) AS c FROM "User" WHERE email LIKE \'%@woosh.dpdns.org\' AND (email LIKE \'98ym6%\' OR email LIKE \'gwtwdq%\' OR email LIKE \'yw9bers2ab%\');',
    capture_output=True,
    text=True,
)
print("final check stdout:", (check.stdout or "").strip()[:300])
