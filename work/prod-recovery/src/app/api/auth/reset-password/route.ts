// =============================================================================
// POST /api/auth/reset-password — set new password with token
// =============================================================================
// Rate limited (10 attempts / 15 min per IP) as defense-in-depth, matching the
// forgot-password pattern. The token itself is a 32-byte random value that is
// not realistically brute-forceable — this guards against future
// token-generation regressions and keeps the auth endpoints consistent.

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { rateLimit, getClientIP } from '@/lib/rate-limit'

export async function POST(req: Request) {
  const ip = getClientIP(req)
  const limit = await rateLimit(`reset-pw:${ip}`, {
    max: 10,
    windowMs: 15 * 60 * 1000,
  })
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
    )
  }

  const { token, newPassword } = await req.json()

  if (!token || !newPassword) {
    return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 })
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const record = await db.verificationToken.findUnique({ where: { token } })
  if (!record) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
  }

  if (record.expires < new Date()) {
    await db.verificationToken.delete({ where: { id: record.id } })
    return NextResponse.json({ error: 'Token expired. Please request a new reset link.' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await db.user.update({
    where: { id: record.userId },
    data: { passwordHash },
  })

  await db.verificationToken.delete({ where: { id: record.id } })

  return NextResponse.json({ ok: true, message: 'Password reset successfully. You can now log in.' })
}
