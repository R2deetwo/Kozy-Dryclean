
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const EMAIL = process.env.PROBE_EMAIL!

async function main() {
  const user = await db.user.findUnique({ where: { email: EMAIL } })
  console.log('=== USER ===')
  console.log(JSON.stringify(user ? {
    id: user.id, email: user.email, name: user.name, role: user.role,
    emailVerified: user.emailVerified, createdAt: user.createdAt,
  } : null, null, 2))

  if (user) {
    const subs = await db.subscription.findMany({
      where: { userId: user.id },
      include: { plan: true },
      orderBy: { createdAt: 'asc' },
    })
    console.log('=== SUBSCRIPTIONS FOR TEST USER ===')
    for (const s of subs) {
      console.log(JSON.stringify({
        id: s.id, planCode: s.plan?.code, planName: s.plan?.name,
        status: s.status, paymentMethod: s.paymentMethod,
        paystackRef: s.paystackRef, transferReceipt: s.transferReceipt ? 'attached' : null,
        pricePaid: s.pricePaid, periodStart: s.periodStart, periodEnd: s.periodEnd,
        createdAt: s.createdAt, cancelledAt: s.cancelledAt,
      }, null, 2))
      const evts = await db.subscriptionEvent.findMany({
        where: { subscriptionId: s.id },
        orderBy: { createdAt: 'asc' },
      })
      console.log('--- events for ' + s.id + ' ---')
      for (const e of evts) {
        console.log(JSON.stringify({
          kind: e.kind, delta: e.delta, count: e.count,
          note: e.note, meta: e.meta ? String(e.meta).slice(0, 220) : null,
          createdAt: e.createdAt,
        }))
      }
    }
    const payments = await db.payment.findMany({
      where: { order: { userId: user.id } },
      orderBy: { createdAt: 'desc' }, take: 5,
    })
    console.log('=== ORDER PAYMENTS (test user) ===')
    console.log(JSON.stringify(payments.map(p => ({
      id: p.id, amount: p.amount, method: p.method, status: p.status,
      ref: p.paystackRef, createdAt: p.createdAt,
    })), null, 2))
  }

  console.log('=== LAST 12 SUBSCRIPTIONS (any user) ===')
  const recent = await db.subscription.findMany({
    include: { plan: true, user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' }, take: 12,
  })
  for (const s of recent) {
    console.log(JSON.stringify({
      email: s.user?.email, plan: s.plan?.code, status: s.status,
      method: s.paymentMethod, ref: s.paystackRef,
      pricePaid: s.pricePaid, created: s.createdAt,
      periodEnd: s.periodEnd,
    }))
  }
}
main().finally(() => db.$disconnect())
