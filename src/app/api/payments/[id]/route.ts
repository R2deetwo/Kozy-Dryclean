// =============================================================================
// PATCH /api/payments/[id] — verify or reject a payment
// =============================================================================
// RBAC rules:
//   - ADMIN ONLY: can verify or reject payments
//   - All other roles: 403
//   - Drivers: 403 (explicitly forbidden from any payment access per master prompt)
//
// Customer notifications (the emails customers were promised):
//   - VERIFIED → the order moves to PAYMENT_VERIFIED and the customer is
//     emailed/SMS'd ("Payment confirmed — pickup scheduled"). This used to be
//     missing entirely: admin saw "Customer notified" while nothing was sent.
//   - REJECTED → the customer is emailed/SMS'd with what to check and what NOT
//     to do (never pay twice — call us if debited).
//
// Pipeline integrity guards:
//   - Duplicate verify: a payment already VERIFIED is returned as-is (no
//     second email, no state churn).
//   - No-regression: verifying only ADVANCES the order while it is still
//     REQUESTED / PAYMENT_PENDING_VERIFICATION. A late transfer landing on an
//     order that is already PICKED_UP or beyond marks the payment VERIFIED
//     and emails the customer — but never drags the order backwards.
//   - Re-approval: a REJECTED payment can be set back to VERIFIED (money can
//     land minutes or hours after a rejection) — same rules as a fresh verify.
//
// The response returns BOTH the payment and the fresh order (with relations)
// so the admin UI can patch its React Query caches instantly instead of
// showing a stale snapshot while the refetch is in flight.
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { UpdatePaymentSchema } from '@/lib/schemas'
import { notifyOrderStatus, notifyPaymentRejected } from '@/lib/notifications'

const ORDER_INCLUDE = {
  user: { select: { id: true, name: true, email: true, phone: true, role: true } },
  driver: { select: { id: true, name: true, phone: true } },
  payments: true,
  media: true,
} as const

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // requireRole throws a 401 if no session, 403 if wrong role
  const session = await requireRole('ADMIN')

  const { id } = await params

  const payment = await db.payment.findUnique({
    where: { id },
    include: { order: true },
  })
  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  const body = await req.json()
  const parsed = UpdatePaymentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { status } = parsed.data

  // ----- Duplicate-verify guard -----
  // Clicking Verify on an already-verified payment is a no-op: the DB write
  // is skipped, no second email goes out, and the current state is returned.
  if (status === 'VERIFIED' && payment.status === 'VERIFIED') {
    const order = await db.order.findUnique({
      where: { id: payment.orderId },
      include: ORDER_INCLUDE,
    })
    return NextResponse.json({ payment, order, noOp: true })
  }

  const updateData: any = { status }
  if (status === 'VERIFIED') {
    updateData.verifiedAt = new Date()
    updateData.verifiedById = session.user?.id
  } else {
    // Clear the verifier trail when rejecting / re-rejecting
    updateData.verifiedAt = null
    updateData.verifiedById = null
  }

  const updated = await db.payment.update({
    where: { id },
    data: updateData,
  })

  let freshOrder = await db.order.findUnique({
    where: { id: payment.orderId },
    include: ORDER_INCLUDE,
  })

  // ----- Verify: advance the order (guarded) + email the customer -----
  if (status === 'VERIFIED' && payment.order && freshOrder) {
    const canAdvance =
      payment.order.status === 'REQUESTED' ||
      payment.order.status === 'PAYMENT_PENDING_VERIFICATION'

    // ----- Stage-email dedup (phase 24) -----
    // "Payment confirmed" is pipeline stage 1. If the customer has already
    // been notified at/past that stage (e.g. the order progressed after a
    // previous verification, or a reject → re-approve loop), do NOT email
    // again — the client explicitly asked that no stage email ever repeats.
    const alreadyNotifiedPaymentStage = payment.order.lastNotifiedStage >= 1

    if (canAdvance) {
      freshOrder = await db.order.update({
        where: { id: payment.orderId },
        data: {
          status: 'PAYMENT_VERIFIED',
          // Mark stage 1 notified in the same atomic write as the status.
          ...(alreadyNotifiedPaymentStage ? {} : { lastNotifiedStage: 1 }),
        },
        include: ORDER_INCLUDE,
      })
    } else if (!alreadyNotifiedPaymentStage) {
      // Late transfer on an already-advanced order (no-regression guard
      // above): never drag the order back, but still claim stage 1 so no
      // future verify/re-approve cycle can email it twice.
      await db.order.update({
        where: { id: payment.orderId },
        data: { lastNotifiedStage: 1 },
      })
    }

    // Email/SMS the customer the confirmation they were promised at checkout
    // ("you'll get an email the moment it's verified") — after the response,
    // because Brevo/Termii latency must not slow the admin action.
    // notifyOrderStatus never throws, so it can't break the update.
    if (!alreadyNotifiedPaymentStage) {
      const orderForNotify = freshOrder!
      after(async () => {
        try {
          await notifyOrderStatus(
            { ...orderForNotify, totalPrice: orderForNotify.totalPrice ?? payment.amount },
            'PAYMENT_VERIFIED'
          )
        } catch (e) {
          console.error('Payment-verified notification failed:', e)
        }
      })
    }
  }

  // ----- Reject: tell the customer what to do next -----
  // This email must land, otherwise a rejected transfer leaves them silently
  // stuck. Also after() — the admin's click should feel instant.
  if (status === 'REJECTED' && payment.order && freshOrder) {
    const orderForNotify = freshOrder!
    after(async () => {
      try {
        await notifyPaymentRejected({
          ...orderForNotify,
          totalPrice: orderForNotify.totalPrice ?? payment.amount,
        })
      } catch (e) {
        console.error('Payment-rejected notification failed:', e)
      }
    })
  }

  return NextResponse.json({ payment: updated, order: freshOrder })
}
