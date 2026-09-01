// =============================================================================
// PATCH /api/reviews/[id] — moderate a review (ADMIN only)
// =============================================================================
// Body: { action: 'approve' | 'unapprove' | 'hide' | 'unhide' }
//   approve   → isApproved = true  (approvedBy = the acting admin)
//   unapprove → isApproved = false (review stays in the DB for records)
//   hide      → isHidden   = true  (soft-hide from the public carousel)
//   unhide    → isHidden   = false
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ModerateReviewSchema } from '@/lib/schemas'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = ModerateReviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  }

  const { action } = parsed.data
  const now = new Date()
  const adminId = (session.user as any).id as string

  try {
    const existing = await db.review.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    const data =
      action === 'approve'
        ? { isApproved: true, approvedAt: now, approvedById: adminId }
        : action === 'unapprove'
          ? { isApproved: false, approvedAt: null, approvedById: null }
          : action === 'hide'
            ? { isHidden: true }
            : { isHidden: false }

    const review = await db.review.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
        order: { select: { id: true, orderNumber: true } },
      },
    })

    return NextResponse.json({ review })
  } catch (err) {
    console.error('PATCH /api/reviews/[id] failed:', err)
    return NextResponse.json(
      { error: 'Failed to update review' },
      { status: 500 }
    )
  }
}
