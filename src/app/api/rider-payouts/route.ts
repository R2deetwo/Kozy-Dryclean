// =============================================================================
// POST /api/rider-payouts — ADMIN: record money actually paid to a rider
// GET  /api/rider-payouts — ADMIN: the recent payout history (the desk)
// =============================================================================
// Phase 72 — the money side of "how riders get paid". Earnings are computed
// (legs × published rates); a payout is what the office SETTLED. Recording
// one closes the loop: the rider's pending balance drops, the rider gets a
// receipt email, and the row carries who recorded it for the audit trail.
//
// RBAC: ADMIN only — paying money out is a finances action, deliberately out
// of STAFF reach (same rule as pricing and the discount engine).
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { getAppSettings } from '@/lib/app-settings'
import { getRiderPayoutSummary } from '@/lib/rider-ledger'
import { notifyRiderPayout, logStaffEvent } from '@/lib/notifications'

async function requireAdmin(): Promise<ReturnType<typeof requireRole> | NextResponse> {
  try {
    return await requireRole('ADMIN')
  } catch (e: any) {
    if (e instanceof Response) {
      return new NextResponse(e.body, {
        status: e.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (session instanceof NextResponse) return session

  const body = await req.json().catch(() => ({}))
  const riderId = typeof body?.riderId === 'string' ? body.riderId : ''
  const amountRaw = Number(body?.amount)
  const method = body?.method === 'CASH' ? 'CASH' : 'BANK_TRANSFER'
  const reference =
    typeof body?.reference === 'string' && body.reference.trim() ? body.reference.trim().slice(0, 80) : null
  const note =
    typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 300) : null

  if (!riderId) {
    return NextResponse.json({ error: 'A rider is required.' }, { status: 400 })
  }
  const rider = await db.user.findUnique({ where: { id: riderId } })
  if (!rider || rider.role !== 'DRIVER') {
    return NextResponse.json({ error: 'Rider not found.' }, { status: 404 })
  }
  if (!Number.isFinite(amountRaw) || amountRaw <= 0 || Math.round(amountRaw) !== amountRaw || amountRaw > 10_000_000) {
    return NextResponse.json({ error: 'Amount must be a whole number of naira greater than zero.' }, { status: 400 })
  }
  const amount = Math.round(amountRaw)

  // Live balance at the moment of settling (what the desk is paying against).
  const settings = await getAppSettings()
  const rates = {
    pickup: settings?.riderPickupRate ?? 0,
    delivery: settings?.riderDeliveryRate ?? 0,
  }
  const before = await getRiderPayoutSummary(riderId, rates)

  const payout = await db.riderPayout.create({
    data: {
      riderId,
      amount,
      method,
      reference,
      note,
      recordedById: session.user?.id ?? null,
    },
  })

  const balanceAfter = await getRiderPayoutSummary(riderId, rates)

  // Receipt to the rider (email when the account has one — always does, the
  // credentials email is the onboarding) + the audit log. Never blocks the
  // response; the desk outcome only depends on the row being written.
  after(async () => {
    try {
      await notifyRiderPayout({
        to: rider.email,
        name: rider.name,
        amount,
        method,
        reference,
        pendingAfter: balanceAfter.pending,
      })
    } catch (e) {
      console.error('[rider-payouts] receipt email failed:', e)
    }
    try {
      await logStaffEvent({
        type: 'RIDER_PAYOUT',
        title: `Rider payout recorded — ₦${amount.toLocaleString('en-NG')} to ${rider.name}`,
        body: `${rider.name} was settled ₦${amount.toLocaleString('en-NG')} by ${method === 'CASH' ? 'cash' : 'bank transfer'}${reference ? ` (ref ${reference})` : ''}. Pending balance after: ₦${balanceAfter.pending.toLocaleString('en-NG')}.${note ? ` Note: ${note}` : ''}`,
        staffEmail: session.user?.email ?? '',
        emailStatus: 'NONE',
        detail: { payoutId: payout.id, riderId, amount, method, reference },
        linkTab: 'riders',
      })
    } catch (e) {
      console.error('[rider-payouts] audit log failed:', e)
    }
  })

  return NextResponse.json(
    {
      payout: {
        id: payout.id,
        amount: payout.amount,
        method: payout.method,
        reference: payout.reference,
        note: payout.note,
        createdAt: payout.createdAt.toISOString(),
      },
      rider: { id: rider.id, name: rider.name, email: rider.email },
      balance: { paidTotal: balanceAfter.paidTotal, pending: balanceAfter.pending, before: before.pending },
    },
    { status: 201 }
  )
}

export async function GET() {
  const session = await requireAdmin()
  if (session instanceof NextResponse) return session

  const payouts = await db.riderPayout.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      rider: { select: { id: true, name: true, email: true } },
      recordedBy: { select: { name: true } },
    },
  })

  return NextResponse.json({
    payouts: payouts.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      reference: p.reference,
      note: p.note,
      createdAt: p.createdAt.toISOString(),
      riderId: p.rider.id,
      riderName: p.rider.name,
      recordedByName: p.recordedBy?.name ?? null,
    })),
  })
}
