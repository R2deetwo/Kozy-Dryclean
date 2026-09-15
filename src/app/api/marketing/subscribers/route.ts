// =============================================================================
// GET /api/marketing/subscribers — the email list (admin)
// =============================================================================
// Returns the footer-signup subscriber list + the count of opted-in
// customers, for the Marketing tab's Subscribers view. Supports ?q= search
// and ?take= paging (default 200, newest first).

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'

async function guardAdmin(): Promise<ReturnType<typeof requireRole> | NextResponse> {
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

export async function GET(req: NextRequest) {
  const guard = await guardAdmin()
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim().toLowerCase()
  const take = Math.min(Math.max(Number(searchParams.get('take')) || 200, 1), 500)

  const [subscribers, total, optedInCustomers, unsubscribed] = await Promise.all([
    db.newsletterSubscriber.findMany({
      where: q
        ? {
            OR: [{ email: { contains: q } }, { name: { contains: q } }],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take,
    }),
    db.newsletterSubscriber.count(),
    db.user.count({ where: { marketingOptIn: true, role: { in: ['B2C', 'B2B'] } } }),
    db.newsletterSubscriber.count({ where: { optIn: false } }),
  ])

  return NextResponse.json({
    subscribers,
    total,
    optedInCustomers,
    unsubscribed,
  })
}
