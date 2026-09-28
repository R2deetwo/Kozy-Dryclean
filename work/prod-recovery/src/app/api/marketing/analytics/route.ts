// =============================================================================
// GET /api/marketing/analytics — marketing dashboard stats (admin)
// =============================================================================
// Aggregates the numbers the Marketing tab's Analytics view shows:
// campaign totals, emails sent, open/click rates, list sizes and coupon
// redemption value. One endpoint, one round of aggregates — the tab renders
// instantly instead of firing six queries from the client.

import { NextResponse } from 'next/server'
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

export async function GET() {
  const guard = await guardAdmin()
  if (guard instanceof NextResponse) return guard

  const [
    totalCampaigns,
    sentCampaigns,
    totalEmailsSent,
    totalOpens,
    totalClicks,
    subscribers,
    optedInCustomers,
    couponUsages,
    couponUsageAgg,
    topCoupons,
    recentCampaigns,
  ] = await Promise.all([
    db.newsletterCampaign.count(),
    db.newsletterCampaign.count({ where: { status: 'SENT' } }),
    db.newsletterRecipient.count({ where: { deliveryStatus: 'SENT' } }),
    db.newsletterRecipient.count({ where: { openedAt: { not: null } } }),
    db.newsletterRecipient.count({ where: { clickedAt: { not: null } } }),
    db.newsletterSubscriber.count({ where: { optIn: true } }),
    db.user.count({ where: { marketingOptIn: true, role: { in: ['B2C', 'B2B'] } } }),
    db.discountUsage.count(),
    db.discountUsage.aggregate({ _sum: { discountAmount: true } }),
    db.discountUsage.groupBy({
      by: ['discountId'],
      _count: { _all: true },
      _sum: { discountAmount: true },
      orderBy: { _count: { discountId: 'desc' } },
      take: 5,
    }),
    db.newsletterCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        subject: true,
        segment: true,
        status: true,
        sentCount: true,
        openCount: true,
        clickCount: true,
        sentAt: true,
        createdAt: true,
      },
    }),
  ])

  // Attach names to the top-coupon aggregation rows
  const couponIds = topCoupons.map((c) => c.discountId)
  const couponRows = couponIds.length
    ? await db.discount.findMany({
        where: { id: { in: couponIds } },
        select: { id: true, name: true, code: true, type: true, value: true, active: true },
      })
    : []
  const couponById = new Map(couponRows.map((c) => [c.id, c]))

  const openRate = totalEmailsSent > 0 ? Math.round((totalOpens / totalEmailsSent) * 100) : 0
  const clickRate = totalEmailsSent > 0 ? Math.round((totalClicks / totalEmailsSent) * 100) : 0

  return NextResponse.json({
    totalCampaigns,
    sentCampaigns,
    totalEmailsSent,
    totalOpens,
    totalClicks,
    openRate,
    clickRate,
    subscribers,
    optedInCustomers,
    totalCouponUsages: couponUsages,
    totalDiscountGiven: couponUsageAgg._sum.discountAmount ?? 0,
    topCoupons: topCoupons.map((c) => {
      const d = couponById.get(c.discountId)
      return {
        id: c.discountId,
        name: d?.name ?? 'Deleted coupon',
        code: d?.code ?? null,
        type: d?.type ?? null,
        value: d?.value ?? null,
        active: d?.active ?? false,
        redemptions: c._count._all,
        totalDiscount: c._sum.discountAmount ?? 0,
      }
    }),
    recentCampaigns,
  })
}
