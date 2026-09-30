'use client'

// =============================================================================
// MembershipTab — the member's home inside the customer portal (phase 62)
// =============================================================================
// Shows the live plan, the usage meters for the current cycle / quarter /
// year, and the one-tap member pickup booking (bag/box pickups + the tier's
// included perk services). Non-members see a quiet join card instead.
// =============================================================================

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  Sparkles,
  Package,
  RefreshCcw,
  BedDouble,
  Layers,
  Sun,
  Footprints,
  CalendarClock,
  ArrowRight,
  Loader2,
  ShieldCheck,
  XCircle,
  Undo2,
  PlusCircle,
  ClipboardList,
  AlertCircle,
  CreditCard,
  Landmark,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { formatNaira, formatDate, RENEWAL_MONTH_CHOICES, renewalPriceFor, renewalSavingFor, type KozyAppSettings } from '@/lib/types'
import {
  useMyMembership,
  useMembershipCancel,
  useMembershipPickup,
  useMembershipPlans,
  type ApiMembership,
  type ApiMembershipPlan,
  type ApiMembershipUsage,
} from '@/lib/hooks'

const TIME_SLOTS = [
  '08:00 - 09:00',
  '09:00 - 10:00',
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:00 - 12:00',
  '13:00 - 14:00',
  '14:00 - 15:00',
  '15:00 - 16:00',
  '16:00 - 17:00',
].filter((v, i, a) => a.indexOf(v) === i)

function tomorrowISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function MembershipTab({ renewPrefill }: { renewPrefill?: number }) {
  const { data, isLoading, refetch } = useMyMembership()
  const cancelMutation = useMembershipCancel()
  const [booking, setBooking] = useState<'unit' | 'duvet' | 'curtain' | 'spring-clean' | 'shoes' | null>(null)
  // Phase 70: when true, the shoes booking draws from the standalone Shoe
  // Club instead of the laundry tier's perk (a customer may hold both).
  const [bookingClub, setBookingClub] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmClubCancel, setConfirmClubCancel] = useState(false)
  // Prefill the pickup address from the profile the booking wizard also
  // reads (best-effort — an empty field is a perfectly good prompt).
  const [defaultAddress, setDefaultAddress] = useState('')
  useEffect(() => {
    let cancelled = false
    fetch('/api/users/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.user?.address) setDefaultAddress(d.user.address)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const membership = data?.membership
  const usage = data?.usage
  const plan = membership?.plan
  const status = data?.effectiveStatus ?? membership?.status ?? 'PENDING_ACTIVATION'
  // Phase 75: the member's in-cycle bookings (live statuses + missed flags).
  const activity = data?.activity?.activity ?? []

  // Phase 76: the prepopulated-renewal deep link — once the data is in,
  // bring the renewal card into view so the email CTA lands exactly where
  // the member expects to pay.
  useEffect(() => {
    if (!renewPrefill || isLoading || !membership) return
    const t = setTimeout(() => {
      document.getElementById('kozy-renewal')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 350)
    return () => clearTimeout(t)
  }, [renewPrefill, isLoading, membership])

  // ----- The standalone Shoe Club (phase 70) -----
  const club = data?.shoeClub
  const clubMembership = club?.membership
  const clubPlan = clubMembership?.plan
  const clubUsage = club?.usage
  const clubStatus = club?.effectiveStatus ?? clubMembership?.status ?? 'PENDING_ACTIVATION'

  const openTierBooking = (kind: 'unit' | 'duvet' | 'curtain' | 'spring-clean' | 'shoes') => {
    setBookingClub(false)
    setBooking(kind)
  }
  const openClubBooking = () => {
    setBookingClub(true)
    setBooking('shoes')
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-navy-300" />
      </div>
    )
  }

  // ----- Not a member (yet) — a quiet, classy invitation -----
  // A shoes-only customer still sees their club card above the invitation.
  if (!membership) {
    return (
      <div className="space-y-4">
        {clubMembership && clubPlan && (
          <ShoeClubCard
            clubMembership={clubMembership}
            clubPlan={clubPlan}
            clubUsage={clubUsage}
            clubStatus={clubStatus}
            onBook={openClubBooking}
            onCancel={() => setConfirmClubCancel(true)}
            onUndo={async () => {
              try {
                await cancelMutation.mutateAsync({ action: 'cancel-undo', family: 'SHOES' })
                toast({ title: 'Glad you stayed', description: 'Your Shoe Club will keep renewing as before.' })
              } catch (e: any) {
                toast({ title: 'Could not undo', description: e?.message, variant: 'destructive' })
              }
            }}
          />
        )}
        <JoinCard />
        {booking && bookingClub && clubPlan && (
          <MemberPickupDialog
            kind="shoes"
            plan={{ unitName: clubPlan.unitName, unitKind: clubPlan.unitKind, extraUnitPrice: clubPlan.extraUnitPrice, maxExtraUnits: clubPlan.maxExtraUnits }}
            defaultAddress={defaultAddress}
            remaining={clubUsage?.shoesRemaining ?? 0}
            onClose={() => setBooking(null)}
            onBooked={() => {
              setBooking(null)
              refetch()
            }}
          />
        )}
        {confirmClubCancel && clubMembership && clubPlan && (
          <ConfirmClubCancelDialog
            clubName={clubPlan.name}
            periodEnd={clubMembership.periodEnd}
            onClose={() => setConfirmClubCancel(false)}
            onConfirm={async () => {
              try {
                await cancelMutation.mutateAsync({ action: 'cancel', family: 'SHOES' })
                setConfirmClubCancel(false)
                toast({
                  title: 'The club runs to month end',
                  description: 'Your pairs stay available until then — nothing else changes.',
                })
              } catch (e: any) {
                toast({ title: 'Could not cancel', description: e?.message, variant: 'destructive' })
              }
            }}
          />
        )}
      </div>
    )
  }

  const statusTone: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    EXPIRING: 'bg-amber-50 text-amber-700 border-amber-200',
    PAST_DUE: 'bg-amber-50 text-amber-700 border-amber-200',
    PENDING_ACTIVATION: 'bg-gold-50 text-navy border-gold-300',
    LAPSED: 'bg-navy-50 text-navy-300 border-navy-200',
    CANCELLED: 'bg-navy-50 text-navy-300 border-navy-200',
  }

  return (
    <div className="space-y-4">
      {/* ===== The membership card ===== */}
      <Card className="overflow-hidden border-navy-100 shadow-navy">
        <div className="bg-navy-gradient px-5 py-5 text-white sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gold-400" />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-300">
                  Kozy Circle · {plan?.name ?? 'Membership'}
                </p>
              </div>
              <p className="mt-1.5 font-serif text-2xl font-semibold">
                {formatNaira(membership.pricePaid || plan?.priceMonthly || 0)}
                <span className="text-sm font-normal text-navy-100/70"> / month</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="outline" className={`rounded-full border ${statusTone[status] ?? statusTone.ACTIVE} bg-white/95`}>
                {status === 'EXPIRING'
                  ? 'Ending soon — not renewing'
                  : status === 'PAST_DUE'
                    ? 'Renewal pending'
                    : status === 'PENDING_ACTIVATION'
                      ? 'Awaiting payment verification'
                      : 'Active'}
              </Badge>
            </div>
          </div>

          {membership.periodEnd && status !== 'PENDING_ACTIVATION' && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-navy-100/80">
              <CalendarClock className="h-3.5 w-3.5 text-gold-400" />
              {membership.cancelAtPeriodEnd
                ? `Runs until ${formatDate(membership.periodEnd)} — then rests`
                : `Renews ${formatDate(membership.periodEnd)}`}
            </p>
          )}
          {status === 'PENDING_ACTIVATION' && (
            <p className="mt-3 text-xs leading-relaxed text-navy-100/80">
              We received your membership — the moment your payment is verified, your month starts
              and your rider schedules the kit hand-over. (Card payments verify themselves
              instantly; transfers take a human glance.)
            </p>
          )}
        </div>

        {/* ===== Usage meters ===== */}
        {usage && plan && (
          <CardContent className="p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">
              This month
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <UsageMeter
                icon={Package}
                label={`${plan.unitName} pickups`}
                used={usage.unitsUsed}
                total={plan.includedUnits}
                suffix={usage.unitsRemaining === 0 && usage.extraRemaining > 0 ? ` · ${usage.extraRemaining} extra left` : undefined}
              />
              {plan.shoesPerMonth > 0 && (
                <UsageMeter
                  icon={Footprints}
                  label="Shoe cleans (this month)"
                  used={usage.shoesUsed}
                  total={plan.shoesPerMonth}
                />
              )}
              {plan.duvetsPerQuarter > 0 && (
                <UsageMeter
                  icon={BedDouble}
                  label="Duvet washes (this quarter)"
                  used={usage.duvetsUsed}
                  total={plan.duvetsPerQuarter}
                />
              )}
              {plan.curtainsPerQuarter > 0 && (
                <UsageMeter
                  icon={Layers}
                  label="Curtain care (this quarter)"
                  used={usage.curtainsUsed}
                  total={plan.curtainsPerQuarter}
                />
              )}
              {plan.springCleanPerYear > 0 && (
                <UsageMeter
                  icon={Sun}
                  label="Spring clean (this year)"
                  used={usage.springCleanUsed}
                  total={plan.springCleanPerYear}
                />
              )}
            </div>

            {/* ===== Book pickups / perks ===== */}
            {status !== 'LAPSED' && status !== 'CANCELLED' && (
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Button
                  onClick={() => openTierBooking('unit')}
                  disabled={status === 'PENDING_ACTIVATION'}
                  className="rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90"
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Book a {plan.unitKind} pickup
                </Button>
                <div className="flex flex-wrap gap-2">
                  {plan.shoesPerMonth > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTierBooking('shoes')}
                      disabled={status === 'PENDING_ACTIVATION' || usage.shoesRemaining === 0}
                      className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white"
                    >
                      <Footprints className="mr-1.5 h-3.5 w-3.5" /> Shoe clean
                      {usage.shoesRemaining === 0 && ' (month used)'}
                    </Button>
                  )}
                  {plan.duvetsPerQuarter > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTierBooking('duvet')}
                      disabled={status === 'PENDING_ACTIVATION' || usage.duvetsRemaining === 0}
                      className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white"
                    >
                      <BedDouble className="mr-1.5 h-3.5 w-3.5" /> Duvet wash
                      {usage.duvetsRemaining === 0 && ' (quarter used)'}
                    </Button>
                  )}
                  {plan.curtainsPerQuarter > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTierBooking('curtain')}
                      disabled={status === 'PENDING_ACTIVATION' || usage.curtainsRemaining === 0}
                      className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white"
                    >
                      <Layers className="mr-1.5 h-3.5 w-3.5" /> Curtain care
                      {usage.curtainsRemaining === 0 && ' (quarter used)'}
                    </Button>
                  )}
                  {plan.springCleanPerYear > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTierBooking('spring-clean')}
                      disabled={status === 'PENDING_ACTIVATION' || usage.springCleanRemaining === 0}
                      className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white"
                    >
                      <Sun className="mr-1.5 h-3.5 w-3.5" /> Spring clean
                      {usage.springCleanRemaining === 0 && ' (used this year)'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ===== Kit state ===== */}
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-linen-100 p-3 text-xs text-navy-300">
              <ShieldCheck className="h-4 w-4 shrink-0 text-gold-600" />
              {membership.kitState === 'PENDING_DELIVERY'
                ? `Your ${plan.unitName} rides along with your first member pickup — hand-over on the spot.`
                : membership.kitState === 'WITH_MEMBER'
                  ? `Your ${plan.unitName} is with you. Keep it coming back full — that's the whole system.`
                  : 'Your kit has been returned. Thank you for closing the loop cleanly.'}
            </div>

            {/* ===== Cancel / undo ===== */}
            {status !== 'PENDING_ACTIVATION' && status !== 'LAPSED' && status !== 'CANCELLED' && (
              <div className="mt-4 text-right">
                {membership.cancelAtPeriodEnd ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await cancelMutation.mutateAsync('cancel-undo')
                        toast({
                          title: 'Glad you stayed',
                          description: 'Your membership will keep renewing as before.',
                        })
                      } catch (e: any) {
                        toast({ title: 'Could not undo', description: e?.message, variant: 'destructive' })
                      }
                    }}
                    className="rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Undo — keep my membership
                  </Button>
                ) : (
                  <button
                    onClick={() => setConfirmCancel(true)}
                    className="text-xs text-navy-300 underline-offset-2 transition hover:text-rose-500 hover:underline"
                  >
                    Cancel membership (runs to month end)
                  </button>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ===== The payment card (phase 76 → 78) — the member's own payment
          place. Near the month's end (or past it): the full prepopulated
          renewal card with the whole standing ladder (1/3/6/12 months).
          Mid-cycle: the same card collapses to ONE quiet line ("covered
          through … · months stack · add months early") so a member can
          always settle a quarter, half-year or year on their own — without
          the page ever shouting at them. This is where the monthly summary
          email's CTAs land. ===== */}
      {plan && membership && status !== 'PENDING_ACTIVATION' && status !== 'CANCELLED' && (
        <RenewalCard
          membership={membership}
          plan={plan}
          status={status}
          prefillMonths={renewPrefill}
        />
      )}

      {/* ===== Your pickups this month (phase 75) — the tracking ledger ===== */}
      {membership && (status === 'ACTIVE' || status === 'EXPIRING' || status === 'PAST_DUE') && (
        <CycleActivityCard
          activity={activity}
          unitName={plan?.unitName ?? 'Kozy Bag'}
          onRebook={() => openTierBooking('unit')}
        />
      )}

      {/* ===== The standalone Shoe Club card (phase 70) — a shoes-only
          membership that composes with the laundry tier. ===== */}
      {clubMembership && clubPlan && (
        <ShoeClubCard
          clubMembership={clubMembership}
          clubPlan={clubPlan}
          clubUsage={clubUsage}
          clubStatus={clubStatus}
          onBook={openClubBooking}
          onCancel={() => setConfirmClubCancel(true)}
          onUndo={async () => {
            try {
              await cancelMutation.mutateAsync({ action: 'cancel-undo', family: 'SHOES' })
              toast({ title: 'Glad you stayed', description: 'Your Shoe Club will keep renewing as before.' })
            } catch (e: any) {
              toast({ title: 'Could not undo', description: e?.message, variant: 'destructive' })
            }
          }}
        />
      )}

      {/* ===== Booking dialog (tier perks or Shoe Club — same machinery) ===== */}
      {booking &&
        (bookingClub ? clubPlan : plan) &&
        (bookingClub ? (
          <MemberPickupDialog
            kind="shoes"
            plan={{
              unitName: clubPlan!.unitName,
              unitKind: clubPlan!.unitKind,
              extraUnitPrice: clubPlan!.extraUnitPrice,
              maxExtraUnits: clubPlan!.maxExtraUnits,
            }}
            defaultAddress={defaultAddress}
            remaining={clubUsage?.shoesRemaining ?? 0}
            onClose={() => setBooking(null)}
            onBooked={() => {
              setBooking(null)
              refetch()
            }}
          />
        ) : (
          <MemberPickupDialog
            kind={booking}
            plan={{
              unitName: plan!.unitName,
              unitKind: plan!.unitKind,
              extraUnitPrice: plan!.extraUnitPrice,
              maxExtraUnits: plan!.maxExtraUnits,
            }}
            defaultAddress={defaultAddress}
            remaining={
              booking === 'unit'
                ? (usage?.unitsRemaining ?? 0) + (usage?.extraRemaining ?? 0)
                : booking === 'shoes'
                  ? usage?.shoesRemaining ?? 0
                  : booking === 'duvet'
                    ? usage?.duvetsRemaining ?? 0
                    : booking === 'curtain'
                      ? usage?.curtainsRemaining ?? 0
                      : usage?.springCleanRemaining ?? 0
            }
            onClose={() => setBooking(null)}
            onBooked={() => {
              setBooking(null)
              refetch()
            }}
          />
        ))}

      {/* ===== Shoe Club cancel confirm (independent of the tier) ===== */}
      {confirmClubCancel && clubMembership && clubPlan && (
        <ConfirmClubCancelDialog
          clubName={clubPlan.name}
          periodEnd={clubMembership.periodEnd}
          onClose={() => setConfirmClubCancel(false)}
          onConfirm={async () => {
            try {
              await cancelMutation.mutateAsync({ action: 'cancel', family: 'SHOES' })
              setConfirmClubCancel(false)
              toast({
                title: 'The club runs to month end',
                description: 'Your pairs stay available until then — nothing else changes.',
              })
            } catch (e: any) {
              toast({ title: 'Could not cancel', description: e?.message, variant: 'destructive' })
            }
          }}
        />
      )}

      {/* ===== Cancel confirm ===== */}
      <Dialog open={confirmCancel} onOpenChange={(o) => !o && setConfirmCancel(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-navy">Rest your membership?</DialogTitle>
            <DialogDescription>
              It stays fully active until {membership.periodEnd ? formatDate(membership.periodEnd) : 'the end of your paid month'} —
              every pickup, every perk. Then it simply does not renew. Your {plan?.unitName ?? 'kit'}{' '}
              comes home with the final delivery.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmCancel(false)}
              className="flex-1 rounded-full border-navy-200 text-navy"
            >
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await cancelMutation.mutateAsync('cancel')
                  setConfirmCancel(false)
                  toast({
                    title: 'Membership set to rest',
                    description: 'Active to the end of your paid month — no further charges.',
                  })
                } catch (e: any) {
                  toast({ title: 'Could not cancel', description: e?.message, variant: 'destructive' })
                }
              }}
              className="flex-1 rounded-full"
            >
              <XCircle className="mr-1.5 h-4 w-4" /> Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =============================================================================
// RenewalCard (phase 76 → 78) — the member's own payment place
// =============================================================================
// Near the end of a cycle (≤10 days), when the member asked for no
// auto-renew, or when the membership has paused (PAST_DUE/LAPSED): the full
// prepopulated renewal card — plan already known, the month-count selector
// now the WHOLE standing ladder (1 / 3 / 6 / 12 months, each discounted rung
// in green with its saving spelled out, per-month figure at the deeper
// rungs), and the two payment paths mirroring the join checkout — card
// (Paystack redirect) or bank transfer (instructions + reference; the
// office confirms in the drill-down).
//
// MID-CYCLE (phase 78): the same card becomes the quiet "cover more months"
// place — collapsed to ONE calm line by default (covered-through date +
// "months stack, you never lose a day" + an Add-months button). Never a
// popup, never mid-page shouting: it is simply THERE whenever a member
// wants to settle a quarter, a half-year or a year on their own — exactly
// as the owner asked. /portal?renew=1&months=N (the email buttons and the
// ladder line's "every option lives in your portal") lands HERE with the
// month count preselected, expanding the card even mid-cycle.
// =============================================================================
function RenewalCard({
  membership,
  plan,
  status,
  prefillMonths,
}: {
  membership: ApiMembership
  plan: ApiMembershipPlan
  status: string
  prefillMonths?: number
}) {
  const [months, setMonths] = useState<number>(
    (RENEWAL_MONTH_CHOICES as readonly number[]).includes(Number(prefillMonths))
      ? Number(prefillMonths)
      : 1
  )
  const [earlyOpen, setEarlyOpen] = useState(false)
  const [appSettings, setAppSettings] = useState<KozyAppSettings | null>(null)
  const [busy, setBusy] = useState<'card' | 'transfer' | null>(null)
  const [transfer, setTransfer] = useState<{
    bankName: string
    accountName: string
    accountNumber: string
    amount: number
    months: number
    reference: string
    note: string
  } | null>(null)

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

  const periodEnd = membership.periodEnd ? new Date(membership.periodEnd) : null
  const daysLeft = periodEnd
    ? Math.ceil((periodEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null
  const paused = status === 'PAST_DUE' || status === 'LAPSED'
  // The full card when the month is actually running out (or already has);
  // mid-cycle, the quiet collapsed card carries the same machinery.
  const needsRenewal =
    paused || membership.cancelAtPeriodEnd || (daysLeft !== null && daysLeft <= 10)

  // ----- The quiet mid-cycle card: one calm line + an expand button -----
  // A deep link (?renew=1&months=N) expands it straight away.
  if (!needsRenewal && !earlyOpen && prefillMonths === undefined) {
    return (
      <Card className="border-navy-100 bg-white" id="kozy-renewal">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-sm leading-relaxed text-navy-300">
              <span className="font-semibold text-navy">
                Covered through {periodEnd ? formatDate(periodEnd.toISOString()) : 'your current month'}
              </span>
              <span className="mx-2 text-navy-200">·</span>
              Months added now simply stack onto that date — you never lose a day — and the
              longer you cover, the kinder the rate.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEarlyOpen(true)}
              className="rounded-full border-navy-200 font-semibold text-navy hover:bg-navy hover:text-white"
            >
              Add months early
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const price = renewalPriceFor(plan.priceMonthly, months)
  const saving = renewalSavingFor(plan.priceMonthly, months)
  const paystackAvailable = appSettings?.paystackAvailable ?? false

  const renew = async (method: 'PAYSTACK' | 'BANK_TRANSFER') => {
    setBusy(method === 'PAYSTACK' ? 'card' : 'transfer')
    try {
      const res = await fetch('/api/subscriptions/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: membership.id, months, method }),
      })
      const data = await res.json().catch(() => ({}))
      if (method === 'PAYSTACK') {
        if (res.ok && data.authorizationUrl) {
          window.location.href = data.authorizationUrl as string
          return // the redirect is the success path
        }
        toast({
          title: 'Could not start the card payment',
          description: data?.message ?? 'Please try again, or choose bank transfer below.',
          variant: 'destructive',
        })
      } else {
        if (res.ok && data.transfer) {
          setTransfer(data.transfer)
          toast({
            title: 'Almost there — one transfer',
            description: 'Send the amount with your reference; the office confirms the moment it lands.',
          })
        } else {
          toast({
            title: 'Could not start the transfer renewal',
            description: data?.message ?? 'Please try again in a moment.',
            variant: 'destructive',
          })
        }
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

  return (
    <Card className="overflow-hidden border-gold-300/60 shadow-navy" id="kozy-renewal">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-600">
              {paused
                ? 'Your membership has paused'
                : needsRenewal
                  ? 'Your next month'
                  : 'Cover more months'}
            </p>
            <p className="mt-1 font-serif text-xl font-semibold text-navy">
              {paused
                ? `Reactivate the ${plan.name}`
                : membership.cancelAtPeriodEnd
                  ? `Keep the ${plan.name} going`
                  : needsRenewal
                    ? `Renew the ${plan.name}`
                    : `Add months to the ${plan.name}`}
            </p>
          </div>
          {paused && (
            <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-700">
              Paused
            </Badge>
          )}
        </div>

        <p className="mt-2 text-sm leading-relaxed text-navy-300">
          {paused
            ? `Your ${plan.includedUnits} × ${plan.unitName} pickups restart the moment you renew — your ${plan.unitName} is still yours and your history is intact.`
            : membership.cancelAtPeriodEnd
              ? `You asked us not to auto-renew — the month ends ${periodEnd ? formatDate(periodEnd.toISOString()) : 'soon'}. Change your mind in one tap: renew below and everything continues as before.`
              : needsRenewal
                ? `Your month ends ${periodEnd ? formatDate(periodEnd.toISOString()) : 'soon'} — renew now and your rider keeps collecting at your usual window without a pause.`
                : `You're covered through ${periodEnd ? formatDate(periodEnd.toISOString()) : 'your current month'}. Months added now simply stack onto that date — you never lose a day.`}
        </p>

        {/* The payment options — the standing ladder: next month, or a
            discounted 3 / 6 / 12-month cover, every discounted rung green */}
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">
            How many months?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {RENEWAL_MONTH_CHOICES.map((m) => {
              const mSaving = renewalSavingFor(plan.priceMonthly, m)
              const selected = months === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    selected && m > 1
                      ? 'border-emerald-400 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm'
                      : selected
                        ? 'border-gold-400 bg-gold-gradient text-navy shadow-sm'
                        : 'border-navy-200 bg-white text-navy-300 hover:border-navy-300 hover:text-navy'
                  }`}
                >
                  {m === 1 ? '1 month' : `${m} months`}
                  <span
                    className={`ml-1.5 text-xs font-normal ${
                      selected && m > 1 ? 'text-emerald-50' : 'opacity-80'
                    }`}
                  >
                    {formatNaira(renewalPriceFor(plan.priceMonthly, m))}
                  </span>
                  {m > 1 && mSaving > 0 && (
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${
                        selected
                          ? 'bg-white/25 text-white'
                          : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      }`}
                    >
                      save {formatNaira(mSaving)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {months > 1 && saving > 0 && (
            <p className="mt-2 text-xs text-navy-300">
              One payment of <strong className="text-navy">{formatNaira(price)}</strong> covers your next {months} months —
              <strong className="text-emerald-700"> {formatNaira(saving)} less</strong> than paying month by month
              {months >= 6 ? ` (${formatNaira(Math.round(price / months))} a month)` : ''}.
            </p>
          )}
        </div>

        {/* The payment paths — same as the join checkout */}
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button
            onClick={() => renew('PAYSTACK')}
            disabled={busy !== null || !paystackAvailable}
            className="rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90"
            title={paystackAvailable ? undefined : 'Card payments are not configured yet — transfer works today'}
          >
            {busy === 'card' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="mr-2 h-4 w-4" />
            )}
            Pay {formatNaira(price)} by card
          </Button>
          <Button
            onClick={() => renew('BANK_TRANSFER')}
            disabled={busy !== null}
            variant="outline"
            className="rounded-full border-navy-200 font-semibold text-navy hover:bg-navy hover:text-white"
          >
            {busy === 'transfer' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Landmark className="mr-2 h-4 w-4" />
            )}
            Pay by bank transfer
          </Button>
        </div>
        {!paystackAvailable && (
          <p className="mt-2 text-xs text-navy-300">
            Card payments are not configured yet — bank transfer works today; your{' '}
            {months > 1 ? `${months} months` : 'next month'} applies the moment the office confirms.
          </p>
        )}

        {/* The transfer instructions (after the member picks transfer) */}
        {transfer && (
          <div className="mt-4 rounded-xl border border-gold-200 bg-gold-50/60 p-4 text-sm">
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
          </div>
        )}

        <p className="mt-4 text-xs leading-relaxed text-navy-300">
          The longer you cover, the kinder the rate — always.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-navy-300">
          Need a second {plan.unitName} for the busy weeks? Reply to your summary email or call{' '}
          {appSettings?.contactPhone ?? 'the office'} — we&apos;ll add it to your renewal.
        </p>
      </CardContent>
    </Card>
  )
}

// =====================================================
// Usage meter — a quiet progress row
// =====================================================
function UsageMeter({
  icon: Icon,
  label,
  used,
  total,
  suffix,
}: {
  icon: any
  label: string
  used: number
  total: number
  suffix?: string
}) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 100
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-navy">
          <Icon className="h-3.5 w-3.5 text-gold-600" /> {label}
        </span>
        <span className="font-mono text-xs text-navy-300">
          {used}/{total}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-100">
        <div
          className="h-full rounded-full bg-gold-gradient transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {suffix && <p className="mt-1.5 text-[10px] text-navy-300">{suffix}</p>}
    </div>
  )
}

// =====================================================
// Cycle activity (phase 75) — "Your pickups this month"
// =====================================================
// The member's tracking ledger: every booking this cycle with its live
// status, the next scheduled pickup, and a quiet "we missed you" row with a
// one-tap rebook for anything that slipped past its pickup day.
const ACTIVITY_STATUS: Record<string, { label: string; tone: string }> = {
  REQUESTED: { label: 'Scheduled', tone: 'border-navy-100 bg-linen-50 text-navy-300' },
  PAYMENT_PENDING_VERIFICATION: { label: 'Confirming payment', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
  PAYMENT_VERIFIED: { label: 'Rider on the way', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  PICKED_UP: { label: 'Picked up', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  AT_STATION: { label: 'At the station', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  PROCESSING: { label: 'In the wash', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  FINISHING: { label: 'Finishing', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  DELIVERED: { label: 'Delivered', tone: 'border-navy-200 bg-navy-50 text-navy-300' },
  CANCELLED: { label: 'Cancelled — allowance returned', tone: 'border-navy-200 bg-navy-50 text-navy-300' },
}

function CycleActivityCard({
  activity,
  unitName,
  onRebook,
}: {
  activity: Array<{
    id: string
    orderNumber: string
    label: string
    status: string
    missed: boolean
    pickupDate: string
    pickupTimeSlot: string
    deliveredAt: string | null
    extraCharge: number
  }>
  unitName: string
  onRebook: () => void
}) {
  const now = Date.now()
  const upcoming = activity
    .filter((a) => !a.deliveredAt && a.status !== 'CANCELLED' && new Date(a.pickupDate).getTime() + 36 * 60 * 60 * 1000 > now)
    .sort((a, b) => new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime())[0]
  const missed = activity.filter((a) => a.missed)
  const done = activity.filter((a) => a.deliveredAt).length

  return (
    <Card className="border-navy-100 shadow-navy">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-navy-300">
            <ClipboardList className="h-4 w-4 text-gold-600" /> Your pickups this month
          </p>
          {activity.length > 0 && (
            <span className="font-mono text-[11px] text-navy-300">
              {done}/{activity.length} delivered
            </span>
          )}
        </div>

        {/* Next scheduled pickup — the thing members check most */}
        {upcoming && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-gold-200 bg-gold-50 p-3.5">
            <CalendarClock className="h-5 w-5 shrink-0 text-gold-600" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gold-800">
                Next pickup
              </p>
              <p className="text-sm font-medium text-navy">
                {formatDate(upcoming.pickupDate)} · {upcoming.pickupTimeSlot}
              </p>
              <p className="truncate text-xs text-navy-300">{upcoming.label}</p>
            </div>
          </div>
        )}

        {/* We missed you — plain words, one-tap rebook */}
        {missed.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <AlertCircle className="h-3.5 w-3.5" /> We missed {missed.length === 1 ? 'a pickup' : `${missed.length} pickups`}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">
              {missed.length === 1
                ? `The ${missed[0].label.toLowerCase()} on ${formatDate(missed[0].pickupDate)} didn't happen — your allowance for it is untouched while it sits uncollected.`
                : 'These pickups passed their dates uncollected — the allowance is untouched until the order is cancelled or collected.'}
            </p>
            <Button
              size="sm"
              onClick={onRebook}
              className="mt-2 rounded-full bg-navy text-white hover:bg-navy-700"
            >
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Rebook a pickup
            </Button>
          </div>
        )}

        {/* The ledger */}
        {activity.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-navy-200 p-6 text-center">
            <p className="text-sm font-medium text-navy">No pickups booked yet this month</p>
            <p className="mt-1 text-xs text-navy-300">
              Your {unitName} is ready when you are — book the first one and the month starts moving.
            </p>
            <Button
              size="sm"
              onClick={onRebook}
              className="mt-3 rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90"
            >
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Book a {unitName.toLowerCase()} pickup
            </Button>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-linen-100">
            {activity.map((a) => {
              const s = ACTIVITY_STATUS[a.status] ?? {
                label: a.status.toLowerCase().replace(/_/g, ' '),
                tone: 'border-navy-100 bg-linen-50 text-navy-300',
              }
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy">{a.label}</p>
                    <p className="text-[11px] text-navy-300">
                      #{a.orderNumber} · pickup {formatDate(a.pickupDate)} · {a.pickupTimeSlot}
                      {a.extraCharge > 0 && ` · ₦${a.extraCharge.toLocaleString('en-NG')} extra`}
                    </p>
                  </div>
                  <Badge variant="outline" className={`shrink-0 rounded-full text-[10px] ${s.tone}`}>
                    {a.missed && a.status !== 'CANCELLED' ? 'missed' : s.label}
                  </Badge>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// =====================================================
// Member pickup dialog — one-tap booking
// =====================================================
function MemberPickupDialog({
  kind,
  plan,
  defaultAddress,
  remaining,
  onClose,
  onBooked,
}: {
  kind: 'unit' | 'duvet' | 'curtain' | 'spring-clean' | 'shoes'
  plan: { unitName: string; unitKind: string; extraUnitPrice: number; maxExtraUnits: number }
  defaultAddress: string
  remaining: number
  onClose: () => void
  onBooked: () => void
}) {
  const pickup = useMembershipPickup()
  const [address, setAddress] = useState(defaultAddress)
  const [date, setDate] = useState(tomorrowISO())
  const [slot, setSlot] = useState(TIME_SLOTS[1])
  const [count, setCount] = useState(1)
  const [note, setNote] = useState('')

  const kindCopy: Record<string, { title: string; desc: string; countLabel?: string; max: number }> = {
    unit: {
      title: `Book a ${plan.unitKind} pickup`,
      desc: `Leave your ${plan.unitName} ready — the rider collects, and it returns washed, folded and pressed.`,
      countLabel: `${plan.unitName}s this pickup`,
      max: Math.max(1, Math.min(plan.maxExtraUnits + 1, remaining)),
    },
    shoes: {
      title: 'Book your shoe clean',
      desc: 'Included with your plan this month — sneakers and casual shoes hand-cleaned, deodorized and returned. (Suede, leather and embellished pairs use our specialist service with your member discount.)',
      countLabel: 'Pairs this pickup',
      max: Math.max(1, Math.min(4, remaining)),
    },
    duvet: {
      title: 'Book your duvet wash',
      desc: 'Included with your plan this quarter — freshened, aired and returned.',
      countLabel: 'Duvets',
      max: Math.max(1, remaining),
    },
    curtain: {
      title: 'Book curtain care',
      desc: 'Included with your plan this quarter — taken down, treated, pressed and rehung-ready.',
      countLabel: 'Panels',
      max: Math.max(1, remaining),
    },
    'spring-clean': {
      title: 'Book the spring clean',
      desc: 'Your once-a-year deep service — rugs and heavy household materials, collected and treated.',
      max: 1,
    },
  }
  const copy = kindCopy[kind]
  const includedLeft = kind === 'unit' ? Math.max(0, remaining - plan.maxExtraUnits) : remaining
  const extras = kind === 'unit' ? Math.max(0, count - Math.min(count, includedLeft)) : 0
  const extraCharge = extras * plan.extraUnitPrice

  const onBook = async () => {
    if (!address.trim() || address.trim().length < 8) {
      toast({
        title: 'Pickup address needed',
        description: 'Where should the rider meet you? (house number, street, area)',
        variant: 'destructive',
      })
      return
    }
    try {
      const res = await pickup.mutateAsync({
        kind,
        count: kind === 'spring-clean' ? 1 : count,
        pickupAddress: address.trim(),
        pickupDate: new Date(date + 'T00:00:00').toISOString(),
        pickupTimeSlot: slot,
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      onBooked()
      toast({
        title: res.duplicate ? 'Already booked' : 'Pickup booked',
        description:
          extraCharge > 0
            ? `Scheduled for ${formatDate(res.order.pickupDate)} · ${slot}. ${extras} extra ${plan.unitKind}${extras === 1 ? '' : 's'} — ${formatNaira(extraCharge)} pays with this order.`
            : `Scheduled for ${formatDate(res.order.pickupDate)} · ${slot} — covered by your plan, nothing to pay.`,
      })
    } catch (e: any) {
      toast({
        title: 'Could not book',
        description: e?.message ?? 'Please try again in a moment.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg text-navy">{copy.title}</DialogTitle>
          <DialogDescription>{copy.desc}</DialogDescription>
        </DialogHeader>

        <div className="mt-1 space-y-3">
          {copy.countLabel && copy.max > 1 && (
            <div>
              <label className="text-xs font-medium text-navy">{copy.countLabel}</label>
              <div className="mt-1.5 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCount((c) => Math.max(1, c - 1))}
                  className="h-8 w-8 rounded-full p-0"
                >
                  −
                </Button>
                <span className="w-8 text-center font-mono text-sm font-semibold text-navy">{count}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCount((c) => Math.min(copy.max, c + 1))}
                  className="h-8 w-8 rounded-full p-0"
                >
                  +
                </Button>
                {kind === 'unit' && extras > 0 && (
                  <span className="text-[11px] text-amber-700">
                    {extras} extra × {formatNaira(plan.extraUnitPrice)}
                  </span>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-navy">Pickup address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="House number, street, area, landmark"
              rows={2}
              className="mt-1.5 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm text-navy placeholder:text-navy-300 focus:border-gold-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-navy">Date</label>
              <input
                type="date"
                value={date}
                min={tomorrowISO()}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm text-navy focus:border-gold-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-navy">Window</label>
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm text-navy focus:border-gold-400 focus:outline-none"
              >
                {TIME_SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-navy">Note for the rider (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Gate code, call on arrival…"
              className="mt-1.5 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm text-navy placeholder:text-navy-300 focus:border-gold-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-navy-300">
            {extraCharge > 0 ? (
              <>
                Extras on this pickup: <strong className="text-navy">{formatNaira(extraCharge)}</strong>{' '}
                (payable with the order)
              </>
            ) : (
              'Covered by your plan — nothing to pay.'
            )}
          </p>
        </div>
        <Button
          onClick={onBook}
          disabled={pickup.isPending}
          className="mt-2 w-full rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90"
        >
          {pickup.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Booking…
            </>
          ) : (
            <>
              <PlusCircle className="mr-2 h-4 w-4" /> Book it
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================
// Join card — for portal visitors without a membership
// =====================================================
function JoinCard() {
  const { data: plans } = useMembershipPlans(true)
  const cheapest = useMemo(
    () =>
      (plans ?? [])
        .filter((p) => p.isActive)
        .sort((a, b) => a.priceMonthly - b.priceMonthly)[0],
    [plans]
  )

  return (
    <Card className="border-navy-100 shadow-navy">
      <CardContent className="p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-navy-800 text-gold-300">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="mt-3 font-serif text-xl font-semibold text-navy">The Kozy Circle</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-navy-300">
          Laundry on a rhythm — a Kozy Bag or Box collected every week, free pickup and delivery,
          and a member discount on everything else.
          {cheapest ? ` Plans start at ${formatNaira(cheapest.priceMonthly)} a month.` : ''}
        </p>
        <Link href="/memberships" className="mt-4 inline-block">
          <Button className="rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90">
            Explore the plans <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

// =====================================================
// Shoe Club card (phase 70) — the standalone shoes-only
// membership, rendered under (or instead of) the tier.
// =====================================================
function ShoeClubCard({
  clubMembership,
  clubPlan,
  clubUsage,
  clubStatus,
  onBook,
  onCancel,
  onUndo,
}: {
  clubMembership: ApiMembership
  clubPlan: ApiMembershipPlan
  clubUsage?: ApiMembershipUsage | null
  clubStatus: string
  onBook: () => void
  onCancel: () => void
  onUndo: () => void
}) {
  const statusTone: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    EXPIRING: 'bg-amber-50 text-amber-700 border-amber-200',
    PAST_DUE: 'bg-amber-50 text-amber-700 border-amber-200',
    PENDING_ACTIVATION: 'bg-gold-50 text-navy border-gold-300',
    LAPSED: 'bg-navy-50 text-navy-300 border-navy-200',
    CANCELLED: 'bg-navy-50 text-navy-300 border-navy-200',
  }
  const remaining = clubUsage?.shoesRemaining ?? clubPlan.shoesPerMonth
  const used = clubUsage?.shoesUsed ?? 0
  const canBook = !['LAPSED', 'CANCELLED', 'PENDING_ACTIVATION'].includes(clubStatus) && remaining > 0

  return (
    <Card className="overflow-hidden border-navy-100 shadow-navy">
      <div className="bg-navy px-5 py-4 text-white sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Footprints className="h-4 w-4 text-gold-400" />
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-300">
                Kozy Shoe Club · {clubPlan.name}
              </p>
            </div>
            <p className="mt-1.5 font-serif text-2xl font-semibold">
              {formatNaira(clubMembership.pricePaid || clubPlan.priceMonthly)}
              <span className="text-sm font-normal text-navy-100/70"> / month</span>
            </p>
          </div>
          <Badge variant="outline" className={`rounded-full border ${statusTone[clubStatus] ?? statusTone.ACTIVE} bg-white/95`}>
            {clubStatus === 'EXPIRING'
              ? 'Ending soon — not renewing'
              : clubStatus === 'PAST_DUE'
                ? 'Renewal pending'
                : clubStatus === 'PENDING_ACTIVATION'
                  ? 'Waiting for payment'
                  : clubStatus === 'LAPSED'
                    ? 'Ended'
                    : 'Active'}
          </Badge>
        </div>
      </div>
      <CardContent className="p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">This month</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <UsageMeter icon={Footprints} label="Shoe pairs" used={used} total={clubPlan.shoesPerMonth} />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-navy-300">
          One pair = the standard sneaker &amp; canvas clean (washed, brushed, deodorised, air-dried).
          Suede, leather and embellished pairs ride along on any booking with your{' '}
          {clubPlan.memberDiscountPct}% member discount.
        </p>

        {clubStatus !== 'LAPSED' && clubStatus !== 'CANCELLED' && (
          <div className="mt-5">
            <Button
              onClick={onBook}
              disabled={!canBook}
              className="rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90"
            >
              <Footprints className="mr-2 h-4 w-4" />
              Book a shoe clean
              {remaining === 0 && ' (month used)'}
            </Button>
          </div>
        )}

        {clubStatus !== 'PENDING_ACTIVATION' && clubStatus !== 'LAPSED' && clubStatus !== 'CANCELLED' && (
          <div className="mt-4 text-right">
            {clubMembership.cancelAtPeriodEnd ? (
              <Button
                size="sm"
                variant="outline"
                onClick={onUndo}
                className="rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Undo — keep my club
              </Button>
            ) : (
              <button
                onClick={onCancel}
                className="text-xs text-navy-300 underline-offset-2 transition hover:text-rose-500 hover:underline"
              >
                Cancel the club (runs to month end)
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ConfirmClubCancelDialog({
  clubName,
  periodEnd,
  onClose,
  onConfirm,
}: {
  clubName: string
  periodEnd: string | null
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg text-navy">Rest the {clubName}?</DialogTitle>
          <DialogDescription>
            Your pairs stay available until {periodEnd ? formatDate(periodEnd) : 'the end of your paid month'}.
            Then the club simply does not renew — your laundry plan (if you have one) is untouched.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-full border-navy-200 text-navy">
            Keep it
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="flex-1 rounded-full">
            <XCircle className="mr-1.5 h-4 w-4" /> Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
