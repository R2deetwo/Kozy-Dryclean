// =============================================================================
// POST   /api/push/subscribe — turn ON stop notifications for this device
// DELETE /api/push/subscribe — turn them OFF (removes the registration)
// GET    /api/push/subscribe — is THIS device subscribed? (+ device list)
// =============================================================================
// The rider app calls POST with the browser's PushSubscription after the
// rider grants notification permission (Account → Notifications). One rider
// may register several devices — all of them get pinged when a stop is
// assigned. DELETE removes only THIS device's endpoint, never the others.
//
// RBAC: DRIVER (primary) + ADMIN (owner testing). A push registration is a
// personal thing — staff and customers have no business here.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

const SubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2048),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
  device: z.string().max(120).optional(),
})

const RATE = { max: 20, windowMs: 10 * 60 * 1000 }

async function requireRider() {
  const session = await getSession()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (session.user.role !== 'DRIVER' && session.user.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { userId: session.user.id }
}

export async function POST(req: Request) {
  const auth = await requireRider()
  if (auth.error) return auth.error

  const limit = await rateLimit(`push-sub:${auth.userId}`, RATE)
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many attempts — try again shortly.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = SubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid subscription', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { subscription, device } = parsed.data
  await db.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId: auth.userId,
      endpoint: subscription.endpoint,
      payload: JSON.stringify(subscription),
      device: device ?? null,
    },
    update: {
      userId: auth.userId, // a re-subscribe re-binds the endpoint to its owner
      payload: JSON.stringify(subscription),
      device: device ?? null,
    },
  })

  return NextResponse.json({ subscribed: true })
}

export async function DELETE(req: Request) {
  const auth = await requireRider()
  if (auth.error) return auth.error

  const body = await req.json().catch(() => null)
  const endpoint =
    typeof body?.subscription?.endpoint === 'string' ? body.subscription.endpoint : null
  if (!endpoint) {
    return NextResponse.json({ error: 'Missing subscription endpoint' }, { status: 400 })
  }

  // Only delete it if it belongs to the caller — one rider's toggle must
  // never unregister another rider's device.
  await db.pushSubscription.deleteMany({
    where: { endpoint, userId: auth.userId },
  })
  return NextResponse.json({ subscribed: false })
}

export async function GET() {
  const auth = await requireRider()
  if (auth.error) return auth.error

  const subs = await db.pushSubscription.findMany({
    where: { userId: auth.userId },
    select: { endpoint: true, device: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({
    count: subs.length,
    devices: subs.map((s) => ({
      device: s.device ?? 'This device',
      // Last 12 chars of the endpoint — enough for the rider app to match
      // "is this my current browser?" without exposing the full secret.
      hint: s.endpoint.slice(-12),
    })),
  })
}
