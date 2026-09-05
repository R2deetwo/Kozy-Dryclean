// =============================================================================
// PATCH /api/staff/[id] — manage an existing staff account (phase 31, ADMIN only)
// =============================================================================
// What the super admin can do here (the Staff tab drives all of it):
//   - PAUSE  : account stays, login + console APIs blocked within ~60s
//              (silent — the staff member is NOT emailed).
//   - RESUME : PAUSED/REVOKED -> ACTIVE, "your access is back on" email.
//   - REVOKE : permanently closed. No email (deliberate — the manager
//              decides how to communicate it). Revoked accounts can still
//              be re-activated later via the same Resume flow.
//   - RESET PASSWORD : new hash + re-sent credentials email (delivery
//              outcome returned to the caller, like the invite).
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

  const { name, phone, accessStatus, password } = parsed.data

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name
  if (phone !== undefined) updateData.phone = phone
  if (accessStatus !== undefined) updateData.accessStatus = accessStatus

  let newPassword: string | undefined
  if (password !== undefined) {
    newPassword = password
    updateData.passwordHash = await bcrypt.hash(password, 10)
    // A password reset also re-arms access: a revoked/paused member whose
    // credentials are being reset is clearly coming back to work.
    updateData.accessStatus = 'ACTIVE'
  }

  const updated = await db.user.update({
    where: { id },
    data: updateData,
    select: STAFF_SELECT,
  })

  const managerName = session.user?.name || 'Kozy Care'
  let emailResult: { ok: boolean; error?: string } | null = null

  // ----- Password reset: deliver the new credentials immediately -----
  if (newPassword) {
    emailResult = await notifyStaffInvite({
      to: staff.email,
      name: updated.name,
      password: newPassword,
      managerName,
      isReset: true,
    })
    after(async () => {
      await logStaffEvent({
        type: 'STAFF_INVITE',
        title: 'Staff password reset',
        body: `A new password was set for ${updated.name} (${staff.email}) by ${managerName}.${
          emailResult && emailResult.ok
            ? ' Credentials email delivered.'
            : ' Credentials email FAILED — password not delivered.'
        }`,
        staffEmail: staff.email,
        emailStatus: emailResult && emailResult.ok ? 'SENT' : 'FAILED',
        detail: { action: 'reset', managerName },
      })
    })
  }

  // ----- Access restored (PAUSED/REVOKED -> ACTIVE): tell them they're back -----
  if (!newPassword && accessStatus === 'ACTIVE' && staff.accessStatus !== 'ACTIVE') {
    emailResult = await notifyStaffAccessRestored({
      to: staff.email,
      name: updated.name,
      managerName,
    })
  }

  return NextResponse.json({
    staff: updated,
    email: emailResult ? { ok: emailResult.ok, error: emailResult.error ?? null } : null,
  })
}
