// =============================================================================
// GET /api/paystack/verify?reference=... — public payment status lookup
// =============================================================================
// Used by the /payment/callback page after a customer returns from the
// Paystack hosted checkout. Calls Paystack's verify endpoint and returns a
// MINIMAL projection (status + amount + order number) — no customer PII, so
// it is safe to expose publicly. The reference is the order number, which
// the customer already knows.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, getClientIP } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  // Rate limit: 30 lookups per IP per 5 minutes
  const ip = getClientIP(req)
  const limit = rateLimit(`paystack-verify:${ip}`, { max: 30, windowMs: 5 * 60 * 1000 })
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  const reference = req.nextUrl.searchParams.get('reference')
  if (!reference) {
    return NextResponse.json({ error: 'reference is required' }, { status: 400 })
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: 'PAYSTACK_NOT_CONFIGURED' }, { status: 503 })
  }

  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    // "re-query the transaction" / not-found both land here — treat as unknown
    return NextResponse.json({ status: 'unknown' }, { status: 200 })
  }

  const gatewayStatus = data?.data?.status // 'success' | 'failed' | 'abandoned' | ...
  const amount = data?.data?.amount ? data.data.amount / 100 : null

  // Local lookup so we can tell the customer which order this was for
  const order = await db.order.findFirst({
    where: {
      OR: [{ orderNumber: reference }, { orderNumber: reference.replace('KZ-', '') }],
    },
    select: { orderNumber: true },
  })

  return NextResponse.json({
    status: gatewayStatus || 'unknown',
    paid: gatewayStatus === 'success',
    amount,
    orderNumber: order?.orderNumber ?? reference,
  })
}
