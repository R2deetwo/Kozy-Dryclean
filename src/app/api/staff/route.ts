// =============================================================================
// /api/staff — staff-account management (phase 31), ADMIN only
// =============================================================================
// GET  : list every staff account (any status) for the Staff tab.
// POST : invite a staff member — the super admin sets their name, email,
//        phone and INITIAL password; the account is created ACTIVE and a
//        branded credentials email goes out immediately. The delivery
//        outcome is returned in the response so the admin KNOWS the
//        password reached the staff member (if Brevo failed, the UI says
//        so and the password can be handed over manually).
//
// RBAC: strictly requireRole('ADMIN') — staff cannot see or manage other
// staff, and customers can never enumerate console accounts.
// =============================================================================

import { NextResponse, after } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { CreateStaffSchema } from '@/lib/schemas'
import { notifyStaffInvite, logStaffEvent } from '@/lib/notifications'

const STAFF_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  accessStatus: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
} as const

// ----- GET /api/staff -----
export async function GET() {
  await requireRole('ADMIN')

  const staff = await db.user.findMany({
    where: { role: 'STAFF' },
    select: STAFF_SELECT,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })

  return NextResponse.json({ items: staff })
}

// ----- POST /api/staff (invite) -----
export async function POST(req: Request) {
  const session = await requireRole('ADMIN')

  const body = await req.json().catch(() => null)
  const parsed = CreateStaffSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json(
      {
        error:
          first?.message
            ? `${first.message}${first.path?.length ? ` (${first.path.join('.')})` : ''}`
            : 'Validation failed',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  const { name, email, phone, password, note } = parsed.data

  // Existing email? A staff account must not shadow a customer/admin login.
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    const hint =
      existing.role === 'STAFF'
        ? 'This person is already on the staff list — use Pause/Resume or Reset password instead of creating a second account.'
        : 'This email already belongs to an existing Kozy Care account. Staff need their own email address.'
    return NextResponse.json(
      { error: `An account with ${email} already exists. ${hint}` },
      { status: 409 }
    )
  }

  const passwordHash = await bcrypt.hash(password, 10)

  // Staff are admin-vouched: emailVerified is set at creation so the
  // credentials email is the ONLY email they need before signing in.
  const staff = await db.user.create({
    data: {
      email,
      name,
      phone,
      role: 'STAFF',
      passwordHash,
      emailVerified: new Date(),
      accessStatus: 'ACTIVE',
    },
    select: STAFF_SELECT,
  })

  // Deliver the credentials BEFORE responding — the admin must know whether
  // the email actually landed (if not, they hand the password over in person
  // or hit "Resend" after fixing the address). One email ≈ one second.
  const managerName = session.user?.name || 'Kozy Care'
  const invite = await notifyStaffInvite({
    to: email,
    name,
    password,
    managerName,
    note,
  })

  // Audit entry in the operations feed (admins see each other's invites).
  after(async () => {
    await logStaffEvent({
      type: 'STAFF_INVITE',
      title: 'Staff account created',
      body: `${name} (${email}) was invited to the staff console by ${managerName}.${
        invite.ok ? ' Credentials email delivered.' : ' Credentials email FAILED — password not delivered.'
      }`,
      staffEmail: email,
      emailStatus: invite.ok ? 'SENT' : 'FAILED',
      detail: { action: 'invite', managerName, ...(invite.ok ? {} : { error: invite.error }) },
    })
  })

  return NextResponse.json(
    { staff, invite: { ok: invite.ok, error: invite.error ?? null } },
    { status: 201 }
  )
}
