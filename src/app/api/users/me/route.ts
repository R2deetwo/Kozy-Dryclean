// =============================================================================
// GET   /api/users/me — current user profile (LIVE from the database)
// PATCH /api/users/me — payout bank details (self-service, phase 72)
// =============================================================================
// RBAC rules:
//   - Any authenticated user can view their own profile
//   - Never returns sensitive fields (passwordHash, tokens)
//   - PATCH is DRIVER + PARTNER only, and only the payout bank fields:
//     riders are paid weekly per-stop earnings and partners monthly share
//     settlements — both settle to the account they enter here. Nothing
//     else about the profile is self-service-editable through this route
//     (name/phone changes go through the office, like every console role).
//
// Phase 31: this route now reads the DATABASE, not the JWT. The JWT lives
// for 30 days and can't reflect a pause/revoke — the admin console's
// heartbeat polls this endpoint every 60s and signs the user out the moment
// accessStatus is no longer ACTIVE (or the role changed since sign-in).
// The login page also uses this for its role-aware redirect, so a stale
// token role can never send a demoted user into a console they lost access
// to. Customer fields are unchanged for everyone else.
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = (session.user as any)?.id
  if (!id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Live record — role and accessStatus as they are RIGHT NOW.
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      company: true,
      address: true,
      emailVerified: true,
      accessStatus: true,
      // Phase 32: drives the forced set-your-own-password dialog in the
      // console (set at invite / password reset, cleared the moment the
      // user picks their own via POST /api/users/me/password).
      mustChangePassword: true,
      createdAt: true,
      // Phase 72: payout bank details (riders + partners) — own data, shown
      // back so the Account tab can display what the office will pay into.
      ...(session.user.role === 'DRIVER' || session.user.role === 'PARTNER'
        ? { bankName: true, bankAccountNumber: true, bankAccountName: true }
        : {}),
    },
  })

  if (!user) {
    // Account deleted while a session cookie was still alive.
    return NextResponse.json({ error: 'ACCOUNT_GONE' }, { status: 401 })
  }

  // Task 82 — the 12-hour console lease. The console heartbeat polls this
  // route every 60s; an expired ADMIN/STAFF sign-in returns 401 here so the
  // client signs the tab out itself (page middleware + every console API
  // enforce the same lease server-side). Customers are untouched.
  const role = (session.user as any)?.role
  const loginAt = (session.user as any)?.consoleLoginAt
  if (
    (role === 'ADMIN' || role === 'STAFF') &&
    typeof loginAt === 'number' &&
    Date.now() - loginAt * 1000 > 12 * 60 * 60 * 1000
  ) {
    return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 })
  }

  return NextResponse.json({ user })
}

// ---------------------------------------------------------------------------
// PATCH — payout bank details (phase 72)
// ---------------------------------------------------------------------------
// Nigerian NUBAN account numbers are 10 digits; we accept 8–12 digits to
// stay tolerant of wallets and legacy formats, and the office verifies the
// account NAME against the bank's records at payout time anyway. All three
// fields must be sent together — a half-entered account is how money goes
// to the wrong person, so the route refuses partial updates.
// ---------------------------------------------------------------------------
export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = session.user.role
  if (role !== 'DRIVER' && role !== 'PARTNER') {
    return NextResponse.json(
      { error: 'Only rider and partner accounts hold payout bank details.' },
      { status: 403 }
    )
  }

  const body = await req.json().catch(() => ({}))

  // Clearing is a first-class action ("I changed banks, remove it for now").
  if (body?.clearBank === true) {
    await db.user.update({
      where: { id: session.user.id },
      data: { bankName: null, bankAccountNumber: null, bankAccountName: null },
    })
    return NextResponse.json({ ok: true, bank: { set: false } })
  }

  const bankName = typeof body?.bankName === 'string' ? body.bankName.trim() : ''
  const bankAccountNumber =
    typeof body?.bankAccountNumber === 'string' ? body.bankAccountNumber.replace(/\s/g, '') : ''
  const bankAccountName = typeof body?.bankAccountName === 'string' ? body.bankAccountName.trim() : ''

  const bad = (error: string) => NextResponse.json({ error }, { status: 400 })
  if (!bankName || bankName.length < 2 || bankName.length > 60) {
    return bad('Bank name should be the bank you want your payouts sent to (e.g. GTBank).')
  }
  if (!/^\d{8,12}$/.test(bankAccountNumber)) {
    return bad('Account number should be 10 digits (as printed by your bank).')
  }
  if (!/^[A-Za-z][A-Za-z0-9 .'-]{2,}$/.test(bankAccountName)) {
    return bad('Account name should match the name on the bank account.')
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      bankName: bankName.slice(0, 60),
      bankAccountNumber,
      bankAccountName: bankAccountName.slice(0, 80),
    },
  })

  return NextResponse.json({
    ok: true,
    bank: {
      set: true,
      bankName: bankName.slice(0, 60),
      bankAccountNumber,
      bankAccountName: bankAccountName.slice(0, 80),
    },
  })
}
