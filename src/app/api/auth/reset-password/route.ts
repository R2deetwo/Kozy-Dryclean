// =============================================================================
// POST /api/auth/reset-password — set new password with token
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
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
