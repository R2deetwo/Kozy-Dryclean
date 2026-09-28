'use client'

// =============================================================================
// StaffView (phase 31) — super-admin staff management tab
// =============================================================================
// The client's brief evolved in phase 32: "there is no need for the owner to
// be able to generate those passwords. It should just generate the password
// for them, send it, and get them directed to change it."
//
// What this tab does:
//   - Invite staff: name + email + phone + optional personal note → the
//     SERVER generates a strong initial password (the owner never sees or
//     types one), the account is created ACTIVE with mustChangePassword set,
//     and a credentials email goes out. The toast reports whether the email
//     landed — and tells the admin the recipient should check their spam
//     folder if it is nowhere to be seen (the client's deliverability note).
//   - Pause / resume: reversible time-out (login + console APIs blocked).
//   - Revoke: permanent offboarding. Silent by design — no email is sent,
//     the manager decides how to communicate it.
//   - Reset password: the server generates + emails new credentials, access
//     is re-armed, and the staff member is asked to set their own at the
//     next sign-in. No admin-typed password anywhere.
//
// Everything here is ADMIN-only UI; the /api/staff routes enforce that
// server-side regardless of what any client renders.
// =============================================================================

import { useMemo, useState } from 'react'
import {
  UserPlus,
  UserCog,
  Pause,
  Play,
  Ban,
  KeyRound,
  Mail,
  Phone,
  ShieldAlert,
  BadgeCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useStaff, useCreateStaff, useUpdateStaff, type ApiStaff } from '@/lib/hooks'
import { cn } from '@/lib/utils'

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function StatusBadge({ status }: { status: ApiStaff['accessStatus'] }) {
  if (status === 'ACTIVE')
    return (
      <Badge className="gap-1 rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        <BadgeCheck className="h-3 w-3" /> Active
      </Badge>
    )
  if (status === 'PAUSED')
    return (
      <Badge className="gap-1 rounded-full bg-amber-100 text-amber-800 hover:bg-amber-100">
        <Pause className="h-3 w-3" /> Paused
      </Badge>
    )
  return (
    <Badge className="gap-1 rounded-full bg-rose-100 text-rose-700 hover:bg-rose-100">
      <Ban className="h-3 w-3" /> Revoked
    </Badge>
  )
}

export function StaffView() {
  const { data: staff, isLoading, error } = useStaff()
  const createMutation = useCreateStaff()
  const updateMutation = useUpdateStaff()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<ApiStaff | null>(null)
  const [pauseTarget, setPauseTarget] = useState<ApiStaff | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ApiStaff | null>(null)

  const counts = useMemo(() => {
    const list = staff ?? []
    return {
      active: list.filter((s) => s.accessStatus === 'ACTIVE').length,
      paused: list.filter((s) => s.accessStatus === 'PAUSED').length,
      revoked: list.filter((s) => s.accessStatus === 'REVOKED').length,
    }
  }, [staff])

  const reportEmail = (
    label: string,
    member: ApiStaff,
    email: { ok: boolean; error: string | null } | null,
    hint?: string
  ) => {
    if (!email) return
    if (email.ok) {
      toast({
        title: `${label} — email sent`,
        description:
          hint ??
          `${member.name} (${member.email}) has received the email from Kozy Care.`,
      })
    } else {
      toast({
        title: `${label} — email FAILED`,
        description: `The email to ${member.email} could not be sent (${email.error ?? 'provider error'}). ${
          label === 'Staff invited'
            ? 'The account exists — use "Reset password" to re-send once email is working, or pause the account in the meantime.'
            : 'Nothing was changed — their current password still works. Try again in a moment.'
        }`,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-navy">
            Staff access
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-navy-300">
            Invite team members into the operations console. Staff see orders, payment
            verifications, customers and feedback — never pricing, discounts, finances or
            admin settings. Pause temporarily or revoke permanently at any time.
          </p>
        </div>
        <Button
          onClick={() => setInviteOpen(true)}
          className="bg-gold-gradient font-semibold text-[#0A192F] hover:opacity-90"
        >
          <UserPlus className="mr-2 h-4 w-4" /> Invite staff
        </Button>
      </div>

      {/* Summary chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700 ring-1 ring-emerald-200">
          {counts.active} active
        </span>
        <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700 ring-1 ring-amber-200">
          {counts.paused} paused
        </span>
        <span className="rounded-full bg-rose-50 px-3 py-1 font-medium text-rose-600 ring-1 ring-rose-200">
          {counts.revoked} revoked
        </span>
      </div>

      {/* List */}
      {isLoading && <p className="text-sm text-navy-300">Loading staff…</p>}
      {error && (
        <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
          Could not load the staff list — {error.message}
        </div>
      )}
      {staff && staff.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <UserCog className="h-8 w-8 text-navy-300" />
            <p className="text-sm font-medium text-navy">No staff yet</p>
            <p className="max-w-sm text-xs text-navy-300">
              When you invite your first team member they&apos;ll sign in at the same
              console you do — with the operational tabs only. Their sign-in details
              arrive by email the moment you create the account.
            </p>
            <Button
              onClick={() => setInviteOpen(true)}
              variant="outline"
              className="mt-1 border-navy-200"
            >
              <UserPlus className="mr-2 h-4 w-4" /> Invite your first staff member
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(staff ?? []).map((member) => (
          <Card key={member.id} className="border-navy-100">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-xs font-semibold text-gold-400">
                  {initials(member.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-navy">{member.name}</p>
                    <StatusBadge status={member.accessStatus} />
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-navy-300">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {member.email}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {member.phone}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  {member.accessStatus !== 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateMutation.isPending}
                      onClick={() => {
                        updateMutation.mutate(
                          { id: member.id, accessStatus: 'ACTIVE' },
                          {
                            onSuccess: (data) => {
                              toast({
                                title: 'Access restored',
                                description: `${member.name} can sign in again${
                                  data.email?.ok ? ' — they were emailed.' : '.'
                                }`,
                              })
                            },
                            onError: (e: any) =>
                              toast({
                                title: 'Could not restore access',
                                description: e?.message,
                                variant: 'destructive',
                              }),
                          }
                        )
                      }}
                    >
                      <Play className="mr-1.5 h-3.5 w-3.5" /> Restore
                    </Button>
                  )}
                  {member.accessStatus === 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-200 text-amber-700 hover:bg-amber-50"
                      disabled={updateMutation.isPending}
                      onClick={() => setPauseTarget(member)}
                    >
                      <Pause className="mr-1.5 h-3.5 w-3.5" /> Pause
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updateMutation.isPending}
                    onClick={() => setResetTarget(member)}
                  >
                    <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Reset password
                  </Button>
                  {member.accessStatus !== 'REVOKED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-rose-200 text-rose-600 hover:bg-rose-50"
                      disabled={updateMutation.isPending}
                      onClick={() => setRevokeTarget(member)}
                    >
                      <Ban className="mr-1.5 h-3.5 w-3.5" /> Revoke
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ----- Invite dialog ----- */}
      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        pending={createMutation.isPending}
        onSubmit={(input) => {
          createMutation.mutate(input, {
            onSuccess: (data) => {
              setInviteOpen(false)
              reportEmail('Staff invited', data.staff, data.invite, data.hint)
            },
            onError: (e: any) =>
              toast({
                title: 'Could not create the account',
                description: e?.message,
                variant: 'destructive',
              }),
          })
        }}
      />

      {/* ----- Reset password dialog (phase 32: server-generated) ----- */}
      <ResetPasswordDialog
        member={resetTarget}
        pending={updateMutation.isPending}
        onClose={() => setResetTarget(null)}
        onSubmit={() => {
          if (!resetTarget) return
          updateMutation.mutate(
            { id: resetTarget.id, resetPassword: true },
            {
              onSuccess: (data) => {
                setResetTarget(null)
                reportEmail('Password reset', data.staff, data.email, data.hint)
              },
              onError: (e: any) =>
                toast({
                  title: 'Could not reset the password',
                  description: e?.message,
                  variant: 'destructive',
                }),
            }
          )
        }}
      />

      {/* ----- Pause confirm ----- */}
      <AlertDialog open={!!pauseTarget} onOpenChange={(o) => !o && setPauseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Pause className="h-4 w-4 text-amber-600" /> Pause {pauseTarget?.name}&apos;s access?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will be signed out of the console within about a minute and will not be
              able to sign in until you restore access (their password stays the same).
              No email is sent — tell them yourself. This is the right tool for leave,
              investigations or &quot;let&apos;s talk first&quot; moments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep access on</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => {
                if (!pauseTarget) return
                const target = pauseTarget
                updateMutation.mutate(
                  { id: target.id, accessStatus: 'PAUSED' },
                  {
                    onSuccess: () =>
                      toast({
                        title: 'Access paused',
                        description: `${target.name} is locked out of the console.`,
                      }),
                  }
                )
                setPauseTarget(null)
              }}
            >
              Pause access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ----- Revoke confirm ----- */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-600" /> Revoke {revokeTarget?.name}&apos;s
              access permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will be signed out within about a minute and their sign-in will stop
              working immediately after that. No email is sent — decide how to tell them
              yourself. You can still restore the account later from this tab if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                if (!revokeTarget) return
                const target = revokeTarget
                updateMutation.mutate(
                  { id: target.id, accessStatus: 'REVOKED' },
                  {
                    onSuccess: () =>
                      toast({
                        title: 'Access revoked',
                        description: `${target.name} no longer has console access. Restore anytime from the Staff tab if circumstances change.`,
                      }),
                  }
                )
                setRevokeTarget(null)
              }}
            >
              Revoke access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// =============================================================================
// Invite dialog — name / email / phone / note (phase 32: NO password field —
// the server generates it, emails it, and the staff member sets their own at
// first sign-in)
// =============================================================================

function InviteDialog({
  open,
  onClose,
  pending,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  pending: boolean
  onSubmit: (input: {
    name: string
    email: string
    phone: string
    note?: string
  }) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')

  const valid =
    name.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(email) &&
    phone.trim().length >= 7

  const reset = () => {
    setName('')
    setEmail('')
    setPhone('')
    setNote('')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite a staff member</DialogTitle>
          <DialogDescription>
            The account is created the moment you send this. A secure password is generated
            automatically and emailed to them — you never see or set it. They&apos;ll be asked to
            choose their own password the first time they sign in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="staff-name" className="text-xs uppercase tracking-wide text-navy-300">
              Full name
            </Label>
            <Input
              id="staff-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ngozi Adeyemi"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="staff-email" className="text-xs uppercase tracking-wide text-navy-300">
              Their email
            </Label>
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="they@example.com"
              className="mt-1.5"
            />
            <p className="mt-1 text-[11px] text-navy-300">
              Must not already belong to a Kozy Care account. Their sign-in details go here — if
              the email doesn&apos;t arrive within a few minutes, ask them to check their spam or
              junk folder.
            </p>
          </div>
          <div>
            <Label htmlFor="staff-phone" className="text-xs uppercase tracking-wide text-navy-300">
              Phone
            </Label>
            <Input
              id="staff-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234 801 234 5678"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="staff-note" className="text-xs uppercase tracking-wide text-navy-300">
              Personal note (optional)
            </Label>
            <Input
              id="staff-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. You'll be running the Lekki pickups"
              className="mt-1.5"
            />
            <p className="mt-1 text-[11px] text-navy-300">
              Included in the invite email, just above the sign-in button.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={!valid || pending}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                email: email.trim().toLowerCase(),
                phone: phone.trim(),
                note: note.trim() || undefined,
              })
            }
            className={cn('bg-gold-gradient font-semibold text-[#0A192F] hover:opacity-90')}
          >
            {pending ? 'Creating account…' : 'Create account & send invite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// Reset password dialog (phase 32 — server-generated password, confirmation
// only: the admin never types a password anywhere in this tab anymore)
// =============================================================================

function ResetPasswordDialog({
  member,
  pending,
  onClose,
  onSubmit,
}: {
  member: ApiStaff | null
  pending: boolean
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <Dialog
      open={!!member}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset {member?.name}&apos;s password?</DialogTitle>
          <DialogDescription>
            A new password is generated automatically and emailed to {member?.email} — you never
            see it. If their access is paused or revoked, it is restored at the same time, and
            they&apos;ll be asked to choose their own password at their next sign-in.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-gold-200 bg-gold-50 p-3 text-xs leading-relaxed text-navy">
          If the email doesn&apos;t arrive within a few minutes, ask them to check their spam or
          junk folder — invite emails occasionally land there.
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() => onSubmit()}
            className="bg-gold-gradient font-semibold text-[#0A192F] hover:opacity-90"
          >
            {pending ? 'Sending…' : 'Email new password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
