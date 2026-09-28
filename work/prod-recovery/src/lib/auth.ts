// =============================================================================
// NextAuth configuration — Phase 4
// =============================================================================
// Replaces the cookie-based placeholder from Phase 3.
// Issues real signed JWT sessions stored in httpOnly cookies.
// =============================================================================

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from './db'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        })

        if (!user || !user.passwordHash) {
          return null
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValid) {
          return null
        }

        // Enforce email verification — don't issue a session for unverified users
        if (!user.emailVerified) {
          // Return a special error that the login page can distinguish from
          // "invalid credentials" without leaking whether the email exists.
          // Since we only get here AFTER a correct password match, it's safe
          // to tell this specific user that their email isn't verified.
          throw new Error('EMAIL_NOT_VERIFIED')
        }

        // ----- Staff-access gate (phase 31) -----
        // Console roles (ADMIN / STAFF / DRIVER) are policed at the door: a
        // paused or revoked account can NEVER obtain a session, even with
        // the correct password. Customer roles are unaffected — their
        // accessStatus is ignored. These error strings surface verbatim in
        // the login page's res.error (same mechanism as EMAIL_NOT_VERIFIED
        // above), so the staff member sees "your manager paused your
        // access" instead of a misleading "wrong password".
        if (user.role !== 'B2C' && user.role !== 'B2B') {
          if (user.accessStatus === 'PAUSED') {
            throw new Error('ACCOUNT_PAUSED')
          }
          if (user.accessStatus === 'REVOKED') {
            throw new Error('ACCOUNT_REVOKED')
          }
        }

        // Return the user object — NextAuth will put this in the JWT
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        } as any
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      // First sign-in: add role + id to the token
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      // Expose role + id on the session object
      if (session.user) {
        ;(session.user as any).id = token.id
        ;(session.user as any).role = token.role
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

// Helper to get the server session — used by API routes
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

export async function getSession() {
  return getServerSession(authOptions)
}

// Drop-in replacement for Phase 3's requireSession / requireRole
// so API route handlers don't need to change
export async function requireSession() {
  const session = await getSession()
  if (!session) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return session
}

export async function requireRole(...roles: string[]) {
  const session = await requireSession()
  const userRole = (session.user as any).role
  if (!roles.includes(userRole)) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  // ----- Live access check (phase 31) -----
  // JWT sessions are stateless and live for 30 days; without this, pausing
  // or revoking a staff member would only bite at their NEXT login. This
  // re-checks the database (cached briefly) on every console-role call so a
  // pause takes effect within ~60 seconds even for a signed-in user.
  const blocked = await verifyLiveAccess(session)
  if (blocked) {
    throw new Response(blocked.body, {
      status: blocked.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return session
}

// =============================================================================
// Live access verification (phase 31) — pause/revoke enforcement for the
// stateless JWT sessions the console uses.
// =============================================================================
// The 30-day JWT can't be invalidated by rotating a per-user secret, so the
// database is the source of truth. To keep the polling dashboard cheap, the
// lookup is cached per user for 60 seconds — worst case, a paused staff
// member keeps API access for one more minute, and the login page rejects
// them instantly on any future sign-in. The console's /api/users/me
// heartbeat uses the same values to sign them out client-side.
//
// Customer roles (B2C/B2B) skip the check entirely: their traffic is the bulk
// of all requests and they hold no console powers to police.

const ACCESS_CACHE_TTL_MS = 60_000
const accessCache = new Map<
  string,
  { role: string; accessStatus: string; expiresAt: number }
>()

/** Console roles whose accessStatus is policed. */
export const CONSOLE_ROLES = ['ADMIN', 'STAFF', 'DRIVER'] as const

/** Response (not thrown — returned) when the session's user must be blocked.
 *  null = access fine, carry on. */
export async function verifyLiveAccess(
  session: Awaited<ReturnType<typeof getSession>>
): Promise<Response | null> {
  if (!session) return null
  const role = (session.user as any)?.role as string | undefined
  const id = (session.user as any)?.id as string | undefined
  if (!role || !id) return null
  if (!CONSOLE_ROLES.includes(role as any)) return null

  const now = Date.now()
  let live = accessCache.get(id)
  if (!live || live.expiresAt <= now) {
    try {
      const user = await db.user.findUnique({
        where: { id },
        select: { role: true, accessStatus: true },
      })
      if (!user) {
        // Account deleted while a session was still alive — dead session.
        return blockedResponse(
          'ACCESS_REVOKED',
          'This account no longer exists. Please contact your manager.'
        )
      }
      live = {
        role: user.role,
        accessStatus: user.accessStatus ?? 'ACTIVE',
        expiresAt: now + ACCESS_CACHE_TTL_MS,
      }
      accessCache.set(id, live)
    } catch {
      // DB hiccup — fail OPEN for admins, closed for nobody. Blocking the
      // whole console over a transient read error would be worse than a
      // one-minute delay in enforcing a pause.
      return null
    }
  }

  // Role changed since sign-in (e.g. staff demoted) — the token is stale.
  if (live.role !== role) {
    return blockedResponse(
      'SESSION_STALE',
      'Your account role changed after you signed in. Please sign in again.'
    )
  }
  if (live.accessStatus === 'PAUSED') {
    return blockedResponse(
      'ACCESS_PAUSED',
      'Your access is paused. Please contact your manager at Kozy Care.'
    )
  }
  if (live.accessStatus === 'REVOKED') {
    return blockedResponse(
      'ACCESS_REVOKED',
      'Your access has been revoked. Please contact your manager at Kozy Care.'
    )
  }
  return null
}

function blockedResponse(code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}
