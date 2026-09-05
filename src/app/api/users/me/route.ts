// =============================================================================
// GET /api/users/me — current user profile (LIVE from the database)
// =============================================================================
// RBAC rules:
//   - Any authenticated user can view their own profile
//   - Never returns sensitive fields (passwordHash, tokens)
//
// Phase 31: this route now reads the DATABASE, not the JWT. The JWT lives
// for 30 days and can't reflect a pause/revoke — the admin console's
// heartbeat polls this endpoint every 60s and signs the user out the moment
// accessStatus is no longer ACTIVE (or the role changed since sign-in).
// The login page also uses this for its role-aware redirect, so a stale
// token role can never send a demoted user into a console they lost access
// to. Customer fields are unchanged for everyone else.
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = (session.user as any)?.id
  if (!id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Live record — role and accessStatus as they are RIGHT NOW.
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      company: true,
      address: true,
      emailVerified: true,
      accessStatus: true,
      // Phase 32: drives the forced set-your-own-password dialog in the
      // console (set at invite / password reset, cleared the moment the
      // user picks their own via POST /api/users/me/password).
      mustChangePassword: true,
      createdAt: true,
    },
  })

  if (!user) {
    // Account deleted while a session cookie was still alive.
    return NextResponse.json({ error: 'ACCOUNT_GONE' }, { status: 401 })
  }

  return NextResponse.json({ user })
}
