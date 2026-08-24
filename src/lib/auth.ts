// =============================================================================
// Auth placeholder — Phase 3
// =============================================================================
// This is a TEMPORARY identity provider. Phase 4 will replace getSession() with
// NextAuth's getServerSession(). The RBAC logic in route handlers (checking
// session.user.role and session.user.id) will remain unchanged.
//
// How it works:
//   1. The demo AuthGate in customer-portal.tsx sets a cookie "kozy-user-id"
//      when a user signs in.
//   2. getSession() reads that cookie, looks up the user in Prisma.
//   3. Returns { user } or null.
//
// Security note: This is NOT secure for production. Cookies can be forged.
// Phase 4 replaces this with signed JWT sessions via NextAuth.
// =============================================================================

import { cookies } from 'next/headers'
import { db } from './db'
import type { User } from '@prisma/client'

export interface Session {
  user: User
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const userId = cookieStore.get('kozy-user-id')?.value

  if (!userId) return null

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return null

  return { user }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return session
}

export async function requireRole(...roles: string[]): Promise<Session> {
  const session = await requireSession()
  if (!roles.includes(session.user.role)) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return session
}
