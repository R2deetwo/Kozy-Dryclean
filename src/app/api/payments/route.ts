// =============================================================================
// GET /api/payments — list payments (RBAC-filtered, cursor-paginated)
// POST /api/payments — create a payment record (e.g., upload receipt)
// =============================================================================
// RBAC rules:
//   GET:
//     - ADMIN: sees all payments
//     - STAFF (phase 31): sees all payments — the verification queue is their
//       day job. Live ACTIVE status is enforced (paused staff get 403 within
//       ~60s).
//     - DRIVER: 403 (drivers have zero access to payment data — per master prompt)
//     - B2C/B2B: sees only payments for their own orders
//   Pagination (GET):
//     - `?cursor=<id>&limit=<n>` — cursor-based, default limit 25, hard cap 100.
//     - Ordered by (createdAt DESC, id DESC) so the cursor is stable.
//     - Response shape: { items, nextCursor } — nextCursor is null on the last
//       page. RBAC filters compose with the cursor exactly as before.
//   POST:
//     - ADMIN: can create payments for any order
//     - B2C/B2B: can create payments only for their own orders
//     - STAFF/DRIVER: 403 (payment-record creation stays with admins and
//       customers — staff verify and reject, they never fabricate claims)
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { getSession, requireSession, verifyLiveAccess } from '@/lib/auth'
import { CreatePaymentSchema } from '@/lib/schemas'
import { rateLimit } from '@/lib/rate-limit'
import { notifyAdminTransferPending } from '@/lib/notifications'

// ----- GET /api/payments -----
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Drivers have zero access to payment data
  if (session.user?.role === 'DRIVER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ----- Staff live-access check (phase 31) -----
  // ADMIN/STAFF sessions are re-checked against the database so a pause or
  // revoke takes effect within ~60s even mid-session.
  const blocked = await verifyLiveAccess(session)
  if (blocked) {
    return new NextResponse(blocked.body, {
      status: blocked.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ----- Cursor pagination params -----
  const { searchParams } = new URL(req.url)
  const limitRaw = parseInt(searchParams.get('limit') ?? '', 10)
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 25, 1), 100)
  const cursor = searchParams.get('cursor') || undefined

  let where: any = {}

  if (session.user?.role === 'B2C' || session.user?.role === 'B2B') {
    // Customers see only payments for their own orders
    where = { order: { userId: session.user?.id } }
  }
  // ADMIN and STAFF see all payments (the verification queue)

  // take limit+1 rows so we can tell whether another page exists
  let payments = await db.payment.findMany({
    where,
    include: {
      order: {
        select: { id: true, orderNumber: true, userId: true },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = payments.length > limit
  if (hasMore) payments = payments.slice(0, limit)
  const nextCursor = hasMore ? payments[payments.length - 1].id : null

  return NextResponse.json({ items: payments, nextCursor })
}

// ----- POST /api/payments -----
export async function POST(req: Request) {
  const session = await requireSession()

  // Drivers cannot create payments
  if (session.user?.role === 'DRIVER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Staff verify and reject payments — they never create claims (phase 31).
  if (session.user?.role === 'STAFF') {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Staff accounts cannot create payment records — verify or reject them in the queue instead.' },
      { status: 403 }
    )
  }

  // ----- Rate limit: 10 payment submissions per hour per user -----
  // An anxious customer (or a compromised account) otherwise floods the
  // admin verification queue with duplicate PENDING records.
  const limit = await rateLimit(`payments-post:${session.user?.id}`, {
    max: 10,
    windowMs: 60 * 60 * 1000,
  })
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many payment submissions. Please wait a while or call us — we may already be verifying your transfer.' },
      { status: 429 }
    )
  }

  const body = await req.json()
  const parsed = CreatePaymentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { orderId, amount, method, receiptUrl } = parsed.data

  // Verify the order exists
  const order = await db.order.findUnique({ where: { id: orderId } })
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // RBAC: non-admins can only create payments for their own orders
  if (session.user?.role !== 'ADMIN' && order.userId !== session.user?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ----- Duplicate guard -----
  // If this order already has a PENDING payment awaiting verification,
  // return THAT record instead of creating another — every re-submission
  // used to add a fresh row to the admin queue (audit finding).
  const existingPending = await db.payment.findFirst({
    where: { orderId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  })
  if (existingPending) {
    return NextResponse.json({ payment: existingPending, duplicate: true }, { status: 201 })
  }

  const payment = await db.payment.create({
    data: {
      orderId,
      amount,
      method,
      status: 'PENDING',
      receiptUrl: receiptUrl || null,
    },
  })

  // Move the order into payment-pending-verification state (if not already)
  if (order.status === 'REQUESTED') {
    await db.order.update({
      where: { id: orderId },
      data: { status: 'PAYMENT_PENDING_VERIFICATION' },
    })
  }

  // Alert the owner — this POST path (e.g. customer re-confirming from the
  // portal) previously created the verification request silently, while
  // the equivalent orders-POST path sent the "Verify payment" email.
  if (method === 'BANK_TRANSFER') {
    after(async () => {
      try {
        const fresh = await db.order.findUnique({
          where: { id: orderId },
          include: {
            user: { select: { id: true, name: true, email: true, phone: true, role: true } },
            driver: { select: { id: true, name: true, phone: true } },
            payments: true,
            media: true,
          },
        })
        if (fresh) await notifyAdminTransferPending(fresh as any)
      } catch (e) {
        console.error('Transfer-pending admin alert failed:', e)
      }
    })
  }

  return NextResponse.json({ payment }, { status: 201 })
}
