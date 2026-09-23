// =============================================================================
// POST /api/rider-applications/[id]/decision — ADMIN only (phase 54)
// =============================================================================
// The approval step of the rider-onboarding pipeline:
//
//   { action: 'approve', email?, note? }
//     Email is required (prefilled from the application, editable in the
//     dialog — typos happen, and some applicants leave it blank because
//     they live on WhatsApp). Approving:
//       1. creates a DRIVER account with a system-generated password
//          (mustChangePassword — the rider sets their own at first
//          sign-in, exactly like staff invites), or re-arms an existing
//          DRIVER account if one already exists with that email;
//       2. emails the rider their WELCOME email: credentials + how the
//          first week works. The delivery outcome is returned so the
//          admin knows whether it landed;
//       3. marks the application APPROVED with userId + reviewedAt/By.
//     An email that belongs to an existing CUSTOMER/staff/admin account is
//     refused with guidance (one login per person) — the admin asks the
//     rider for a different address and retries.
//
//   { action: 'reject', note? }
//     Marks the application REJECTED with the internal note. Deliberately
//     QUIET — no automatic decline email; how (and whether) to tell the
//     applicant is the owner's call, made in person or by phone.
// =============================================================================

import { NextResponse, after } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { generatePassword } from '@/lib/passwords'
import { notifyRiderApproved, logStaffEvent } from '@/lib/notifications'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // ----- ADMIN-only (recruiting is an owner decision) -----
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user?.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Only an admin can approve or reject rider applications' },
      { status: 403 }
    )
  }

  const { id } = await params
  const application = await db.riderApplication.findUnique({ where: { id } })
  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const action: unknown = body?.action
  const note: unknown = body?.note
  const noteText =
    typeof note === 'string' ? note.trim().slice(0, 500) : ''
  const managerName = session.user?.name || 'Kozy Care'

  // ===================== REJECT =====================
  if (action === 'reject') {
    const updated = await db.riderApplication.update({
      where: { id },
      data: {
        status: 'REJECTED',
        decisionNote: noteText || null,
        reviewedAt: new Date(),
        reviewedById: session.user?.id,
      },
    })
    after(async () => {
      try {
        await logStaffEvent({
          type: 'RIDER_DECISION',
          title: 'Rider application declined',
          body: `${updated.fullName} (${updated.refCode ?? id}) was declined by ${managerName}.${
            noteText ? ` Note: ${noteText}` : ''
          } No email was sent to the applicant.`,
          staffEmail: session.user?.email ?? '',
          emailStatus: 'NONE',
          detail: { action: 'reject', applicationId: id },
          linkTab: 'riders',
        })
      } catch (e) {
        console.error('Rider-decision audit log failed:', e)
      }
    })
    return NextResponse.json({ application: updated })
  }

  // ===================== APPROVE =====================
  if (action !== 'approve') {
    return NextResponse.json(
      { error: 'Unknown action — expected "approve" or "reject".' },
      { status: 400 }
    )
  }

  // Email: from the request (admin may have corrected/added it), else the
  // application's. Required — the credentials email IS the onboarding.
  const emailRaw: unknown = body?.email ?? application.email
  const email =
    typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      {
        error:
          'An email address is required to approve — the rider-app sign-in is emailed to them. Add or correct the email and try again.',
      },
      { status: 400 }
    )
  }

  const existing = await db.user.findUnique({ where: { email } })

  // One login per person: a customer/staff/admin email cannot also become a
  // rider login. A DRIVER email is fine — it's a re-invite (re-approve after
  // a phone change, or a resend after a typo'd first attempt).
  if (existing && existing.role !== 'DRIVER') {
    const hint =
      existing.role === 'B2C' || existing.role === 'B2B'
        ? 'This email belongs to an existing customer account. Ask the rider for a different email address (they can create a free one), or keep their application pending and onboard them with a new address.'
        : 'This email already belongs to a console account. Riders need their own address.'
    return NextResponse.json(
      { error: `An account with ${email} already exists. ${hint}` },
      { status: 409 }
    )
  }

  // Create (or re-arm) the DRIVER account. The password is generated here,
  // hashed, emailed — and returned NOWHERE (phase-32 recipe).
  const password = generatePassword()
  const passwordHash = await bcrypt.hash(password, 10)

  let rider
  if (existing) {
    // Existing DRIVER: refresh the credentials + re-arm access. This is
    // also the "the welcome email bounced, I fixed the address, resend"
    // path — decision fields below are re-stamped on purpose.
    rider = await db.user.update({
      where: { id: existing.id },
      data: {
        name: application.fullName, // keep the account in step with the application
        passwordHash,
        mustChangePassword: true,
        emailVerified: new Date(),
        accessStatus: 'ACTIVE',
      },
    })
  } else {
    rider = await db.user.create({
      data: {
        email,
        name: application.fullName,
        phone: application.phone,
        role: 'DRIVER',
        passwordHash,
        emailVerified: new Date(), // admin-vouched — no verification loop
        accessStatus: 'ACTIVE',
        mustChangePassword: true,
      },
    })
  }

  // Deliver the welcome email BEFORE responding — the admin must know
  // whether it landed (same contract as the staff invite).
  const welcome = await notifyRiderApproved({
    to: email,
    name: application.fullName,
    password,
    managerName,
    refCode: application.refCode ?? 'KZR',
    lga: application.lga,
    note: noteText || undefined,
  })

  const updated = await db.riderApplication.update({
    where: { id },
    data: {
      status: 'APPROVED',
      email, // persist the address the account actually uses
      userId: rider.id,
      reviewedAt: new Date(),
      reviewedById: session.user?.id,
      decisionNote: noteText || null,
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, accessStatus: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  })

  after(async () => {
    try {
      await logStaffEvent({
        type: 'RIDER_DECISION',
        title: 'Rider approved — account created',
        body: `${application.fullName} (${application.refCode ?? id}) was approved by ${managerName}. A DRIVER account (${email}) was created with a system-generated password.${
          welcome.ok
            ? ' Welcome email delivered.'
            : ' Welcome email FAILED — password not delivered.'
        }`,
        staffEmail: session.user?.email ?? '',
        emailStatus: welcome.ok ? 'SENT' : 'FAILED',
        detail: { action: 'approve', applicationId: id, riderId: rider.id },
        linkTab: 'riders',
      })
    } catch (e) {
      console.error('Rider-decision audit log failed:', e)
    }
  })

  return NextResponse.json({
    application: updated,
    rider: { id: rider.id, email: rider.email },
    welcome: { ok: welcome.ok, error: welcome.error ?? null },
    hint: welcome.ok
      ? 'Welcome email sent. If the rider does not see it within a few minutes, ask them to check their spam or junk folder.'
      : 'The email could not be sent — the account exists but no password was delivered. Fix the address and approve again (it re-sends fresh credentials), or share the sign-in details with the rider directly.',
  })
}
