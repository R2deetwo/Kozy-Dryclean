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
// =============================================================================

import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const role = token?.role as string | undefined
    const path = req.nextUrl.pathname

    // ----- Route access rules -----
    // /portal  → B2C or B2B only (customers)
    // /admin   → ADMIN or STAFF (the Atelier Console)
    // /driver  → DRIVER only

    if (path.startsWith('/admin') && role !== 'ADMIN' && role !== 'STAFF') {
      // Wrong role → redirect to their correct portal
      if (role === 'DRIVER') return NextResponse.redirect(new URL('/driver', req.url))
      if (role === 'B2C' || role === 'B2B') return NextResponse.redirect(new URL('/portal', req.url))
      return NextResponse.redirect(new URL('/login', req.url))
    }

    if (path.startsWith('/driver') && role !== 'DRIVER') {
      if (role === 'ADMIN' || role === 'STAFF') return NextResponse.redirect(new URL('/admin', req.url))
      if (role === 'B2C' || role === 'B2B') return NextResponse.redirect(new URL('/portal', req.url))
      return NextResponse.redirect(new URL('/login', req.url))
    }

    if (path.startsWith('/portal') && role !== 'B2C' && role !== 'B2B') {
      if (role === 'ADMIN' || role === 'STAFF') return NextResponse.redirect(new URL('/admin', req.url))
      if (role === 'DRIVER') return NextResponse.redirect(new URL('/driver', req.url))
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
  matcher: ['/portal/:path*', '/admin/:path*', '/driver/:path*'],
}
