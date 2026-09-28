// =============================================================================
// GET /api/reviews/admin — all reviews for the admin moderation view
// =============================================================================
// ADMIN only. Returns every review (pending, approved, low-rated, hidden)
// newest first, with the author's name and the order number for context.
// Starter marketing testimonials are NOT included — moderation is for real
// customer feedback only.
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const reviews = await db.review.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        order: { select: { id: true, orderNumber: true } },
      },
    })

    // The Review model stores driverId without a Prisma relation — resolve
    // driver names with a targeted lookup so the UI can show them.
    const driverIds = [...new Set(reviews.map((r) => r.driverId).filter(Boolean))] as string[]
    const drivers = driverIds.length
      ? await db.user.findMany({
          where: { id: { in: driverIds } },
          select: { id: true, name: true },
        })
      : []
    const driverById = new Map(drivers.map((d) => [d.id, d]))

    const withDrivers = reviews.map((r) => ({
      ...r,
      driver: r.driverId ? driverById.get(r.driverId) ?? null : null,
    }))

    return NextResponse.json({ reviews: withDrivers })
  } catch (err) {
    console.error('GET /api/reviews/admin failed:', err)
    return NextResponse.json(
      { error: 'Failed to load reviews' },
      { status: 500 }
    )
  }
}
