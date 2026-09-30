#!/usr/bin/env python3
"""Task 80 — read-only prod inspection for the signup-payment-bypass report.

Owner signed up for a membership with dv5u6wcr5y@woosh.dpdns.org and no
payment was required — landed straight in the portal. This script pulls
ground truth from prod Supabase (decrypted DIRECT_URL, t73/t77 pattern):
  - the user row for the test account
  - every subscription for that user (+ plan, status, method, refs, dates)
  - every SubscriptionEvent for those subscriptions
  - the last 10 subscriptions overall (what has been created recently)
  - whether PAYSTACK_SECRET_KEY is now set in the Vercel env (the t79
    diagnosis was "no key" — verify that is still the case)
"""
import json
import urllib.request
import subprocess
import os
import sys

ROOT = "/home/z/my-project"
PROJ = "prj_BUv0ZqDMzsONFBQXXCgBJfmIN43e"
TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"
DIRECT_URL_ENV_ID = "1ACj5gEPmRXfWwbW"  # DIRECT_URL (t73-verified)
TEST_EMAIL = "dv5u6wcr5y@woosh.dpdns.org"


def token() -> str:
    with open(f"{ROOT}/.env") as f:
        for line in f:
            if line.startswith("VERCEL_TOKEN="):
                return line.split("=", 1)[1].strip()
    raise SystemExit("VERCEL_TOKEN missing from .env")


def api(path: str) -> dict:
    req = urllib.request.Request(
        f"https://api.vercel.com{path}",
        headers={"Authorization": f"Bearer {token()}"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


TSX = r"""
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const EMAIL = process.env.PROBE_EMAIL!

async function main() {
  const user = await db.user.findUnique({ where: { email: EMAIL } })
  console.log('=== USER ===')
  console.log(JSON.stringify(user ? {
    id: user.id, email: user.email, name: user.name, role: user.role,
    emailVerified: user.emailVerified, createdAt: user.createdAt,
  } : null, null, 2))

  if (user) {
    const subs = await db.subscription.findMany({
      where: { userId: user.id },
      include: { plan: true },
      orderBy: { createdAt: 'asc' },
    })
    console.log('=== SUBSCRIPTIONS FOR TEST USER ===')
    for (const s of subs) {
      console.log(JSON.stringify({
        id: s.id, planCode: s.plan?.code, planName: s.plan?.name,
        status: s.status, paymentMethod: s.paymentMethod,
        paystackRef: s.paystackRef, transferReceipt: s.transferReceipt ? 'attached' : null,
        pricePaid: s.pricePaid, periodStart: s.periodStart, periodEnd: s.periodEnd,
        createdAt: s.createdAt, cancelledAt: s.cancelledAt,
      }, null, 2))
      const evts = await db.subscriptionEvent.findMany({
        where: { subscriptionId: s.id },
        orderBy: { createdAt: 'asc' },
      })
      console.log('--- events for ' + s.id + ' ---')
      for (const e of evts) {
        console.log(JSON.stringify({
          kind: e.kind, delta: e.delta, count: e.count,
          note: e.note, meta: e.meta ? String(e.meta).slice(0, 220) : null,
          createdAt: e.createdAt,
        }))
      }
    }
    const payments = await db.payment.findMany({
      where: { order: { userId: user.id } },
      orderBy: { createdAt: 'desc' }, take: 5,
    })
    console.log('=== ORDER PAYMENTS (test user) ===')
    console.log(JSON.stringify(payments.map(p => ({
      id: p.id, amount: p.amount, method: p.method, status: p.status,
      ref: p.paystackRef, createdAt: p.createdAt,
    })), null, 2))
  }

  console.log('=== LAST 12 SUBSCRIPTIONS (any user) ===')
  const recent = await db.subscription.findMany({
    include: { plan: true, user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' }, take: 12,
  })
  for (const s of recent) {
    console.log(JSON.stringify({
      email: s.user?.email, plan: s.plan?.code, status: s.status,
      method: s.paymentMethod, ref: s.paystackRef,
      pricePaid: s.pricePaid, created: s.createdAt,
      periodEnd: s.periodEnd,
    }))
  }
}
main().finally(() => db.$disconnect())
"""

with open(f"{ROOT}/scripts/t80_probe.ts", "w") as f:
    f.write(TSX)

env = api(f"/v9/projects/{PROJ}/env/{DIRECT_URL_ENV_ID}?decrypt=true&teamId={TEAM}")
url = (env.get("value") or "").strip().strip('"')
if not url.startswith("postgres"):
    raise SystemExit(f"could not decrypt DIRECT_URL: {json.dumps(env)[:300]}")
print("decrypted DIRECT_URL OK (len", len(url), ")")

# Is PAYSTACK_SECRET_KEY set in prod now?
try:
    envs = api(f"/v9/projects/{PROJ}/env?teamId={TEAM}")
    names = [(e.get("key"), e.get("target")) for e in envs]
    has_ps = any(k == "PAYSTACK_SECRET_KEY" for k, _ in names)
    print("PAYSTACK_SECRET_KEY present in Vercel env:", has_ps)
    print("env var names:", [k for k, _ in names])
except Exception as e:
    print("env listing failed:", e)

res = subprocess.run(
    ["bunx", "tsx", "scripts/t80_probe.ts"],
    cwd=ROOT,
    env={**os.environ, "DATABASE_URL": url, "DIRECT_URL": url, "PROBE_EMAIL": TEST_EMAIL},
    capture_output=True,
    text=True,
    timeout=240,
)
print(res.stdout)
if res.returncode != 0:
    print("STDERR:", res.stderr[-3000:])
    sys.exit(1)
