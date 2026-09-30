// =============================================================================
// Middleware — route protection (Phase 4; STAFF access added phase 31)
// =============================================================================
// Runs on EVERY request. Checks for NextAuth session cookie + role.
// Unauthenticated → redirect to /login
// Authenticated but wrong role → redirect to their correct portal
//
// Phase 31: /admin is now shared by ADMIN (full console) and STAFF (the
// operational side — the tab/route restrictions are layered client-side in
// the dashboard and server-side on every API route; this gate only decides
// who may through the DOOR).
//
// Task 82: the 12-hour console lease is ALSO enforced here, at the edge —
// an ADMIN/STAFF sign-in older than 12 hours cannot reach /admin at all
// (the page redirects to /login?expired=1 and every console API refuses
// with 403 SESSION_EXPIRED, so the heartbeat signs the tab out too).
// =============================================================================

import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

/** Task 82 — mirrors CONSOLE_SESSION_MAX_AGE_MS in src/lib/auth.ts (the
 *  edge runtime cannot import the server lib). 12 hours. */
const CONSOLE_LEASE_SEC = 12 * 60 * 60

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const role = token?.role as string | undefined
    const path = req.nextUrl.pathname

    // ----- Task 82: the console lease, at the edge -----
    // One browser = ONE Kozy session (the shared session cookie): signing
    // in as super admin replaces a customer session open in another tab,
    // and vice versa. The role gates below mean that shared session can
    // only ever open the doors its ROLE allows — a customer can never see
    // the console — and this lease means an admin sign-in left in a shared
    // browser dies within 12 hours instead of living for 30 days.
    const loginAt = typeof (token as any)?.consoleLoginAt === 'number' ? (token as any).consoleLoginAt : null
    const leaseExpired =
      (role === 'ADMIN' || role === 'STAFF') &&
      loginAt !== null &&
      Date.now() / 1000 - loginAt > CONSOLE_LEASE_SEC
    if (leaseExpired && (path.startsWith('/admin') || path.startsWith('/driver') || path.startsWith('/partner'))) {
      const url = new URL('/login', req.url)
      url.searchParams.set('expired', '1')
      return NextResponse.redirect(url)
    }

    // ----- Route access rules -----
    // /portal  → B2C or B2B only (customers)
    // /admin   → ADMIN or STAFF (the Atelier Console)
    // /driver  → DRIVER only
    // /partner → PARTNER only (the Kozy Network portal, phase 72)

    if (path.startsWith('/admin') && role !== 'ADMIN' && role !== 'STAFF') {
      // Wrong role → redirect to their correct portal
      if (role === 'DRIVER') return NextResponse.redirect(new URL('/driver', req.url))
      if (role === 'PARTNER') return NextResponse.redirect(new URL('/partner', req.url))
      if (role === 'B2C' || role === 'B2B') return NextResponse.redirect(new URL('/portal', req.url))
      return NextResponse.redirect(new URL('/login', req.url))
    }

    if (path.startsWith('/driver') && role !== 'DRIVER') {
      if (role === 'ADMIN' || role === 'STAFF') return NextResponse.redirect(new URL('/admin', req.url))
      if (role === 'PARTNER') return NextResponse.redirect(new URL('/partner', req.url))
      if (role === 'B2C' || role === 'B2B') return NextResponse.redirect(new URL('/portal', req.url))
      return NextResponse.redirect(new URL('/login', req.url))
    }

    if (path.startsWith('/partner') && role !== 'PARTNER') {
      if (role === 'ADMIN' || role === 'STAFF') return NextResponse.redirect(new URL('/admin', req.url))
      if (role === 'DRIVER') return NextResponse.redirect(new URL('/driver', req.url))
      if (role === 'B2C' || role === 'B2B') return NextResponse.redirect(new URL('/portal', req.url))
      return NextResponse.redirect(new URL('/login', req.url))
    }

    if (path.startsWith('/portal') && role !== 'B2C' && role !== 'B2B') {
      if (role === 'ADMIN' || role === 'STAFF') return NextResponse.redirect(new URL('/admin', req.url))
      if (role === 'DRIVER') return NextResponse.redirect(new URL('/driver', req.url))
      if (role === 'PARTNER') return NextResponse.redirect(new URL('/partner', req.url))
      return NextResponse.redirect(new URL('/login', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  matcher: ['/portal/:path*', '/admin/:path*', '/driver/:path*', '/partner/:path*'],
}
