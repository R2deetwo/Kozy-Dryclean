// =============================================================================
// GET /api/push/key — the public VAPID key for browser push subscriptions
// =============================================================================
// The rider app needs the application server key to subscribe the browser to
// stop notifications (Account → Notifications). Public by design — a VAPID
// public key is safe to expose; only the private half (never served) signs
// the pushes.
//
// RBAC: DRIVER (primary user) and ADMIN (so the owner can test) — anyone
// else gets a 403. Returns { publicKey } or { available: false } when push
// is not configured, so the rider app can show an honest "unavailable" state
// instead of a broken toggle.

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'DRIVER' && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY
  if (!publicKey) {
    return NextResponse.json({ available: false })
  }
  return NextResponse.json({ available: true, publicKey })
}
