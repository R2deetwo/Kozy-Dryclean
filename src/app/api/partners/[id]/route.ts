// =============================================================================
// PATCH /api/partners/[id] — ADMIN partner decisions
// =============================================================================
//   approve  — welcome them into the network AND (phase 72) create their
//              PARTNER login, exactly like rider approval creates a DRIVER
//              account: system-generated password (mustChangePassword),
//              emailed credentials + portal link, account linked to the
//              partner record via userId. Branch + revenue share are set
//              here; both editable later.
//   reject   — decline with a note (kept for the record; quiet — no email)
//   suspend  — pause the flow of orders AND pause the linked login
//   reactivate — undo a suspension (orders + login)
//   update   — adjust branch / revenue share / contact details
//
// The password is generated here, hashed, emailed — and returned NOWHERE
// (phase-32 recipe). An email that belongs to an existing account of
// another role is refused with guidance (one login per person).
// =============================================================================

import { NextResponse, after } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { generatePassword } from '@/lib/passwords'
import { notifyPartnerApproved, logStaffEvent } from '@/lib/notifications'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function requireAdmin(): Promise<ReturnType<typeof requireRole> | NextResponse> {
  try {
    return await requireRole('ADMIN')
  } catch (e: any) {
    if (e instanceof Response) {
      return new NextResponse(e.body, {
        status: e.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const action = typeof body?.action === 'string' ? body.action : ''
  const managerName = (session as any)?.user?.name || 'Kozy Care'

  const partner = await db.partner.findUnique({ where: { id } })
  if (!partner) {
    return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
  }

  switch (action) {
    case 'approve': {
      // Branch must exist when provided.
      let branchId: string | null = null
      if (typeof body?.branchId === 'string' && body.branchId) {
        const branch = await db.branch.findUnique({ where: { id: body.branchId } })
        if (!branch) {
          return NextResponse.json({ error: 'Branch not found' }, { status: 400 })
        }
        branchId = branch.id
      }
      const shareRaw = Number(body?.revenueSharePartnerPct)
      const share =
        Number.isFinite(shareRaw) && shareRaw >= 0 && shareRaw <= 100 ? Math.round(shareRaw) : 70
      const note =
        typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : ''

      // ----- Phase 72: the PARTNER account (rider-approval recipe) -----
      // Email: from the request (admin may have corrected/added it), else
      // the application's. Required — the credentials email IS the onboarding.
      const emailRaw: unknown = body?.email ?? partner.email
      const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : ''
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json(
          {
            error:
              'An email address is required to approve — the partner-portal sign-in is emailed to them. Add or correct the email and try again.',
          },
          { status: 400 }
        )
      }

      const existing = await db.user.findUnique({ where: { email } })
      // One login per person: another role's email cannot become the
      // partner login. A PARTNER email is fine — re-approve (resend).
      if (existing && existing.role !== 'PARTNER') {
        const hint =
          existing.role === 'B2C' || existing.role === 'B2B'
            ? 'This email belongs to an existing customer account. Ask the partner for a different business email address.'
            : 'This email already belongs to a console or rider account. Partners need their own address.'
        return NextResponse.json(
          { error: `An account with ${email} already exists. ${hint}` },
          { status: 409 }
        )
      }
      // A PARTNER account that belongs to a DIFFERENT partner record would
      // corrupt the one-record-per-account link — refuse with guidance.
      if (existing?.role === 'PARTNER') {
        const other = await db.partner.findUnique({ where: { userId: existing.id } })
        if (other && other.id !== partner.id) {
          return NextResponse.json(
            {
              error: `${email} is already the login for another partner record (${other.businessName}). Use a different email for ${partner.businessName}.`,
            },
            { status: 409 }
          )
        }
      }

      const password = generatePassword()
      const passwordHash = await bcrypt.hash(password, 10)

      let account
      if (existing) {
        // Existing PARTNER account (re-approve after suspension, or a
        // resend after a bounced welcome email): refresh credentials +
        // re-arm access. Decision fields re-stamped on purpose.
        account = await db.user.update({
          where: { id: existing.id },
          data: {
            name: partner.contactName,
            phone: partner.phone,
            passwordHash,
            mustChangePassword: true,
            emailVerified: new Date(),
            accessStatus: 'ACTIVE',
          },
        })
      } else {
        account = await db.user.create({
          data: {
            email,
            name: partner.contactName,
            phone: partner.phone,
            role: 'PARTNER',
            passwordHash,
            emailVerified: new Date(), // admin-vouched — no verification loop
            accessStatus: 'ACTIVE',
            mustChangePassword: true,
          },
        })
      }

      // Deliver the welcome email BEFORE responding — the admin must know
      // whether it landed (same contract as rider/staff approval).
      const welcome = await notifyPartnerApproved({
        to: email,
        businessName: partner.businessName,
        contactName: partner.contactName,
        password,
        managerName,
        refCode: partner.refCode ?? 'KZP',
        sharePct: share,
        note: note || undefined,
      })

      const updated = await db.partner.update({
        where: { id },
        data: {
          status: 'APPROVED',
          branchId,
          revenueSharePartnerPct: share,
          email, // persist the address the account actually uses
          userId: account.id,
          reviewedAt: new Date(),
          reviewNote: note || partner.reviewNote,
        },
      })

      after(async () => {
        try {
          await logStaffEvent({
            type: 'PARTNER_DECISION',
            title: `Partner approved — portal account created`,
            body: `${updated.businessName} (${updated.refCode ?? id}) was approved by ${managerName} (${share}% partner share${branchId ? ', branch-assigned' : ''}). A PARTNER account (${email}) was created with a system-generated password. ${
              welcome.ok
                ? 'Welcome email delivered.'
                : 'Welcome email FAILED — password not delivered.'
            }`,
            staffEmail: (session as any)?.user?.email ?? '',
            emailStatus: welcome.ok ? 'SENT' : 'FAILED',
            detail: { action: 'approve', partnerId: id, userId: account.id },
            linkTab: 'partners',
          })
        } catch (e) {
          console.error('[partners] decision audit log failed:', e)
        }
      })

      return NextResponse.json({
        partner: { ...updated, account: { id: account.id, email: account.email, accessStatus: account.accessStatus } },
        account: { id: account.id, email: account.email },
        welcome: { ok: welcome.ok, error: welcome.error ?? null },
        hint: welcome.ok
          ? 'Welcome email sent — the partner signs into /partner with the emailed credentials and sets their own password.'
          : 'The email could not be sent — the account exists but no password was delivered. Fix the address and approve again (it re-sends fresh credentials), or share the sign-in details with the partner directly.',
      })
    }

    case 'reject': {
      const updated = await db.partner.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewNote:
            typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : partner.reviewNote,
        },
      })
      after(async () => {
        try {
          await logStaffEvent({
            type: 'PARTNER_DECISION',
            title: 'Partner application declined',
            body: `${updated.businessName} (${updated.refCode ?? id}) was declined by ${managerName}. No email was sent to the applicant.`,
            staffEmail: (session as any)?.user?.email ?? '',
            emailStatus: 'NONE',
            detail: { action: 'reject', partnerId: id },
            linkTab: 'partners',
          })
        } catch (e) {
          console.error('[partners] decision audit log failed:', e)
        }
      })
      return NextResponse.json({ partner: updated })
    }

    case 'suspend': {
      const updated = await db.partner.update({
        where: { id },
        data: {
          status: 'SUSPENDED',
          reviewedAt: new Date(),
          reviewNote:
            typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : partner.reviewNote,
        },
      })
      // Pause the linked login too — suspension means the partner cannot
      // work orders, and the portal is where they would.
      if (partner.userId) {
        await db.user.update({
          where: { id: partner.userId },
          data: { accessStatus: 'PAUSED' },
        }).catch(() => {})
      }
      after(async () => {
        try {
          await logStaffEvent({
            type: 'PARTNER_DECISION',
            title: 'Partner suspended',
            body: `${updated.businessName} was suspended by ${managerName}. Order routing and the partner login are paused; the ledger and history are untouched.`,
            staffEmail: (session as any)?.user?.email ?? '',
            emailStatus: 'NONE',
            detail: { action: 'suspend', partnerId: id },
            linkTab: 'partners',
          })
        } catch (e) {
          console.error('[partners] decision audit log failed:', e)
        }
      })
      return NextResponse.json({ partner: updated })
    }

    case 'reactivate': {
      const updated = await db.partner.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewNote:
            typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : partner.reviewNote,
        },
      })
      if (partner.userId) {
        await db.user.update({
          where: { id: partner.userId },
          data: { accessStatus: 'ACTIVE' },
        }).catch(() => {})
      }
      return NextResponse.json({ partner: updated })
    }

    case 'update': {
      const data: Record<string, unknown> = {}
      if (typeof body?.branchId === 'string') {
        const branch = body.branchId
          ? await db.branch.findUnique({ where: { id: body.branchId } })
          : null
        data.branchId = branch?.id ?? null
      }
      const shareRaw = Number(body?.revenueSharePartnerPct)
      if (Number.isFinite(shareRaw) && shareRaw >= 0 && shareRaw <= 100) {
        data.revenueSharePartnerPct = Math.round(shareRaw)
      }
      if (typeof body?.phone === 'string' && body.phone.trim().length >= 7) {
        data.phone = body.phone.trim()
      }
      if (typeof body?.address === 'string' && body.address.trim()) {
        data.address = body.address.trim()
      }
      if (typeof body?.capacityNotes === 'string') {
        data.capacityNotes = body.capacityNotes.trim().slice(0, 2000) || null
      }
      const updated = await db.partner.update({ where: { id }, data })
      return NextResponse.json({ partner: updated })
    }

    default:
      return NextResponse.json(
        { error: 'Unknown action', actions: ['approve', 'reject', 'suspend', 'reactivate', 'update'] },
        { status: 400 }
      )
  }
}
