// =============================================================================
// GET  /api/subscriptions/plans — the Kozy Circle tiers
// PUT  /api/subscriptions/plans — admin edits (prices, perks, caps)
// =============================================================================
// GET is PUBLIC (the marketing page reads it) — only ACTIVE plans are
// exposed without a console session; admins get everything including
// inactive tiers. The table self-seeds the three defaults on first read.
//
// PUT is ADMIN-only: the owner sets the subscription prices here (30k/50k/
// 80k today, theirs to change). Saving a price also syncs a Paystack
// recurring Plan (best-effort — when PAYSTACK_SECRET_KEY is configured, a
// plan code is created/updated so card members can auto-renew).
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole, getSession } from '@/lib/auth'
import { getPlans, savePlans } from '@/lib/subscriptions'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const activeOnly = searchParams.get('active') === '1'

  // Admins may see inactive plans (the editor needs them); the public
  // marketing surface asks for active only.
  let isAdmin = false
  try {
    const session = await getSession()
    isAdmin = session?.user?.role === 'ADMIN'
  } catch {
    isAdmin = false
  }

  const plans = await getPlans(true)
  const visible = isAdmin ? plans : plans.filter((p) => p.isActive)
  return NextResponse.json({
    plans: activeOnly && !isAdmin ? visible.filter((p) => p.isActive) : visible,
  })
}

// ----- Paystack recurring-plan sync (best-effort) -----
// A plan code lets transaction/initialize attach `plan:` so Paystack itself
// re-charges the card monthly. Failures are logged and swallowed: pricing
// edits must never be blocked by a third-party hiccup, and transfer-based
// renewal keeps working regardless.
async function syncPaystackPlan(plan: {
  id: string
  code: string
  name: string
  priceMonthly: number
  family?: 'KIT' | 'SHOES'
  paystackPlanCode?: string | null
}) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey || plan.priceMonthly <= 0) return null
  const brand = plan.family === 'SHOES' ? 'Kozy Shoe Club' : 'Kozy Circle'

  try {
    if (plan.paystackPlanCode) {
      const res = await fetch(`https://api.paystack.co/plan/${plan.paystackPlanCode}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${brand} — ${plan.name}`,
          amount: Math.round(plan.priceMonthly * 100), // kobo
          interval: 'monthly',
          currency: 'NGN',
          description: `Kozy Care monthly membership (${plan.code})`,
        }),
      })
      if (res.ok) return plan.paystackPlanCode
      // 404 = the plan was deleted in the Paystack dashboard — fall through
      // and create a fresh one below.
    }
    const res = await fetch('https://api.paystack.co/plan', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${brand} — ${plan.name}`,
        amount: Math.round(plan.priceMonthly * 100),
        interval: 'monthly',
        currency: 'NGN',
        description: `Kozy Care monthly membership (${plan.code})`,
      }),
    })
    const data = await res.json().catch(() => ({}))
    const planCode = data?.data?.plan_code
    if (res.ok && planCode) {
      await db.subscriptionPlan.update({
        where: { id: plan.id },
        data: { paystackPlanCode: planCode },
      })
      return planCode
    }
    console.error('[memberships] Paystack plan sync failed:', res.status, JSON.stringify(data))
    return null
  } catch (e) {
    console.error('[memberships] Paystack plan sync error:', e)
    return null
  }
}

export async function PUT(req: Request) {
  // ----- ADMIN gate -----
  let session
  try {
    session = await requireRole('ADMIN')
  } catch (e: any) {
    if (e instanceof Response) {
      return new NextResponse(e.body, {
        status: e.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const edits = Array.isArray(body?.plans) ? body.plans : null
  if (!edits) {
    return NextResponse.json({ error: 'Body must be { plans: [...] }' }, { status: 400 })
  }

  try {
    const saved = await savePlans(edits)

    // Sync Paystack plans for every tier whose price may have moved. Runs
    // after the DB save so a Paystack failure never loses the admin's edit.
    const results = await Promise.all(
      saved.map(async (p) => ({ code: p.code, planCode: await syncPaystackPlan(p) }))
    )

    const fresh = await getPlans(true)
    return NextResponse.json({
      plans: fresh,
      paystack: results,
    })
  } catch (e) {
    console.error('[memberships] plan save failed:', e)
    return NextResponse.json({ error: 'Could not save the plans.' }, { status: 500 })
  }
}
