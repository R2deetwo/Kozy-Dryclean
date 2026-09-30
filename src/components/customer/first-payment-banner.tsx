'use client'

// =============================================================================
// FirstPaymentBanner (phase 81) — the pending member's payment, front and
// center at the very top of the portal.
// =============================================================================
// The owner's direction, verbatim in spirit: a member who just joined ("we
// received your membership REQUEST") should never have to scroll, search or
// guess where to pay. The banner sits BETWEEN the portal header (welcome
// back + name) and the Active/Past/Guarantee stat cards — above the tabs, so
// it is visible on EVERY tab — and carries the whole first-payment
// machinery:
//
//   • "Complete your payment first" + the Awaiting payment badge
//   • the first month's price (one clean figure, no "/month" — the member
//     is not "in" yet, so nothing is framed as a running cost)
//   • Pay by bank transfer → the button DROPS DOWN the transfer details
//     (bank, account name, account number, reference — the amount spelled
//     out with the naira symbol and comma), then hands the baton to…
//   • "I've made payment" → the office-alerting claim + a calm toast:
//     we're verifying, your membership will be activated shortly.
//   • Pay by card (the moment Paystack is configured) → straight to
//     checkout.
//
// The banner renders for BOTH families: a pending laundry tier and a pending
// Shoe Club (a shoes-only customer). Paused/lapsed reactivation stays in the
// Membership tab's renewal card — different moment, different voice.
// =============================================================================

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { BadgeCheck, CreditCard, Landmark, Loader2, Sparkles, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { formatNaira, type KozyAppSettings } from '@/lib/types'
import { useQueryClient } from '@tanstack/react-query'
import { useMembershipCancel } from '@/lib/hooks'
import type { ApiMembership, ApiMembershipPlan, ApiRenewalClaim } from '@/lib/hooks'

type TransferInfo = {
  bankName: string
  accountName: string
  accountNumber: string
  amount: number
  months: number
  reference: string
  note: string
}

export function FirstPaymentBanner({
  membership,
  plan,
  family,
  focus,
  openClaim,
}: {
  membership: ApiMembership
  plan: ApiMembershipPlan
  /** KIT (laundry tier) | SHOES (the standalone club). */
  family: 'KIT' | 'SHOES'
  /** The /portal?pay=1 deep link — scroll the banner into view and let it
   * glow for a beat so the member lands exactly on their payment. */
  focus?: boolean
  /** Task 82 — the member's open "I've made payment" claim from the ledger.
   *  While one is open, the banner shows the settled awaiting state even
   *  after a refresh (the claim used to be a local React flag) and the
   *  buttons rest — no duplicate claims. */
  openClaim?: ApiRenewalClaim | null
}) {
  const qc = useQueryClient()
  const ref = useRef<HTMLDivElement>(null)
  const [appSettings, setAppSettings] = useState<KozyAppSettings | null>(null)
  const [busy, setBusy] = useState<'card' | 'transfer' | 'claim' | null>(null)
  const [transfer, setTransfer] = useState<TransferInfo | null>(null)
  const [claimed, setClaimed] = useState(false)
  const [glow, setGlow] = useState(false)

  const isClub = family === 'SHOES'
  const paystackAvailable = appSettings?.paystackAvailable ?? false
  // Task 82 — the SERVER-side claimed state (survives refresh; a stale
  // claim older than 14 days lets the member start again).
  const claimOpen = Boolean(openClaim && !openClaim.stale)
  const settled = claimed || claimOpen

  // Task 82 — the escape hatch: an unpaid request can be withdrawn cleanly
  // (nothing was paid, the one-per-family slot frees for a fresh start).
  const cancelMutation = useMembershipCancel()
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const onWithdraw = async () => {
    try {
      await cancelMutation.mutateAsync({ action: 'withdraw-request', family })
      setConfirmWithdraw(false)
      qc.invalidateQueries({ queryKey: ['my-membership'] })
      toast({
        title: 'Request withdrawn',
        description:
          "Nothing was paid, so nothing is lost — you can start again any time from the Memberships page, and we'll keep the kettle on.",
      })
    } catch (e: any) {
      toast({ title: 'Could not withdraw', description: e?.message, variant: 'destructive' })
    }
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/settings/app')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.settings) setAppSettings(d.settings as KozyAppSettings)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // The deep link: land, glow, be seen.
  useEffect(() => {
    if (!focus) return
    const t = setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setGlow(true)
      setTimeout(() => setGlow(false), 2600)
    }, 300)
    return () => clearTimeout(t)
  }, [focus])

  // ----- The transfer reveal: instructions only, no side effects -----
  const openTransfer = async () => {
    setBusy('transfer')
    try {
      const res = await fetch('/api/subscriptions/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: membership.id, months: 1, method: 'BANK_TRANSFER' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.transfer) {
        setTransfer(data.transfer as TransferInfo)
      } else {
        toast({
          title: 'Could not load the transfer details',
          description: data?.message ?? 'Please try again in a moment.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Network hiccup',
        description: 'Please check your connection and try again.',
        variant: 'destructive',
      })
    } finally {
      setBusy(null)
    }
  }

  // ----- "I've made payment" — the claim the office acts on -----
  const claimTransfer = async () => {
    setBusy('claim')
    try {
      const res = await fetch('/api/subscriptions/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: membership.id,
          months: 1,
          method: 'BANK_TRANSFER',
          claim: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setClaimed(true)
        qc.invalidateQueries({ queryKey: ['my-membership'] })
        toast({
          title: "We're verifying your payment",
          description:
            'Thank you — the moment the office confirms your transfer, your membership will be activated shortly. Keep your reference handy just in case.',
        })
      } else if (res.status === 409 && data?.error === 'CLAIM_ALREADY_OPEN') {
        // Task 82 — the ledger already holds a live claim (double-press or a
        // second device): settle the banner, no error theatre.
        setClaimed(true)
        qc.invalidateQueries({ queryKey: ['my-membership'] })
        toast({
          title: "We're already verifying your payment",
          description: data?.message ?? 'The office is confirming your transfer — no need to send it again.',
        })
      } else {
        toast({
          title: 'Could not record the payment',
          description: data?.message ?? 'Please try again in a moment.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Network hiccup',
        description: 'Please check your connection and try again.',
        variant: 'destructive',
      })
    } finally {
      setBusy(null)
    }
  }

  // ----- Card: straight to checkout (the moment a key exists) -----
  const payByCard = async () => {
    setBusy('card')
    try {
      const res = await fetch('/api/subscriptions/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: membership.id, months: 1, method: 'PAYSTACK' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.authorizationUrl) {
        window.location.href = data.authorizationUrl as string
        return // the redirect IS the success path
      }
      toast({
        title: 'Could not start the card payment',
        description: data?.message ?? 'Please try again, or pay by bank transfer.',
        variant: 'destructive',
      })
    } catch {
      toast({
        title: 'Network hiccup',
        description: 'Please check your connection and try again.',
        variant: 'destructive',
      })
    } finally {
      setBusy(null)
    }
  }

  const price = plan.priceMonthly

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <Card
        className={
          glow
            ? 'overflow-hidden border-gold-400 shadow-navy ring-2 ring-gold-200 transition-shadow'
            : 'overflow-hidden border-gold-300/70 shadow-navy'
        }
      >
        <CardContent className="p-5 sm:p-6" id="kozy-first-payment">
          {/* The header row — status first, price second, always calm */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gold-600">
                <Sparkles className="h-3.5 w-3.5" />
                {isClub ? 'Almost in the club' : 'Almost in the Circle'}
              </p>
              <p className="mt-1 font-serif text-xl font-semibold text-navy sm:text-2xl">
                Complete your payment first
              </p>
            </div>
            <Badge
              variant="outline"
              className="rounded-full border-gold-200 bg-gold-50 text-gold-700"
            >
              Awaiting payment
            </Badge>
          </div>

          {/* The request wording — a REQUEST, not a running membership.
              No naira-per-month here: the member is not "in" yet. */}
          <p className="mt-2 text-sm leading-relaxed text-navy-300">
            {isClub
              ? `We received your ${plan.name} request — your ${plan.shoesPerMonth} pair${plan.shoesPerMonth === 1 ? '' : 's'} of cleans a month start the moment your first month is paid.`
              : `We received your ${plan.name} request — your ${plan.includedUnits} × ${plan.unitName} pickups start the moment your first month is paid.`}
          </p>

          {/* The one clean figure */}
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">
              Your first month
            </p>
            <p className="font-serif text-2xl font-bold text-navy">{formatNaira(price)}</p>
            <p className="text-xs text-navy-300">
              one payment · then the kinder 3/6/12-month rates open in your Membership tab
            </p>
          </div>

          {/* The payment paths — Task 82: while an open claim awaits the
              office, both paths rest (the money is already mid-flight). */}
          {claimOpen ? (
            <div className="mt-5 rounded-xl border border-gold-200 bg-gold-50/60 p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold text-navy">
                <BadgeCheck className="h-4 w-4 text-gold-600" />
                Payment sent — awaiting the office&apos;s confirmation
              </p>
              {openClaim && (
                <p className="mt-1.5 text-xs leading-relaxed text-navy-300">
                  {openClaim.amount > 0 ? formatNaira(openClaim.amount) : formatNaira(price)} ·
                  reference <strong className="text-navy">{openClaim.reference}</strong> · noted{' '}
                  {new Date(openClaim.claimedAt).toLocaleDateString('en-NG', {
                    day: 'numeric',
                    month: 'short',
                  })}
                  . Your membership activates the moment the office confirms it — nothing
                  else is needed from you.
                </p>
              )}
            </div>
          ) : (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {/* Card — honestly unavailable until a Paystack key exists */}
            <Button
              onClick={payByCard}
              disabled={busy !== null || !paystackAvailable}
              className="rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90"
              title={
                paystackAvailable
                  ? undefined
                  : 'Card payments are not configured yet — transfer works today'
              }
            >
              {busy === 'card' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Pay {formatNaira(price)} by card
            </Button>

            {/* Transfer — the drop-down reveal */}
            {!transfer ? (
              <Button
                onClick={openTransfer}
                disabled={busy !== null}
                variant="outline"
                className="rounded-full border-navy-300 font-semibold text-navy hover:bg-navy hover:text-white"
              >
                {busy === 'transfer' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Landmark className="mr-2 h-4 w-4" />
                )}
                Pay by bank transfer
              </Button>
            ) : (
              <Button
                onClick={claimTransfer}
                disabled={busy !== null || settled}
                className={`rounded-full font-semibold ${
                  settled
                    ? 'bg-navy-50 text-navy-400'
                    : 'bg-navy text-white hover:bg-navy-700'
                }`}
              >
                {busy === 'claim' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : settled ? (
                  <BadgeCheck className="mr-2 h-4 w-4" />
                ) : null}
                {settled ? "Payment sent — awaiting the office's confirmation" : "I've made payment"}
              </Button>
            )}
          </div>
          )}

          {!paystackAvailable && !claimOpen && (
            <p className="mt-2 text-xs text-navy-300">
              Card payments are not configured yet — bank transfer works today, and your
              membership activates the moment the office confirms it.
            </p>
          )}

          {/* The dropped-down transfer details — everything to send, in one
              glance, amounts always with the naira symbol and the comma. */}
          {transfer && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 overflow-hidden"
            >
              <div className="rounded-xl border border-gold-200 bg-gold-50/60 p-4 text-sm">
                <p className="font-semibold text-navy">Transfer {formatNaira(transfer.amount)}</p>
                <div className="mt-2 space-y-1 text-navy-300">
                  <p>
                    <span className="inline-block w-28 text-navy-300">Bank</span>
                    <strong className="text-navy">{transfer.bankName}</strong>
                  </p>
                  <p>
                    <span className="inline-block w-28 text-navy-300">Account name</span>
                    <strong className="text-navy">{transfer.accountName}</strong>
                  </p>
                  <p>
                    <span className="inline-block w-28 text-navy-300">Account number</span>
                    <strong className="text-navy">{transfer.accountNumber}</strong>
                  </p>
                  <p>
                    <span className="inline-block w-28 text-navy-300">Reference</span>
                    <strong className="text-navy">{transfer.reference}</strong>
                  </p>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-navy-300">{transfer.note}</p>
                {settled && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-navy-700">
                    <BadgeCheck className="h-3.5 w-3.5 text-gold-600" />
                    You told us you&apos;ve paid — we&apos;re verifying it now. Your membership
                    will be activated shortly.
                  </p>
                )}
              </div>
            </motion.div>
          )}

          <p className="mt-4 text-xs leading-relaxed text-navy-300">
            Once your first month is in, the standing ladder takes over — the longer you
            cover, the kinder the rate, always.
          </p>

          {/* Task 82 — the quiet exit: an UNPAID request can be withdrawn.
              Never shown while a payment claim is mid-verification (money may
              genuinely be in flight). */}
          {!claimOpen && (
            <div className="mt-2 text-right">
              <button
                onClick={() => setConfirmWithdraw(true)}
                className="text-[11px] text-navy-300 underline-offset-2 transition hover:text-rose-500 hover:underline"
              >
                Not the right time? Withdraw this request
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* The withdraw confirm — plain words, no dark patterns */}
      <Dialog open={confirmWithdraw} onOpenChange={(o) => !o && setConfirmWithdraw(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-navy">
              Withdraw your {isClub ? 'club' : 'membership'} request?
            </DialogTitle>
            <DialogDescription>
              Nothing has been paid, so nothing is lost — the request simply goes away and
              your account stays exactly as it is. You can start again any time from the
              Memberships page, on this or any other plan.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmWithdraw(false)}
              className="flex-1 rounded-full border-navy-200 text-navy"
            >
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={onWithdraw}
              disabled={cancelMutation.isPending}
              className="flex-1 rounded-full"
            >
              {cancelMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-1.5 h-4 w-4" />
              )}
              Withdraw it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
