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
//     their memberships (with the full activity ledger — Task 82: this was
//     the silent FK failure — a member with a subscription could never be
//     deleted because the database rightly refuses to orphan the money
//     trail), their orders (with payments, receipts, status history,
//     condition photos and reviews), their verification tokens and driver
//     GPS record. Reviews this admin APPROVED on other customers' orders
//     survive — the approver link is simply detached.
//   - RIDERS WITH PAYOUT HISTORY are refused (Task 82): money the office
//     actually paid them is an audit trail that must outlive the account —
//     revoke the rider instead of deleting.
//   - The response reports exactly what was deleted, so the UI can show
//     "Removed 2 orders, 1 membership… " instead of a bare "done".
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

// =============================================================================
// PATCH /api/users/[id] — ADMIN: rider branch + employment-type assignment
// =============================================================================
// Phase 62: drivers get a home branch (Ogombo / Chevron Drive). Dispatch
// suggestions score branch-affinity, and the branch health cards count
// riders on duty per branch. DRIVER accounts only — a branch on any other
// role is meaningless and quietly ignored.
// Phase 69: employmentType — FULL_TIME riders are auto-assigned new pickups
// at booking; PART_TIME riders work the broadcast & claim pool. Both fields
// are partial: send one, the other, or both.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const user = await db.user.findUnique({ where: { id } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (user.role !== 'DRIVER') {
    return NextResponse.json(
      { error: 'Branch and employment-type assignment applies to rider accounts only.' },
      { status: 400 }
    )
  }

  const data: Record<string, unknown> = {}

  // null clears the assignment; a string must reference a real branch.
  if (body?.branchId !== undefined) {
    let branchId: string | null = null
    if (typeof body?.branchId === 'string' && body.branchId) {
      const branch = await db.branch.findUnique({ where: { id: body.branchId } })
      if (!branch) {
        return NextResponse.json({ error: 'Branch not found' }, { status: 400 })
      }
      branchId = branch.id
    }
    data.branchId = branchId
  }

  // Employment type: FULL_TIME (auto-assigned) | PART_TIME (claim pool).
  // Null/absent leaves it untouched.
  if (body?.employmentType === 'FULL_TIME' || body?.employmentType === 'PART_TIME') {
    data.employmentType = body.employmentType
  } else if (body?.employmentType === null) {
    data.employmentType = null
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: 'Nothing to update — send branchId and/or employmentType.' },
      { status: 400 }
    )
  }

  const updated = await db.user.update({
    where: { id },
    data,
    select: { id: true, name: true, role: true, branchId: true, employmentType: true },
  })

  return NextResponse.json({ user: updated })
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
  const [orderCount, reviewCount, subscriptionCount, payoutCount] = await Promise.all([
    db.order.count({ where: { userId: id } }),
    db.review.count({ where: { userId: id } }),
    db.subscription.count({ where: { userId: id } }),
    db.riderPayout.count({ where: { riderId: id } }),
  ])

  // ----- Task 82: rider money guard (BEFORE the transaction) -----
  // A rider the office has actually PAID carries a financial audit trail
  // that must outlive their account — deleting it would erase who was paid,
  // how much and when. Revoke their access instead.
  if (payoutCount > 0) {
    return NextResponse.json(
      {
        error: `${user.name} has ${payoutCount} payout record${payoutCount === 1 ? '' : 's'} in the books — money history must be kept. Pause or revoke their access from the Team → Riders tab instead of deleting.`,
      },
      { status: 400 }
    )
  }

  // ----- Cascade delete (single transaction: all-or-nothing) -----
  try {
    const deleted = await db.$transaction(async (tx) => {
      // 0. Task 82 — detach every audit link this user's WORK left on rows
      //    that must SURVIVE (payments they verified, statuses they moved,
      //    anomalies they raised, payouts/settlements they recorded, ledger
      //    rows they adjusted). These FKs are nullable; the DB would SET NULL
      //    most of them, but detaching explicitly keeps the order of
      //    operations obvious and the behaviour identical everywhere.
      await tx.subscriptionEvent.updateMany({
        where: { recordedById: id },
        data: { recordedById: null },
      })
      await tx.payment.updateMany({ where: { verifiedById: id }, data: { verifiedById: null } })
      await tx.statusEvent.updateMany({ where: { actorId: id }, data: { actorId: null } })
      await tx.orderAnomaly.updateMany({ where: { actorId: id }, data: { actorId: null } })
      await tx.riderPayout.updateMany({ where: { recordedById: id }, data: { recordedById: null } })
      await tx.partnerSettlement.updateMany({ where: { recordedById: id }, data: { recordedById: null } })

      // 1. Detach approvals this user made AS ADMIN on other customers'
      //    reviews (those reviews belong to other orders and must survive —
      //    only the "approved by" attribution is cleared).
      await tx.review.updateMany({
        where: { approvedById: id },
        data: { approvedById: null },
      })

      // 2. Task 82 — the membership trail: the activity ledger FIRST (its
      //    subscriptionId FK is RESTRICT), then the memberships themselves
      //    (kits, pending switches, receipts — nothing of the money path
      //    survives half-deleted). This is what used to blow the whole
      //    transaction up with a foreign-key error whenever the customer
      //    held a membership or a pending request.
      const eventsRemoved = await tx.subscriptionEvent.deleteMany({
        where: { subscription: { userId: id } },
      })
      const subscriptionsRemoved = await tx.subscription.deleteMany({
        where: { userId: id },
      })

      // 3. Verification tokens (their pending email-verification links die
      //    with the account).
      await tx.verificationToken.deleteMany({ where: { userId: id } })

      // 4. Driver GPS record (only exists if this was a rider).
      await tx.driverLocation.deleteMany({ where: { driverId: id } })

      // 5. Their orders — cascades within the DB remove each order's
      //    payments (with receipt screenshots), status events, garment
      //    condition photos, and any review attached to those orders.
      const ordersRemoved = await tx.order.deleteMany({ where: { userId: id } })

      // 6. Any remaining reviews they authored (safety net — normally the
      //    order cascade above already took them).
      const reviewsRemoved = await tx.review.deleteMany({ where: { userId: id } })

      // 7. Finally the user row itself. Orders they merely DROVE (driverId)
      //    stay with the business — the optional driver link nulls itself.
      await tx.user.delete({ where: { id } })

      return {
        orders: ordersRemoved.count,
        reviews: reviewsRemoved.count,
        subscriptions: subscriptionsRemoved.count,
        events: eventsRemoved.count,
      }
    })

    console.log(
      `[CRM] Admin ${session.user?.email} deleted user ${user.email} (${user.id}) — ` +
        `${deleted.orders} order(s), ${deleted.subscriptions} membership(s), ${deleted.events} ledger row(s), ${deleted.reviews} review(s), payments included. ` +
        `Pre-check counts: orders=${orderCount} reviews=${reviewCount} subs=${subscriptionCount}`
    )

    return NextResponse.json({
      ok: true,
      deleted: {
        orders: deleted.orders,
        reviews: deleted.reviews,
        memberships: deleted.subscriptions,
        // payments ride along with the orders (DB cascade) — report the
        // pre-count we can compute cheaply
        payments: orderCount,
      },
    })
  } catch (e: any) {
    console.error('User deletion failed:', e)
    // Task 82: name the likeliest cause instead of a bare "failed" — the
    // admin should be able to act without calling support.
    const constraint = String(e?.meta?.message ?? e?.message ?? '')
    const hint = constraint.includes('foreign key')
      ? ' A record still linked to this account blocked it — nothing was removed.'
      : ''
    return NextResponse.json(
      {
        error:
          'The deletion failed and NOTHING was removed (all-or-nothing transaction).' +
          hint +
          ' Please try again or contact support.',
      },
      { status: 500 }
    )
  }
}
