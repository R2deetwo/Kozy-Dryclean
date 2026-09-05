'use client'

// =============================================================================
// ChangePasswordDialog (phase 32)
// =============================================================================
// The staff member's way out of the emailed initial password — the client
// asked for exactly this: the system emails a password, and the person "gets
// directed to change it".
//
// Two modes:
//   FORCED  — shown by the console shell while mustChangePassword is set
//             (the account is still on its emailed password). It cannot be
//             dismissed: switching to a private password is a one-time,
//             two-minute step, and the whole point is that the shared
//             initial secret stops being valid knowledge ASAP. A manager can
//             always reset their credentials if they get stuck.
//   VOLUNTARY — opened any time from the sidebar ("Change password") by
//             admins and staff alike.
//
// POST /api/users/me/password does the work: current password must be
// presented (an open tab must never be enough), the new one must clear the
// strength floor, and the server clears mustChangePassword on success.
// =============================================================================

import { useEffect, useState } from 'react'
import { KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export function ChangePasswordDialog({
  open,
  forced = false,
  onOpenChange,
  onDone,
}: {
  open: boolean
  /** forced: no close affordances at all (first sign-in on an emailed password) */
  forced?: boolean
  /** Only honoured when NOT forced */
  onOpenChange: (open: boolean) => void
  /** Called after the server accepted the new password */
  onDone?: () => void
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset the form whenever the dialog (re)opens.
  useEffect(() => {
    if (open) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
      setError(null)
    }
  }, [open])

  const strength =
    newPassword.length >= 10 &&
    [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(newPassword)).length >= 2

  const canSubmit =
    currentPassword.length > 0 && strength && newPassword === confirm && !pending

  const submit = async () => {
    if (!canSubmit) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/users/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Could not change the password. Please try again.')
        return
      }
      toast({
        title: 'Password updated',
        description: 'Your new password is active. Keep it private — it is never emailed to you or anyone else.',
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
      if (!forced) onOpenChange(false)
      onDone?.()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // FORCED mode swallows every close attempt (X button, overlay click,
        // Escape) — the only way out is a successful change.
        if (forced) return
        onOpenChange(o)
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        // Hide the built-in close X in forced mode.
        showCloseButton={!forced}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg',
                forced ? 'bg-gold-100 text-navy' : 'bg-navy text-gold-400'
              )}
            >
              {forced ? <KeyRound className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
            </span>
            {forced ? 'Set your own password' : 'Change password'}
          </DialogTitle>
          <DialogDescription>
            {forced
              ? 'You are signing in with the password that was emailed to you. Choose your own now — only you will know it. The emailed one stops being used the moment you save.'
              : 'Pick something only you know. You will need your current password to confirm.'}
          </DialogDescription>
        </DialogHeader>

        {forced && (
          <div className="rounded-lg border border-gold-200 bg-gold-50 p-3 text-xs leading-relaxed text-navy">
            <span className="flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" /> One-time security step
            </span>
            <p className="mt-1 text-navy-300">
              This dialog stays open until your new password is saved. If you do not have the
              emailed password, ask your manager to reset it.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="cp-current" className="text-xs uppercase tracking-wide text-navy-300">
              Current password
            </Label>
            <Input
              id="cp-current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="The one you signed in with"
              className="mt-1.5"
              autoComplete="current-password"
            />
          </div>
          <div>
            <Label htmlFor="cp-new" className="text-xs uppercase tracking-wide text-navy-300">
              New password
            </Label>
            <Input
              id="cp-new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 10 characters"
              className="mt-1.5"
              autoComplete="new-password"
            />
            {newPassword.length > 0 && !strength && (
              <p className="mt-1 text-[11px] text-amber-700">
                Use at least 10 characters with a mix of letters, numbers or symbols.
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="cp-confirm" className="text-xs uppercase tracking-wide text-navy-300">
              Repeat the new password
            </Label>
            <Input
              id="cp-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type it once more"
              className="mt-1.5"
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
            />
            {confirm.length > 0 && newPassword !== confirm && (
              <p className="mt-1 text-[11px] text-amber-700">The two entries do not match yet.</p>
            )}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800"
          >
            {error}
          </div>
        )}

        <DialogFooter>
          {!forced && (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
          )}
          <Button
            disabled={!canSubmit}
            onClick={submit}
            className="bg-gold-gradient font-semibold text-[#0A192F] hover:opacity-90"
          >
            {pending ? 'Saving…' : forced ? 'Save my password' : 'Update password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
