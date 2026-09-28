// =============================================================================
// PATCH /api/staff/[id] — manage an existing staff account (phase 31/32, ADMIN only)
// =============================================================================
// What the super admin can do here (the Staff tab drives all of it):
//   - PAUSE  : account stays, login + console APIs blocked within ~60s
//              (silent — the staff member is NOT emailed).
//   - RESUME : PAUSED/REVOKED -> ACTIVE, "your access is back on" email.
//   - REVOKE : permanently closed. No email (deliberate — the manager
//              decides how to communicate it). Revoked accounts can still
//              be re-activated later via the same Resume flow.
//   - RESET PASSWORD (phase 32): the SERVER generates a new password, emails
//              it to the staff member and re-arms access — the admin never
//              types or sees a password. mustChangePassword is set so the
//              console asks for a personally chosen one at next sign-in.
//   - rename / re-phone.
//
// Guardrails:
//   - Only role=STAFF rows are reachable here (admins and customers can
//     never be managed through this route).
//   - Pausing/revoking never deletes anything: the audit trail (StatusEvent
//     actor links, payment verifier trail) survives intact.
// =============================================================================

import { NextResponse, after } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { UpdateStaffSchema } from '@/lib/schemas'
import { generatePassword } from '@/lib/passwords'
import { notifyStaffInvite, notifyStaffAccessRestored, logStaffEvent } from '@/lib/notifications'

/** Same conversion as /api/staff: thrown 401/403 Responses must reach the
 *  client as real status codes, not empty 500s. */
async function requireAdmin(): Promise<ReturnType<typeof requireRole> | NextResponse> {
  try {
    return await requireRole('ADMIN')
  } catch (e) {
    if (e instanceof Response) {
      return new NextResponse(e.body, {
        status: e.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw e
  }
}

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard
  const session = guard
  const { id } = await params

  const staff = await db.user.findUnique({ where: { id } })
  if (!staff || staff.role !== 'STAFF') {
    return NextResponse.json(
      { error: 'Staff account not found' },
      { status: 404 }
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = UpdateStaffSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json(
      { error: first?.message ?? 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { name, phone, accessStatus, resetPassword } = parsed.data
  const managerName = session.user?.name || 'Kozy Care'

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name
  if (phone !== undefined) updateData.phone = phone
  if (accessStatus !== undefined) updateData.accessStatus = accessStatus

  // Phase 32: system-generated reset password. The admin asked for a reset,
  // not for a password they choose — the generated value is emailed straight
  // to the staff member and never leaves this handler.
  //
  // FAILURE-PROOF ORDERING: the email is sent BEFORE the DB is touched. If
  // delivery fails, nothing changes (their old password still works, the
  // admin can simply retry) — there is never an account whose new password
  // exists but was never delivered to anyone. A reset also re-arms access:
  // a revoked/paused member whose credentials are being reset is clearly
  // coming back to work.
  let plainPassword: string | undefined
  if (resetPassword) {
    plainPassword = generatePassword()
    const delivery = await notifyStaffInvite({
      to: staff.email,
      name: staff.name,
      password: plainPassword,
      managerName: session.user?.name || 'Kozy Care',
      isReset: true,
    })
    if (!delivery.ok) {
      return NextResponse.json(
        {
          error: `The credentials email to ${staff.email} could not be sent (${delivery.error ?? 'provider error'}). Nothing was changed — their current password still works. Try again in a moment.`,
        },
        { status: 502 }
      )
    }
    updateData.passwordHash = await bcrypt.hash(plainPassword, 10)
    updateData.mustChangePassword = true
    updateData.accessStatus = 'ACTIVE'
    after(async () => {
      await logStaffEvent({
        type: 'STAFF_INVITE',
        title: 'Staff password reset',
        body: `A new system-generated password was emailed to ${staff.name} (${staff.email}) by ${managerName} — they will set their own at next sign-in. Credentials email delivered.`,
        staffEmail: staff.email,
        emailStatus: 'SENT',
        detail: { action: 'reset', managerName },
      })
    })
  }

  const updated = await db.user.update({
    where: { id },
    data: updateData,
    select: STAFF_SELECT,
  })

  let emailResult: { ok: boolean; error?: string } | null = null

  // ----- Access restored (PAUSED/REVOKED -> ACTIVE): tell them they're back -----
  // (Password-reset restores access too, but that email already went out
  // above with the credentials — this branch is for plain Resume.)
  if (!plainPassword && accessStatus === 'ACTIVE' && staff.accessStatus !== 'ACTIVE') {
    emailResult = await notifyStaffAccessRestored({
      to: staff.email,
      name: updated.name,
      managerName,
    })
  }

  return NextResponse.json({
    staff: updated,
    email: emailResult ? { ok: emailResult.ok, error: emailResult.error ?? null } : null,
    // Spam-check guidance for resets (the client asked for exactly this).
    hint: plainPassword
      ? 'New password emailed. If they do not see it within a few minutes, ask them to check their spam or junk folder.'
      : undefined,
  })
}
