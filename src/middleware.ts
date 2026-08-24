// =============================================================================
// Middleware — route protection (Phase 4)
// =============================================================================
// Runs on EVERY request. Checks for NextAuth session cookie + role.
// Unauthenticated → redirect to /login
// Authenticated but wrong role → redirect to their correct portal
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
    // /admin   → ADMIN only
    // /driver  → DRIVER only

    if (path.startsWith('/admin') && role !== 'ADMIN') {
      // Wrong role → redirect to their correct portal
      if (role === 'DRIVER') return NextResponse.redirect(new URL('/driver', req.url))
      if (role === 'B2C' || role === 'B2B') return NextResponse.redirect(new URL('/portal', req.url))
      return NextResponse.redirect(new URL('/login', req.url))
    }

    if (path.startsWith('/driver') && role !== 'DRIVER') {
      if (role === 'ADMIN') return NextResponse.redirect(new URL('/admin', req.url))
      if (role === 'B2C' || role === 'B2B') return NextResponse.redirect(new URL('/portal', req.url))
      return NextResponse.redirect(new URL('/login', req.url))
    }

    if (path.startsWith('/portal') && role !== 'B2C' && role !== 'B2B') {
      if (role === 'ADMIN') return NextResponse.redirect(new URL('/admin', req.url))
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
