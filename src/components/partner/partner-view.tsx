'use client'

// =============================================================================
// PartnerView (phase 72) — the Kozy Network partner portal
// =============================================================================
// The laundrette's working screen, built on the rider app's structure on
// purpose (the owner's brief: "partners should be able to register the same
// way riders sign up" — the portal closes the loop to full parity):
//
//   ORDERS   — the batches Kozy routes to this facility. The partner walks
//              each order forward: received (AT_STATION) → washing
//              (PROCESSING) → finished (FINISHING). Kozy's riders handle
//              the doors; the partner handles the wash. Every move lands
//              in the same StatusEvent ledger the office and the customer
//              tracking read.
//   EARNINGS — their share of delivered order value (this month +
//              lifetime), settlements the office has paid, and the pending
//              balance — the same numbers the office sees, from the same
//              functions.
//   ACCOUNT  — business profile, the payout bank account, password, sign
//              out. First sign-in forces a set-your-own-password dialog
//              (the welcome email's promise), same as riders and staff.
//
// Session gate is the middleware (PARTNER role only); the view renders the
// suspended state honestly — a suspended partner keeps their ledger but
// cannot work orders.
// =============================================================================

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { signOut } from 'next-auth/react'
import { motion } from 'framer-motion'
import {
  WashingMachine,
  Wallet,
  User as UserIcon,
  PauseCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { usePartnerOverview } from '@/lib/hooks'
import { toast } from '@/hooks/use-toast'
import { PartnerOrdersTab } from './partner-orders-tab'
import { PartnerEarningsTab } from './partner-earnings-tab'
import { PartnerAccountTab } from './partner-account-tab'

const TABS = [
  { id: 'orders', label: 'Orders', icon: WashingMachine },
  { id: 'earnings', label: 'Earnings', icon: Wallet },
  { id: 'account', label: 'Account', icon: UserIcon },
] as const

type TabId = (typeof TABS)[number]['id']

export function PartnerView() {
  const { data: session } = useSession()
  const [tab, setTab] = useState<TabId>('orders')
  const [pwOpen, setPwOpen] = useState(false)

  // ----- First-sign-in password change — same promise the rider welcome
  // email makes; approved partners get mustChangePassword=true. -----
  const [mustChangePassword, setMustChangePassword] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/users/me')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('me failed'))))
      .then((d) => {
        if (alive) setMustChangePassword(Boolean(d?.user?.mustChangePassword))
      })
      .catch(() => {
        if (alive) setMustChangePassword(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const { data, isLoading, error } = usePartnerOverview({ refetchInterval: 30_000 })
  const partner = data?.partner
  const suspended = partner?.status === 'SUSPENDED'

  const businessName = partner?.businessName ?? session?.user?.name ?? 'Partner'

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-900 text-white">
      {/* Header — the working identity, rider-app language */}
      <header className="bg-slate-950 px-4 py-4 shadow-lg sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-gold-400">Kozy Network partner</p>
              <p className="truncate text-lg font-bold">{businessName}</p>
            </div>
            {partner && (
              <div
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-[11px] font-bold',
                  suspended
                    ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40'
                    : 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40'
                )}
              >
                {partner.revenueSharePartnerPct}% share
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Suspended banner — honest, actionable, non-blocking for reads */}
      {suspended && (
        <div className="mx-auto mt-3 max-w-md px-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
            <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-xs leading-relaxed text-amber-200/90">
              Your partnership is paused — no new orders will be routed to you and the portal is
              read-only. Your ledger and history are untouched. Call the Kozy Care office to
              reactivate.
            </p>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-md px-4 py-4 sm:px-6">
        {error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-rose-400" />
            <p className="text-sm font-semibold text-white">{error.message}</p>
            <p className="mt-1 text-xs text-slate-400">
              If this keeps happening, sign out and sign back in — or call the office.
            </p>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="mt-3 rounded-full border border-slate-600 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:border-rose-400 hover:text-rose-300"
            >
              Sign out
            </button>
          </div>
        ) : isLoading || !data ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-2xl bg-slate-800" />
            <div className="h-36 animate-pulse rounded-2xl bg-slate-800" />
            <div className="h-36 animate-pulse rounded-2xl bg-slate-800" />
          </div>
        ) : (
          <>
            {tab === 'orders' && <PartnerOrdersTab data={data} suspended={suspended} />}
            {tab === 'earnings' && <PartnerEarningsTab />}
            {tab === 'account' && (
              <PartnerAccountTab
                partner={partner ?? null}
                onOpenPassword={() => setPwOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Bottom tab bar — the thumb-first navigation, rider-app recipe */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-md items-stretch">
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition',
                  active ? 'text-gold-300' : 'text-slate-500 hover:text-slate-300'
                )}
                aria-current={active ? 'page' : undefined}
              >
                {active && (
                  <motion.span
                    layoutId="partner-tab-indicator"
                    className="absolute top-0 h-0.5 w-10 rounded-full bg-gold-400"
                  />
                )}
                <t.icon className="h-5 w-5" />
                {t.label}
              </button>
            )
          })}
        </div>
      </nav>
      {/* Clearance for the fixed bottom bar */}
      <div className="h-16" />

      {/* Password change — forced on first sign-in, or any time from Account */}
      <PartnerPasswordDialog
        open={mustChangePassword === true || pwOpen}
        forced={mustChangePassword === true}
        onDone={() => {
          setMustChangePassword(false)
          setPwOpen(false)
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------- Password
// Same recipe as the rider dialog (phase 55): the welcome email promises
// "the portal will ask you to choose your own password" — this honours it.
function PartnerPasswordDialog({
  open,
  forced,
  onDone,
}: {
  open: boolean
  forced: boolean
  onDone: () => void
}) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strengthOk =
    newPw.length >= 10 &&
    [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(newPw)).length >= 2

  const submit = async () => {
    setError(null)
    if (newPw !== confirmPw) {
      setError('The two new passwords do not match.')
      return
    }
    if (!strengthOk) {
      setError('At least 10 characters, with a mix of letters, numbers or symbols.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/users/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not set the password')
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      toast({ title: 'Password set', description: 'Use your new password next time you sign in.' })
      onDone()
    } catch (e: any) {
      setError(e?.message || 'Could not set the password — try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!forced) onDone()
      }}
    >
      <DialogContent
        className="border-slate-700 bg-slate-900 sm:max-w-sm"
        onInteractOutside={(e: any) => forced && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-white">Set your own password</DialogTitle>
          <DialogDescription className="text-slate-400">
            {forced
              ? 'Welcome! For your security, choose your own password before you start — the one from your welcome email was just to get you in.'
              : 'Choose a new password for your partner account.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-300">Password from your welcome email</p>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white focus:border-gold-400 focus:outline-none"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-300">Your new password</p>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white focus:border-gold-400 focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-slate-500">
              At least 10 characters, mixed letters/numbers/symbols.
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-300">Repeat the new password</p>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white focus:border-gold-400 focus:outline-none"
            />
          </div>
          {error && (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}
          <Button
            onClick={submit}
            disabled={saving || !currentPw || !strengthOk || newPw !== confirmPw}
            className="w-full bg-navy text-white hover:bg-navy-500"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Set my password'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
