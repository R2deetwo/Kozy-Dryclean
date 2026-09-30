// =============================================================================
// GET /api/kit/[code] — scan resolution for the QR on a Kozy Bag / Kozy Box
// =============================================================================
// The kit tag (KZK-XXXXXX) printed on the member's bag encodes
// https://kozycare.ng/kit/{code}. This endpoint resolves the scan, with a
// privacy ladder:
//   • ADMIN / STAFF — the full wash-floor snapshot: whose bag, the plan,
//     the cycle usage meters, last + next pickup, the activity tail.
//   • DRIVER — the operational subset: name, plan, usage, next pickup.
//   • Everyone else (a passer-by scanning a member's bag) — brand-only:
//     the plan family and a book-a-pickup CTA. No names, no numbers.
// Read-only by design — the office records kit movements from the console.
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { effectiveStatus, effectiveUsage, getSubscriptionActivity } from '@/lib/subscriptions'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const tag = code.trim().toUpperCase()

  const sub = await db.subscription.findUnique({
    where: { kitTag: tag },
    include: { plan: true, user: { select: { id: true, name: true, email: true, phone: true } } },
  })
  if (!sub) {
    return NextResponse.json(
      { error: 'UNKNOWN_TAG', message: 'This tag is not on file — check the label or contact the office.' },
      { status: 404 }
    )
  }

  const plan = sub.plan
  const session = await getSession().catch(() => null)
  const role = (session?.user as any)?.role

  // ----- Passer-by: brand-only -----
  if (role !== 'ADMIN' && role !== 'STAFF' && role !== 'DRIVER') {
    return NextResponse.json({
      scope: 'public',
      planName: plan?.name ?? 'Kozy Circle',
      unitName: plan?.unitName ?? 'Kozy Bag',
      kitState: sub.kitState,
    })
  }

  // ----- Staff + riders: the identification snapshot -----
  const usage = plan
    ? effectiveUsage(
        {
          unitsUsed: sub.unitsUsed,
          extraUnitsUsed: sub.extraUnitsUsed,
          shoesUsed: sub.shoesUsed,
          duvetsUsed: sub.duvetsUsed,
          curtainsUsed: sub.curtainsUsed,
          springCleanUsed: sub.springCleanUsed,
          usageQuarterKey: sub.usageQuarterKey,
          usageYearKey: sub.usageYearKey,
        },
        plan
      )
    : null

  const activity = await getSubscriptionActivity(sub.id, { eventLimit: 6 })
  const member = {
    name: sub.user?.name ?? 'Member',
    // Full contact only for the office; riders identify, they don't cold-call.
    ...(role === 'ADMIN' || role === 'STAFF'
      ? { email: sub.user?.email, phone: sub.user?.phone }
      : {}),
  }

  return NextResponse.json({
    scope: role === 'DRIVER' ? 'rider' : 'office',
    member,
    planName: plan?.name ?? 'Kozy Circle',
    unitName: plan?.unitName ?? 'Kozy Bag',
    unitKind: plan?.unitKind ?? 'bag',
    status: effectiveStatus(sub),
    periodEnd: sub.periodEnd?.toISOString() ?? null,
    kitState: sub.kitState,
    kitDeliveredAt: sub.kitDeliveredAt?.toISOString() ?? null,
    usage,
    priority: plan?.prioritySlots ?? false,
    activity: activity?.activity.slice(0, 5) ?? [],
  })
}
