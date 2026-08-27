// =============================================================================
// POST /api/auth/check-account — does an account exist for this email?
// =============================================================================
// Used by the booking wizard's member gate: a guest trying to skip the
// condition-photo step enters their email and is routed to /login when an
// account already exists, or /signup when it doesn't — so they can come back
// to their saved basket and continue where they left off.
//
// The response only ever reveals existence (and whether the account has a
// password) — never any account details. Rate-limited per IP to blunt
// enumeration, mirroring the existing ACCOUNT_EXISTS behaviour of
// POST /api/orders (which already exposes the same signal at order time).
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, getClientIP } from '@/lib/rate-limit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  // ----- Rate limit: 30 checks per hour per IP -----
  const ip = getClientIP(req)
  const limit = await rateLimit(`check-account:${ip}`, {
    max: 30,
    windowMs: 60 * 60 * 1000,
  })
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
        },
      }
    )
  }

  // ----- Parse + validate -----
  let email = ''
  try {
    const body = await req.json()
    email = String(body?.email ?? '').trim().toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  // ----- Look up the account -----
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  })

  return NextResponse.json({
    exists: !!user,
    hasPassword: !!user?.passwordHash,
  })
}
