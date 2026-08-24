// =============================================================================
// GET /api/payments — list payments (RBAC-filtered)
// POST /api/payments — create a payment record (e.g., upload receipt)
// =============================================================================
// RBAC rules:
//   GET:
//     - ADMIN: sees all payments
//     - DRIVER: 403 (drivers have zero access to payment data — per master prompt)
//     - B2C/B2B: sees only payments for their own orders
//   POST:
//     - ADMIN: can create payments for any order
//     - B2C/B2B: can create payments only for their own orders
//     - DRIVER: 403 (drivers cannot create payments)
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, requireSession } from '@/lib/auth'
import { CreatePaymentSchema } from '@/lib/schemas'

// ----- GET /api/payments -----
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Drivers have zero access to payment data
  if (session.user?.role === 'DRIVER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let where: any = {}

  if (session.user?.role === 'B2C' || session.user?.role === 'B2B') {
    // Customers see only payments for their own orders
    where = { order: { userId: session.user?.id } }
  }
  // ADMIN sees all payments

  const payments = await db.payment.findMany({
    where,
    include: {
      order: {
        select: { id: true, orderNumber: true, userId: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ payments })
}

// ----- POST /api/payments -----
export async function POST(req: Request) {
  const session = await requireSession()

  // Drivers cannot create payments
  if (session.user?.role === 'DRIVER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

  return NextResponse.json({ payment }, { status: 201 })
}
