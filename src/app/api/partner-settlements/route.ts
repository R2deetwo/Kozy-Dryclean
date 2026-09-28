// =============================================================================
// POST /api/partner-settlements — ADMIN: record money actually settled to a
//                                network partner against their revenue share
// GET  /api/partner-settlements — ADMIN: the recent settlement history
// =============================================================================
// Phase 72 — the partner's money side, deliberately the twin of
// /api/rider-payouts: share earned is computed from delivered orders; a
// settlement row is what the office PAID. Pending = earned − settled, and
// the partner gets a receipt email the moment it is recorded.
//
// RBAC: ADMIN only (finances).
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { getPartnerSettlementSummary } from '@/lib/partner-ledger'
import { notifyPartnerSettlement, logStaffEvent } from '@/lib/notifications'

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
  const partnerId = typeof body?.partnerId === 'string' ? body.partnerId : ''
  const amountRaw = Number(body?.amount)
  const method = body?.method === 'CASH' ? 'CASH' : 'BANK_TRANSFER'
  const reference =
    typeof body?.reference === 'string' && body.reference.trim() ? body.reference.trim().slice(0, 80) : null
  const note =
    typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 300) : null

  if (!partnerId) {
    return NextResponse.json({ error: 'A partner is required.' }, { status: 400 })
  }
  const partner = await db.partner.findUnique({ where: { id: partnerId } })
  if (!partner || partner.status === 'REJECTED') {
    return NextResponse.json({ error: 'Partner not found.' }, { status: 404 })
  }
  if (!Number.isFinite(amountRaw) || amountRaw <= 0 || Math.round(amountRaw) !== amountRaw || amountRaw > 50_000_000) {
    return NextResponse.json({ error: 'Amount must be a whole number of naira greater than zero.' }, { status: 400 })
  }
  const amount = Math.round(amountRaw)

  const before = await getPartnerSettlementSummary(partner)

  const settlement = await db.partnerSettlement.create({
    data: {
      partnerId,
      amount,
      method,
      reference,
      note,
      recordedById: session.user?.id ?? null,
    },
  })

  const balanceAfter = await getPartnerSettlementSummary(partner)

  after(async () => {
    try {
      await notifyPartnerSettlement({
        to: partner.email,
        businessName: partner.businessName,
        contactName: partner.contactName,
        amount,
        method,
        reference,
        pendingAfter: balanceAfter.pending,
      })
    } catch (e) {
      console.error('[partner-settlements] receipt email failed:', e)
    }
    try {
      await logStaffEvent({
        type: 'PARTNER_SETTLEMENT',
        title: `Partner settlement recorded — ₦${amount.toLocaleString('en-NG')} to ${partner.businessName}`,
        body: `${partner.businessName} was settled ₦${amount.toLocaleString('en-NG')} by ${method === 'CASH' ? 'cash' : 'bank transfer'}${reference ? ` (ref ${reference})` : ''}. Pending share after: ₦${balanceAfter.pending.toLocaleString('en-NG')}.${note ? ` Note: ${note}` : ''}`,
        staffEmail: session.user?.email ?? '',
        emailStatus: 'NONE',
        detail: { settlementId: settlement.id, partnerId, amount, method, reference },
        linkTab: 'partners',
      })
    } catch (e) {
      console.error('[partner-settlements] audit log failed:', e)
    }
  })

  return NextResponse.json(
    {
      settlement: {
        id: settlement.id,
        amount: settlement.amount,
        method: settlement.method,
        reference: settlement.reference,
        note: settlement.note,
        createdAt: settlement.createdAt.toISOString(),
      },
      balance: {
        settledTotal: balanceAfter.settledTotal,
        pending: balanceAfter.pending,
        before: before.pending,
      },
    },
    { status: 201 }
  )
}

export async function GET() {
  const session = await requireAdmin()
  if (session instanceof NextResponse) return session

  const settlements = await db.partnerSettlement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      partner: { select: { id: true, businessName: true, email: true } },
      recordedBy: { select: { name: true } },
    },
  })

  return NextResponse.json({
    settlements: settlements.map((s) => ({
      id: s.id,
      amount: s.amount,
      method: s.method,
      reference: s.reference,
      note: s.note,
      createdAt: s.createdAt.toISOString(),
      partnerId: s.partner.id,
      partnerName: s.partner.businessName,
      recordedByName: s.recordedBy?.name ?? null,
    })),
  })
}
