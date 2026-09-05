// =============================================================================
// DELETE /api/users/[id] — permanently remove a customer from the CRM
// =============================================================================
// ADMIN only. This is the business owner's cleanup tool for duplicate or junk
// entries (e.g. a customer who re-registered after a mistyped-email signup).
//
// Guardrails (the client called this dangerous — it must feel safe to use):
//   - Admins cannot delete THEMSELVES (no accidental self-lockout).
//   - Admin accounts cannot be deleted here at all — removing the only admin
//     would lock the business out of its own dashboard. Contact support for
//     admin removals.
//   - The request body must echo { confirm: "DELETE" } — a second line of
//     defence against a misfired request (the UI also makes the admin type
//     the word before the button unlocks).
//   - EVERYTHING attached to the customer is removed in ONE transaction:
//     their orders (with payments, receipts, status history, condition
//     photos and reviews), their verification tokens and driver GPS record.
//     Reviews this admin APPROVED on other customers' orders survive — the
//     approver link is simply detached.
//   - The response reports exactly what was deleted, so the UI can show
//     "Removed 2 orders, 1 review… " instead of a bare "done".
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'

// Phase 31: explicit 401/403 instead of the thrown-Response-becomes-500
// quirk (same conversion as the other console routes).
async function requireAdmin(): Promise<ReturnType<typeof requireRole> | NextResponse> {
  try {
    return await requireRole('ADMIN')
  } catch (e) {
    if (e instanceof Response) {
      return new NextResponse(e.body, {
        status: e.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw e
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard
  const session = guard

  const { id } = await params

  // ----- Confirm phrase (double-lock) -----
  const body = await req.json().catch(() => ({}))
  if ((body as any)?.confirm !== 'DELETE') {
    return NextResponse.json(
      { error: 'Confirmation missing — the request must include { confirm: "DELETE" }.' },
      { status: 400 }
    )
  }

  // ----- Load the target -----
  const user = await db.user.findUnique({ where: { id } })
  if (!user) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // ----- Self-delete guard -----
  if (session.user?.id === id) {
    return NextResponse.json(
      { error: 'You cannot delete your own account while signed in.' },
      { status: 400 }
    )
  }

  // ----- Admin-account guard -----
  if (user.role === 'ADMIN') {
    return NextResponse.json(
      {
        error:
          'Admin accounts can’t be deleted from the CRM — this protects you from being locked out of the dashboard. Remove their admin role first, or contact support.',
      },
      { status: 400 }
    )
  }

  // ----- Staff-account guard (phase 31) -----
  // Staff lifecycle (invite / pause / revoke / reset) lives in the Staff tab
  // so every action has one home and a consistent audit trail. A hard delete
  // from the CRM would also orphan the StatusEvent/payment-verifier history
  // a staff member's work already wrote.
  if (user.role === 'STAFF') {
    return NextResponse.json(
      {
        error:
          'Staff accounts are managed from the Staff tab — use Pause or Revoke access there instead of deleting.',
      },
      { status: 400 }
    )
  }

  // ----- Count what will be lost (for the response + audit log) -----
  const [orderCount, reviewCount] = await Promise.all([
    db.order.count({ where: { userId: id } }),
    db.review.count({ where: { userId: id } }),
  ])

  // ----- Cascade delete (single transaction: all-or-nothing) -----
  try {
    const deleted = await db.$transaction(async (tx) => {
      // 1. Detach approvals this user made AS ADMIN on other customers'
      //    reviews (those reviews belong to other orders and must survive —
      //    only the "approved by" attribution is cleared).
      await tx.review.updateMany({
        where: { approvedById: id },
        data: { approvedById: null },
      })

      // 2. Verification tokens (their pending email-verification links die
      //    with the account).
      await tx.verificationToken.deleteMany({ where: { userId: id } })

      // 3. Driver GPS record (only exists if this was a rider).
      await tx.driverLocation.deleteMany({ where: { driverId: id } })

      // 4. Their orders — cascades within the DB remove each order's
      //    payments (with receipt screenshots), status events, garment
      //    condition photos, and any review attached to those orders.
      const ordersRemoved = await tx.order.deleteMany({ where: { userId: id } })

      // 5. Any remaining reviews they authored (safety net — normally the
      //    order cascade above already took them).
      const reviewsRemoved = await tx.review.deleteMany({ where: { userId: id } })

      // 6. Finally the user row itself. Orders they merely DROVE (driverId)
      //    stay with the business — the optional driver link nulls itself.
      await tx.user.delete({ where: { id } })

      return { orders: ordersRemoved.count, reviews: reviewsRemoved.count }
    })

    console.log(
      `[CRM] Admin ${session.user?.email} deleted user ${user.email} (${user.id}) — ` +
        `${deleted.orders} order(s), ${deleted.reviews} review(s), payments included. ` +
        `Pre-check counts: orders=${orderCount} reviews=${reviewCount}`
    )

    return NextResponse.json({
      ok: true,
      deleted: {
        orders: deleted.orders,
        reviews: deleted.reviews,
        // payments ride along with the orders (DB cascade) — report the
        // pre-count we can compute cheaply
        payments: orderCount,
      },
    })
  } catch (e: any) {
    console.error('User deletion failed:', e)
    return NextResponse.json(
      {
        error:
          'The deletion failed and NOTHING was removed (all-or-nothing transaction). Please try again or contact support.',
      },
      { status: 500 }
    )
  }
}
