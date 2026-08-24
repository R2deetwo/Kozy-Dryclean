// =============================================================================
// GET /api/users/me — current user profile from session
// =============================================================================
// RBAC rules:
//   - Any authenticated user can view their own profile
//   - Returns the user object without sensitive fields
// =============================================================================

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Return the user object (Prisma User model has no passwordHash yet — Phase 4 will add it)
  const { ...user } = session.user

  return NextResponse.json({ user })
}
