// =============================================================================
// POST /api/admin/reset-account — BREAK-GLASS admin account provisioning.
// =============================================================================
// Why this exists: the sandbox cannot reach the production database
// (DATABASE_URL is encrypted), so a forgotten admin password would otherwise
// be unrecoverable without a Supabase console login. This route lets an
// operator with the one-time key (ADMIN_RESET_KEY env var) create or
// re-password an ADMIN account through the deployed app itself.
//
// Security model:
//   * If ADMIN_RESET_KEY is NOT set in the environment, the route returns
//     404 — it does not exist as far as anyone can tell. The key is only
//     set for the few minutes it is needed, then removed and the site
//     redeployed, so the door is closed again.
//   * The key is compared in constant time (timingSafeEqual).
//   * Heavy IP rate limiting on top of the key check.
//   * The response never echoes the password; audit details go to the
//     server log only.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { rateLimit, getClientIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

function keysMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  // ----- Gate 1: the one-time key. Unset => route "does not exist". -----
  const expected = process.env.ADMIN_RESET_KEY
  if (!expected) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const provided = req.headers.get('x-reset-key') ?? ''
  if (!provided || !keysMatch(provided, expected)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // ----- Gate 2: IP rate limit (defense in depth). -----
  const ip = getClientIP(req)
  const limit = await rateLimit(`admin-reset:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 })
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
  }

  // ----- Validate the payload. -----
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const name = String(body.name ?? 'Kozy Admin').trim() || 'Kozy Admin'
  const phone = String(body.phone ?? '+234 803 175 5230').trim()

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const passwordOk =
    password.length >= 10 && /[A-Za-z]/.test(password) && /[0-9]/.test(password)
  if (!emailOk || !passwordOk) {
    return NextResponse.json(
      { error: 'Provide a valid email and a password of at least 10 characters with letters and numbers.' },
      { status: 400 }
    )
  }

  // ----- Upsert the ADMIN account. -----
  const passwordHash = await bcrypt.hash(password, 10)
  const existing = await db.user.findUnique({ where: { email } })

  let action: 'created' | 'updated'
  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: { passwordHash, name, phone, role: 'ADMIN', emailVerified: new Date() },
    })
    action = 'updated'
  } else {
    await db.user.create({
      data: { email, name, phone, role: 'ADMIN', passwordHash, emailVerified: new Date() },
    })
    action = 'created'
  }

  console.log(`[admin-reset-account] ${action} ADMIN ${email} from IP ${ip} at ${new Date().toISOString()}`)

  return NextResponse.json({ ok: true, email, action })
}
