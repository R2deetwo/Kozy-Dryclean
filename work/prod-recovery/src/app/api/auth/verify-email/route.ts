// =============================================================================
// POST /api/auth/verify-email — verify a user's email with a token
// GET  /api/auth/verify-email?token=xxx — same thing via link click
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  const { token } = await req.json()
  return verifyToken(token)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  return verifyToken(token)
}

async function verifyToken(token: string | null) {
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const record = await db.verificationToken.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!record) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  if (record.expires < new Date()) {
    await db.verificationToken.delete({ where: { id: record.id } })
    return NextResponse.json(
      { error: 'Token expired. Please request a new verification email.' },
      { status: 400 }
    )
  }

  // Mark the user as verified
  await db.user.update({
    where: { id: record.userId },
    data: { emailVerified: new Date() },
  })

  // Delete the token (one-time use)
  await db.verificationToken.delete({ where: { id: record.id } })

  return NextResponse.json({ ok: true, message: 'Email verified! You can now log in.' })
}
