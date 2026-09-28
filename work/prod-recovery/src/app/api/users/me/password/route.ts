// =============================================================================
// POST /api/users/me/password — set your own password (phase 32)
// =============================================================================
// The missing half of the invite flow: the system generates the initial
// password and emails it (the owner never sees it), and THIS is where the
// staff member — or any signed-in user — replaces it with something only
// they know. The console shows a non-dismissible dialog while
// mustChangePassword is set, and this endpoint clears that flag.
//
// Rules:
//   - Any authenticated user may change THEIR OWN password here.
//   - The CURRENT password must be presented and match — an open browser
//     tab (or a stolen JWT cookie) must never be enough to take over an
//     account. First factor stays required.
//   - New password must pass the same strength floor as staff passwords
//     (min 10 chars, 2+ character classes) — enforced by ChangePasswordSchema.
//   - Brute-force clamp: 5 wrong-current-password attempts per user per 15
//     minutes (in-memory, same spirit as the booking limiter). The 30-day
//     session keeps working regardless — this is not a lockout, just a
//     guessing clamp.
//   - Console roles are still live-checked (a paused staff member cannot
//     change their password while paused).
// =============================================================================

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { getSession, verifyLiveAccess } from '@/lib/auth'
import { ChangePasswordSchema } from '@/lib/schemas'

// ----- Small in-memory attempt clamp (per user, process-wide) -----
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
const attempts = new Map<string, { count: number; windowStart: number }>()

function tooManyAttempts(userId: string): boolean {
  const now = Date.now()
  const rec = attempts.get(userId)
  if (!rec || now - rec.windowStart > ATTEMPT_WINDOW_MS) {
    attempts.set(userId, { count: 0, windowStart: now })
    return false
  }
  return rec.count >= MAX_ATTEMPTS
}

function recordFailedAttempt(userId: string): void {
  const now = Date.now()
  const rec = attempts.get(userId)
  if (!rec || now - rec.windowStart > ATTEMPT_WINDOW_MS) {
    attempts.set(userId, { count: 1, windowStart: now })
    return
  }
  rec.count += 1
}

function clearAttempts(userId: string): void {
  attempts.delete(userId)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = (session.user as any)?.id
  const role = (session.user as any)?.role as string | undefined
  if (!id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Console roles: respect pause/revoke even here (a paused staff member
  // must not be able to arm a NEW password they could later use).
  if (role === 'ADMIN' || role === 'STAFF' || role === 'DRIVER') {
    const blocked = await verifyLiveAccess(session)
    if (blocked) {
      return new NextResponse(blocked.body, {
        status: blocked.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const body = await req.json().catch(() => null)
  const parsed = ChangePasswordSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json(
      { error: first?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  const { currentPassword, newPassword } = parsed.data

  const user = await db.user.findUnique({
    where: { id },
    select: { passwordHash: true, mustChangePassword: true },
  })
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  if (tooManyAttempts(id)) {
    return NextResponse.json(
      {
        error:
          'Too many attempts with the wrong current password. Try again in 15 minutes — or use “Forgot password?” on the sign-in page.',
      },
      { status: 429 }
    )
  }

  const matches = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!matches) {
    recordFailedAttempt(id)
    return NextResponse.json(
      { error: 'That current password is not correct. Nothing was changed.' },
      { status: 401 }
    )
  }

  // Same password as before? Nothing to do (and no flag change).
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    return NextResponse.json(
      { error: 'That is already your current password. Pick a new one.' },
      { status: 400 }
    )
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await db.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: false },
  })

  clearAttempts(id)

  return NextResponse.json({ ok: true })
}
