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
  BedSingle,
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
  ArrowLeftRight,
  BadgeCheck,
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
  useMembershipPlanChange,
  type ApiMembership,
  type ApiMembershipPlan,
  type ApiMembershipUsage,
  type ApiRenewalClaim,
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
  // Phase 81 — the quiet tier switch (upgrade or downgrade; the member
  // never sees the word "downgrade").
  const planChangeMutation = useMembershipPlanChange()
  const [booking, setBooking] = useState<'unit' | 'duvet' | 'curtain' | 'spring-clean' | 'shoes' | 'bedsheet' | null>(null)
  // Phase 70: when true, the shoes booking draws from the standalone Shoe
  // Club instead of the laundry tier's perk (a customer may hold both).
  const [bookingClub, setBookingClub] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmClubCancel, setConfirmClubCancel] = useState(false)
  // Phase 81: the Change plan dialog (tier or club — same machinery).
  const [changingPlan, setChangingPlan] = useState<null | 'KIT' | 'SHOES'>(null)
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

  // Phase 76 → 81: the prepopulated-renewal deep link — once the data is in,
  // bring the payment surface into view. A PENDING member's payment is the
  // banner at the top of the portal (phase 81); a live member's is the
  // renewal card below.
  useEffect(() => {
    if (!renewPrefill || isLoading || !membership) return
    const t = setTimeout(() => {
      const target =
        (data?.effectiveStatus ?? membership.status) === 'PENDING_ACTIVATION'
          ? 'kozy-first-payment'
          : 'kozy-renewal'
      document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 350)
    return () => clearTimeout(t)
  }, [renewPrefill, isLoading, membership])

  // ----- The standalone Shoe Club (phase 70) -----
  const club = data?.shoeClub
  const clubMembership = club?.membership
  const clubPlan = clubMembership?.plan
  const clubUsage = club?.usage
  const clubStatus = club?.effectiveStatus ?? clubMembership?.status ?? 'PENDING_ACTIVATION'

  const openTierBooking = (kind: 'unit' | 'duvet' | 'curtain' | 'spring-clean' | 'shoes' | 'bedsheet') => {
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
            tierName={null}
            tierShoes={0}
            onBook={openClubBooking}
            onCancel={() => setConfirmClubCancel(true)}
            onChangePlan={() => setChangingPlan('SHOES')}
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

        {/* Phase 79 → 81 — a shoes-only member whose club payment never
            landed gets the same banner as the laundry tiers (the trap fix
            covers BOTH families) — the FIRST-PAYMENT banner at the top of
            the portal, not this card. Reactivation (PAST_DUE/LAPSED)
            still rides this card. */}
        {clubMembership &&
          clubPlan &&
          ['PAST_DUE', 'LAPSED'].includes(clubStatus) && (
            <RenewalCard
              membership={clubMembership}
              plan={clubPlan}
              status={clubStatus}
              cardId="kozy-renewal-club"
              openClaim={club?.openClaim ?? null}
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
              {/* Phase 81: a pending member is NOT "in" yet — no naira-per-month
                  headline (they have not paid anything). The card says what it is:
                  a REQUEST, received. The payment itself lives in the banner at
                  the top of the portal (every tab, front and center). */}
              {status === 'PENDING_ACTIVATION' ? (
                <p className="mt-1.5 font-serif text-2xl font-semibold">
                  Membership request received
                </p>
              ) : (
                <p className="mt-1.5 font-serif text-2xl font-semibold">
                  {formatNaira(membership.pricePaid || plan?.priceMonthly || 0)}
                  <span className="text-sm font-normal text-navy-100/70"> / month</span>
                </p>
              )}
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
            <div className="mt-3">
              <p className="text-xs leading-relaxed text-navy-100/80">
                We received your membership request — your month starts the moment your
                first payment is confirmed (card payments verify themselves instantly;
                transfers take a human glance).
              </p>
              <button
                onClick={() =>
                  document
                    .getElementById('kozy-first-payment')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold-gradient px-4 py-2 text-xs font-semibold text-navy transition hover:opacity-90"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Complete your first payment
              </button>
            </div>
          )}
          {/* Phase 81: a scheduled tier switch — one quiet line, undoable. */}
          {membership.pendingPlan && status !== 'PENDING_ACTIVATION' && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-navy-100/80">
              <ArrowLeftRight className="h-3.5 w-3.5 text-gold-400" />
              <span>
                Switching to {membership.pendingPlan.name} at your next renewal ·
                {formatNaira(membership.pendingPlan.priceMonthly)}/month
              </span>
              <button
                onClick={async () => {
                  try {
                    await planChangeMutation.mutateAsync({ action: 'plan-change-undo' })
                    toast({
                      title: 'Switch undone',
                      description: `You'll stay on ${plan?.name ?? 'your current plan'} — nothing else changes.`,
                    })
                  } catch (e: any) {
                    toast({ title: 'Could not undo', description: e?.message, variant: 'destructive' })
                  }
                }}
                className="underline underline-offset-2 transition hover:text-white"
              >
                Undo
              </button>
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
              {/* Task 82 — clothing and shoes stay SEPARATE on the dash. When
                  the member also holds the Shoe Club, the tier's shoe
                  allowance becomes a quiet note (the club card carries the
                  pairs meter); on its own it stays a meter with its
                  provenance spelled out — "included with your tier". */}
              {plan.shoesPerMonth > 0 && !clubMembership && (
                <UsageMeter
                  icon={Footprints}
                  label="Shoe cleans (included with your tier)"
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
              {/* Oct 2026 directive — the monthly sheet allowance rides with
                  the Household/Whole Home tiers (“two every two weeks”). */}
              {plan.bedsheetsPerMonth > 0 && (
                <UsageMeter
                  icon={BedSingle}
                  label="Bed sheet washes (this month)"
                  used={usage.bedsheetsUsed ?? 0}
                  total={plan.bedsheetsPerMonth}
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

            {/* Task 82 — the tier's shoe allowance, restated as a quiet
                line when the Shoe Club card below carries the pairs meter:
                x shoe cleans a month ride WITH this tier, counted separately
                from the club's pairs. */}
            {plan.shoesPerMonth > 0 && clubMembership && (
              <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-linen-100 px-3 py-2 text-[11px] leading-relaxed text-navy-300">
                <Footprints className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" />
                <span>
                  Your {plan.name} also includes{' '}
                  <strong className="text-navy">{plan.shoesPerMonth} shoe{' '}
                  clean{plan.shoesPerMonth === 1 ? '' : 's'} a month</strong> — tracked with your
                  laundry pickups, separate from your Shoe Club pairs below.
                </span>
              </p>
            )}

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
                  {plan.bedsheetsPerMonth > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTierBooking('bedsheet')}
                      disabled={status === 'PENDING_ACTIVATION' || (usage.bedsheetsRemaining ?? 0) === 0}
                      className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white"
                    >
                      <BedSingle className="mr-1.5 h-3.5 w-3.5" /> Bed sheet wash
                      {(usage.bedsheetsRemaining ?? 0) === 0 && ' (month used)'}
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

            {/* ===== Change plan / Cancel / undo ===== */}
            {/* Phase 81 — the quiet switch: one small link, same visual voice
                as the cancel link. Upgrades and downgrades ride the same door;
                the word "downgrade" appears nowhere. */}
            {status !== 'CANCELLED' && status !== 'LAPSED' && !membership.pendingPlan && (
              <div className={status !== 'PENDING_ACTIVATION' ? 'mt-4 text-right' : 'mt-4'}>
                <button
                  onClick={() => setChangingPlan('KIT')}
                  className="text-xs text-navy-300 underline-offset-2 transition hover:text-gold-600 hover:underline"
                >
                  Change plan
                </button>
              </div>
            )}
            {status !== 'PENDING_ACTIVATION' && status !== 'LAPSED' && status !== 'CANCELLED' && (
              <div className="mt-2 text-right">
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

      {/* ===== The payment card (phase 76 → 78 → 79 → 81) — the LIVE
          member's own payment place. Near the month's end (or past it): the
          full prepopulated renewal card with the whole standing ladder
          (1/3/6/12 months). Mid-cycle: the same card collapses to ONE quiet
          line ("covered through … · months stack · add months early") so a
          member can always settle a quarter, half-year or year on their own
          — without the page ever shouting at them. This is where the monthly
          summary email's CTAs land.
          PHASE 81: PENDING_ACTIVATION members no longer render this card —
          their first payment lives in the banner at the TOP of the portal
          (every tab, front and center — the owner's direction), so there is
          exactly ONE payment surface, never two. ===== */}
      {plan && membership && status !== 'CANCELLED' && status !== 'PENDING_ACTIVATION' && (
        <RenewalCard
          membership={membership}
          plan={plan}
          status={status}
          prefillMonths={renewPrefill}
          openClaim={data?.openClaim ?? null}
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
          tierName={membership ? plan?.name ?? null : null}
          tierShoes={plan?.shoesPerMonth ?? 0}
          onBook={openClubBooking}
          onCancel={() => setConfirmClubCancel(true)}
          onChangePlan={() => setChangingPlan('SHOES')}
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

      {/* Phase 79 → 81 — the club's own payment card when the club is
          paused, for members who hold BOTH a tier and the club. A pending
          club rides the first-payment banner at the top of the portal
          instead — one payment surface, never two. */}
      {clubMembership &&
        clubPlan &&
        ['PAST_DUE', 'LAPSED'].includes(clubStatus) && (
          <RenewalCard
            membership={clubMembership}
            plan={clubPlan}
            status={clubStatus}
            cardId="kozy-renewal-club"
            openClaim={club?.openClaim ?? null}
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
                    : booking === 'bedsheet'
                      ? usage?.bedsheetsRemaining ?? 0
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

      {/* ===== Change plan (phase 81) — the quiet tier switch ===== */}
      {changingPlan === 'KIT' && membership && plan && (
        <PlanChangeDialog
          currentPlan={plan}
          status={status}
          periodEnd={membership.periodEnd}
          scheduledPlan={membership.pendingPlan ?? null}
          family="KIT"
          onClose={() => setChangingPlan(null)}
        />
      )}
      {changingPlan === 'SHOES' && clubMembership && clubPlan && (
        <PlanChangeDialog
          currentPlan={clubPlan}
          status={clubStatus}
          periodEnd={clubMembership.periodEnd}
          scheduledPlan={clubMembership.pendingPlan ?? null}
          family="SHOES"
          onClose={() => setChangingPlan(null)}
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
// RenewalCard (phase 76 → 79) — the member's own payment place
// =============================================================================
// Near the end of a cycle (≤10 days), when the member asked for no
// auto-renew, or when the membership has paused (PAST_DUE/LAPSED): the full
// prepopulated renewal card — plan already known, the month-count selector
// now the WHOLE standing ladder (1 / 3 / 6 / 12 months, each discounted rung
// in NAVY with its saving spelled out — brand colours only, phase 79 —
// per-month figure at the deeper rungs), and the two payment paths mirroring
// the join checkout — card (Paystack redirect) or bank transfer
// (instructions + reference; the office confirms in the drill-down).
//
// PENDING_ACTIVATION (phase 79): the same card becomes "Complete your first
// payment" — one month at plan price, no ladder, both payment paths. This is
// the door out of the phase-79 trap (members who joined, the card checkout
// never opened, and no payment surface existed while pending).
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
  cardId,
  openClaim,
}: {
  membership: ApiMembership
  plan: ApiMembershipPlan
  status: string
  prefillMonths?: number
  /** The deep-link anchor — the laundry card keeps #kozy-renewal; the Shoe
   *  Club card (phase 79) uses its own so the two never collide. */
  cardId?: string
  /** Task 82 — the member's open "I've made payment" claim, straight from
   *  the ledger. While one is open (and not stale) the card shows the
   *  awaiting state across refreshes: the claimed months carry an
   *  "awaiting confirmation" tag, the other months grey out, and the
   *  payment buttons rest — no duplicate claims, ever. */
  openClaim?: ApiRenewalClaim | null
}) {
  const [months, setMonths] = useState<number>(
    (RENEWAL_MONTH_CHOICES as readonly number[]).includes(Number(prefillMonths))
      ? Number(prefillMonths)
      : 1
  )
  const [earlyOpen, setEarlyOpen] = useState(false)
  const [appSettings, setAppSettings] = useState<KozyAppSettings | null>(null)
  const [busy, setBusy] = useState<'card' | 'transfer' | 'claim' | null>(null)
  const [claimed, setClaimed] = useState(false)
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
  // Phase 79 — a pending membership shows the completion card: the FIRST
  // payment, one month, no ladder (the ladder opens once it is live).
  const pending = status === 'PENDING_ACTIVATION'
  // Task 82 — the SERVER-side claimed state: the open claim from the ledger
  // (survives refresh; clears the moment the office confirms). A stale claim
  // (> 14 days unconfirmed) no longer gates the member — they can pay again.
  const claimOpen = Boolean(openClaim && !openClaim.stale)
  const settled = claimed || claimOpen
  // While a claim is open, the months under confirmation are the claim's.
  const claimedMonths = claimOpen ? (openClaim as ApiRenewalClaim).months : 0
  // The full card when the month is actually running out (or already has);
  // mid-cycle, the quiet collapsed card carries the same machinery.
  const needsRenewal =
    pending || paused || membership.cancelAtPeriodEnd || (daysLeft !== null && daysLeft <= 10)
  // The first payment is a single month at plan price — the ladder is for
  // live memberships. (The renew API enforces the same rule.)
  const effectiveMonths = pending ? 1 : months

  // ----- The quiet mid-cycle card: one calm line + an expand button -----
  // A deep link (?renew=1&months=N) expands it straight away. Task 82: a
  // member with an open claim never sees the collapsed card — their payment
  // is mid-flight and the awaiting state must stay visible.
  if (!needsRenewal && !earlyOpen && !claimOpen && prefillMonths === undefined) {
    return (
      <Card className="border-navy-100 bg-white" id={cardId ?? 'kozy-renewal'}>
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

  const price = renewalPriceFor((membership.pendingPlan ?? plan).priceMonthly, effectiveMonths)
  const saving = renewalSavingFor((membership.pendingPlan ?? plan).priceMonthly, effectiveMonths)
  const paystackAvailable = appSettings?.paystackAvailable ?? false

  // Phase 81 — the card's own payment paths, split in two for transfer:
  //   • Pay by bank transfer → the reveal (instructions only, no claim)
  //   • I've made payment → the claim the office acts on + the calm toast
  const renew = async (method: 'PAYSTACK' | 'BANK_TRANSFER', claim = false) => {
    setBusy(claim ? 'claim' : method === 'PAYSTACK' ? 'card' : 'transfer')
    try {
      const res = await fetch('/api/subscriptions/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: membership.id,
          months: effectiveMonths,
          method,
          ...(claim ? { claim: true } : {}),
        }),
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
      } else if (claim) {
        if (res.ok) {
          setClaimed(true)
          toast({
            title: "We're verifying your payment",
            description: pending
              ? 'Thank you — the moment the office confirms your transfer, your membership will be activated shortly.'
              : `Thank you — the moment the office confirms your transfer, your ${
                  effectiveMonths > 1 ? `${effectiveMonths} months apply` : 'next month applies'
                } as usual.`,
          })
        } else if (res.status === 409 && data?.error === 'CLAIM_ALREADY_OPEN') {
          // Task 82 — the server already has a live claim: settle the card
          // onto the awaiting state instead of showing an error (the member
          // did nothing wrong — they just double-pressed across sessions).
          setClaimed(true)
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
      } else {
        if (res.ok && data.transfer) {
          setTransfer(data.transfer)
          toast({
            title: pending ? 'One transfer and you are in' : 'Almost there — one transfer',
            description: pending
              ? 'Send the amount with your reference; your membership activates the moment the office confirms.'
              : 'Send the amount with your reference; the office confirms the moment it lands.',
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
    <Card className="overflow-hidden border-gold-300/60 shadow-navy" id={cardId ?? 'kozy-renewal'}>
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-600">
              {pending
                ? plan.family === 'SHOES'
                  ? 'Almost in the club'
                  : 'Almost in the Circle'
                : paused
                ? 'Your membership has paused'
                : needsRenewal
                  ? 'Your next month'
                  : 'Cover more months'}
            </p>
            <p className="mt-1 font-serif text-xl font-semibold text-navy">
              {pending
                ? 'Complete your first payment'
                : paused
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
          {pending && (
            <Badge variant="outline" className="rounded-full border-gold-200 bg-gold-50 text-gold-700">
              Awaiting payment
            </Badge>
          )}
        </div>

        <p className="mt-2 text-sm leading-relaxed text-navy-300">
          {pending
            ? plan.family === 'SHOES'
              ? `Your ${plan.shoesPerMonth} pair${plan.shoesPerMonth === 1 ? '' : 's'} of cleans a month unlock the moment your first month is paid. Pay by transfer below (or by card when it is available); the kinder 3/6/12-month rates open right after.`
              : `Your ${plan.includedUnits} × ${plan.unitName} pickups start the moment your first month is paid — and your rider schedules the ${plan.unitName} hand-over. Pay by transfer below (or by card when it is available); the 3/6/12-month kinder rates open right after.`
            : paused
            ? `Your ${plan.includedUnits} × ${plan.unitName} pickups restart the moment you renew — your ${plan.unitName} is still yours and your history is intact.`
            : membership.cancelAtPeriodEnd
              ? `You asked us not to auto-renew — the month ends ${periodEnd ? formatDate(periodEnd.toISOString()) : 'soon'}. Change your mind in one tap: renew below and everything continues as before.`
              : needsRenewal
                ? `Your month ends ${periodEnd ? formatDate(periodEnd.toISOString()) : 'soon'} — renew now and your rider keeps collecting at your usual window without a pause.`
                : `You're covered through ${periodEnd ? formatDate(periodEnd.toISOString()) : 'your current month'}. Months added now simply stack onto that date — you never lose a day.`}
        </p>

        {/* Phase 81 — a scheduled switch priced into this payment. */}
        {membership.pendingPlan && !pending && (
          <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-navy-50 px-3 py-2 text-xs font-medium text-navy-700">
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-gold-600" />
            This payment starts the {membership.pendingPlan.name} — your switch lands with it
            ({formatNaira(membership.pendingPlan.priceMonthly)}/month from then on).
          </p>
        )}

        {/* The payment options — the standing ladder: next month, or a
            discounted 3 / 6 / 12-month cover, every discounted rung navy
            (brand). PENDING members see a single first-month line instead —
            the ladder opens the moment the membership is live. Phase 81: the
            ladder prices on the plan being switched TO when one is
            scheduled.
            Task 82 — while a transfer claim awaits the office, the claimed
            months carry an "awaiting confirmation" tag and every OTHER month
            greys out (the owner's ask): the member cannot fire a second
            claim at a different rung while one is mid-flight. */}
        {pending ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">
              Your first month
            </p>
            <p className="mt-2 text-sm text-navy">
              <strong>{formatNaira(price)}</strong>
              <span className="ml-2 text-xs text-navy-300">
                one month · then the kinder 3/6/12-month rates open in this card
              </span>
            </p>
          </div>
        ) : (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">
            {claimOpen ? 'Months awaiting the office' : 'How many months?'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {RENEWAL_MONTH_CHOICES.map((m) => {
              const mSaving = renewalSavingFor((membership.pendingPlan ?? plan).priceMonthly, m)
              const selected = months === m
              const underClaim = claimOpen && m === claimedMonths
              const greyed = claimOpen && !underClaim
              return (
                <button
                  key={m}
                  type="button"
                  disabled={greyed}
                  onClick={() => setMonths(m)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    greyed
                      ? 'cursor-not-allowed border-navy-100 bg-linen-50 text-navy-200'
                      : selected && m > 1
                      ? 'border-navy-500 bg-gradient-to-br from-navy-500 to-navy-700 text-white shadow-sm'
                      : selected
                        ? 'border-gold-400 bg-gold-gradient text-navy shadow-sm'
                        : 'border-navy-200 bg-white text-navy-300 hover:border-navy-300 hover:text-navy'
                  }`}
                >
                  {m === 1 ? '1 month' : `${m} months`}
                  <span
                    className={`ml-1.5 text-xs font-normal ${
                      greyed
                        ? 'text-navy-200'
                        : selected && m > 1
                          ? 'text-gold-200'
                          : 'opacity-80'
                    }`}
                  >
                    {formatNaira(renewalPriceFor((membership.pendingPlan ?? plan).priceMonthly, m))}
                  </span>
                  {m > 1 && mSaving > 0 && !greyed && (
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${
                        selected
                          ? 'bg-white/25 text-white'
                          : 'bg-navy-50 text-navy-700 ring-1 ring-navy-200'
                      }`}
                    >
                      save {formatNaira(mSaving)}
                    </span>
                  )}
                  {underClaim && (
                    <span className="ml-1.5 rounded-full bg-gold-100 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-gold-800 ring-1 ring-gold-300">
                      awaiting confirmation
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {claimOpen ? (
            <p className="mt-2 text-xs leading-relaxed text-navy-700">
              You told us you&apos;ve paid for{' '}
              <strong>{claimedMonths} month{claimedMonths === 1 ? '' : 's'}</strong>
              {openClaim && openClaim.amount > 0 && <> ({formatNaira(openClaim.amount)})</>} — the
              office is confirming it now. The other options open again the moment it&apos;s settled.
            </p>
          ) : months > 1 && saving > 0 ? (
            <p className="mt-2 text-xs text-navy-300">
              One payment of <strong className="text-navy">{formatNaira(price)}</strong> covers your next {months} months —
              <strong className="text-navy-700"> {formatNaira(saving)} less</strong> than paying month by month
              {months >= 6 ? ` (${formatNaira(Math.round(price / months))} a month)` : ''}.
            </p>
          ) : null}
        </div>
        )}

        {/* The payment paths — same two-step pattern as the banner: the
            transfer button reveals the details, then hands the baton to
            "I've made payment" (the claim the office acts on).
            Task 82 — while an open claim awaits the office, BOTH paths rest:
            the money is already mid-flight and a second claim would only
            confuse everyone. */}
        {claimOpen ? (
          <div className="mt-5 rounded-xl border border-gold-200 bg-gold-50/60 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-navy">
              <BadgeCheck className="h-4 w-4 text-gold-600" />
              Payment sent — awaiting the office&apos;s confirmation
            </p>
            {openClaim && (
              <p className="mt-1.5 text-xs leading-relaxed text-navy-300">
                {openClaim.months} month{openClaim.months === 1 ? '' : 's'} ·{' '}
                {openClaim.amount > 0 ? formatNaira(openClaim.amount) : 'the plan price'} · reference{' '}
                <strong className="text-navy">{openClaim.reference}</strong> · noted{' '}
                {formatDate(openClaim.claimedAt)}. Your membership updates the moment the
                office confirms it — nothing else is needed from you.
              </p>
            )}
          </div>
        ) : (
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
          {!transfer ? (
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
          ) : (
            <Button
              onClick={() => renew('BANK_TRANSFER', true)}
              disabled={busy !== null || claimed}
              className={`rounded-full font-semibold ${
                claimed ? 'bg-navy-50 text-navy-400' : 'bg-navy text-white hover:bg-navy-700'
              }`}
            >
              {busy === 'claim' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : claimed ? (
                <BadgeCheck className="mr-2 h-4 w-4" />
              ) : null}
              {claimed
                ? "Payment sent — awaiting the office's confirmation"
                : "I've made payment"}
            </Button>
          )}
        </div>
        )}

        {!paystackAvailable && !claimOpen && (
          <p className="mt-2 text-xs text-navy-300">
            Card payments are not configured yet — bank transfer works today; your{' '}
            {pending ? 'membership activates' : months > 1 ? `${months} months apply` : 'next month applies'} the moment the office confirms.
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
            {claimed && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-navy-700">
                <BadgeCheck className="h-3.5 w-3.5 text-gold-600" />
                You told us you&apos;ve paid — we&apos;re verifying it now.
              </p>
            )}
          </div>
        )}

        <p className="mt-4 text-xs leading-relaxed text-navy-300">
          {pending
            ? 'Once your first month is in, the standing ladder takes over — the longer you cover, the kinder the rate, always.'
            : 'The longer you cover, the kinder the rate — always.'}
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
  kind: 'unit' | 'duvet' | 'curtain' | 'spring-clean' | 'shoes' | 'bedsheet'
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
    bedsheet: {
      title: 'Book your bed sheet wash',
      desc: 'Included with your plan this month — send two every two weeks and the beds never wait. Sheets return fresh, pressed and folded.',
      countLabel: 'Bed sheets',
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
  // Task 82 — the “plans start at” line speaks about the LAUNDRY LADDER only
  // (The Essentials at ₦30,000). The Shoe Club (family=SHOES, from ₦3,000) is
  // a SEPARATE product sold from the /services shoe-care section — quoting it
  // here made the site claim “plans from ₦3,000” while the memberships page
  // showed nothing under ₦30,000. It gets its own quiet line + link instead.
  const laundryPlans = useMemo(
    () => (plans ?? []).filter((p) => p.isActive && p.family !== 'SHOES'),
    [plans]
  )
  const cheapest = useMemo(
    () => laundryPlans.sort((a, b) => a.priceMonthly - b.priceMonthly)[0],
    [laundryPlans]
  )
  const clubCheapest = useMemo(
    () =>
      (plans ?? [])
        .filter((p) => p.isActive && p.family === 'SHOES')
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
        {/* Task 82 — the Shoe Club, on its own quiet line with its own door:
            a shoes-only membership that is NOT one of the laundry tiers. */}
        {clubCheapest && (
          <p className="mt-4 border-t border-linen-100 pt-4 text-xs leading-relaxed text-navy-300">
            Shoes only?{' '}
            <Link
              href="/services#shoe-club"
              className="font-semibold text-navy underline underline-offset-2 transition hover:text-gold-700"
            >
              The Shoe Club
            </Link>{' '}
            is its own membership — {clubCheapest.shoesPerMonth} pairs of cleans a month from{' '}
            {formatNaira(clubCheapest.priceMonthly)}, sold separately from the laundry plans.
          </p>
        )}
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
  onChangePlan,
  tierName,
  tierShoes,
}: {
  clubMembership: ApiMembership
  clubPlan: ApiMembershipPlan
  clubUsage?: ApiMembershipUsage | null
  clubStatus: string
  onBook: () => void
  onCancel: () => void
  onUndo: () => void
  onChangePlan: () => void
  /** Task 82 — the laundry tier this member also holds (if any), so the
   *  club card can say plainly: your tier already includes X pairs — these
   *  club pairs are separate and stack on top. */
  tierName?: string | null
  tierShoes?: number
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

        {/* Task 82 — the two shoe sources, named: club pairs here, tier
            pairs over there. Never a merged mystery number. */}
        {tierName && (tierShoes ?? 0) > 0 && (
          <p className="mt-2 rounded-xl bg-linen-100 px-3 py-2 text-[11px] leading-relaxed text-navy-300">
            These are your <strong className="text-navy">club pairs</strong>. Your {tierName} tier
            separately includes <strong className="text-navy">{tierShoes} shoe clean{tierShoes === 1 ? '' : 's'} a
            month</strong> — booked from your tier card above, each counted on its own.
          </p>
        )}

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

        {/* Phase 81 — the club's own quiet switch (SHOES1 ↔ SHOES3 ↔ SHOES5),
            plus the scheduled-switch line. */}
        {clubStatus !== 'CANCELLED' && clubStatus !== 'LAPSED' && !clubMembership.pendingPlan && (
          <div className="mt-4 text-right">
            <button
              onClick={onChangePlan}
              className="text-xs text-navy-300 underline-offset-2 transition hover:text-gold-600 hover:underline"
            >
              Change plan
            </button>
          </div>
        )}
        {clubMembership.pendingPlan && clubStatus !== 'PENDING_ACTIVATION' && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-navy-300">
            <ArrowLeftRight className="h-3.5 w-3.5 text-gold-600" />
            <span>
              Switching to {clubMembership.pendingPlan.name} at your next renewal ·
              {formatNaira(clubMembership.pendingPlan.priceMonthly)}/month
            </span>
          </p>
        )}

        {clubStatus !== 'PENDING_ACTIVATION' && clubStatus !== 'LAPSED' && clubStatus !== 'CANCELLED' && (
          <div className="mt-2 text-right">
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

// =====================================================
// PlanChangeDialog (phase 81) — the quiet tier switch
// =====================================================
// The owner's brief: money paths between tiers must work seamlessly, and a
// downgrade must be POSSIBLE without ever being pushed — "don't put it all
// in their face or make it too obvious that they can downgrade". So this is
// one neutral "Change plan" door for both directions:
//
//   • every plan listed the same way (name, price, what it includes) —
//     nothing labelled upgrade or downgrade, nothing flashing;
//   • a LIVE membership schedules the switch for its next paid cycle —
//     paid days untouched, no money moves at request time, undo any time;
//   • a PENDING request (not paid yet) switches immediately — the member
//     pays for the tier they actually want, never trapped by the
//     one-membership-per-family rule.
// =====================================================
function PlanChangeDialog({
  currentPlan,
  status,
  periodEnd,
  scheduledPlan,
  family,
  onClose,
}: {
  currentPlan: ApiMembershipPlan
  status: string
  periodEnd: string | null
  scheduledPlan: ApiMembershipPlan | null
  family: 'KIT' | 'SHOES'
  onClose: () => void
}) {
  const { data: plans } = useMembershipPlans(true)
  const planChange = useMembershipPlanChange()
  const [picked, setPicked] = useState<string | null>(null)
  const isClub = family === 'SHOES'
  const pending = status === 'PENDING_ACTIVATION'

  const options = (plans ?? [])
    .filter((p) => p.isActive && p.family === family && p.id !== currentPlan.id)
    .sort((a, b) => a.priceMonthly - b.priceMonthly)

  const pickedPlan = options.find((p) => p.code === picked)

  const onConfirm = async () => {
    if (!pickedPlan) return
    try {
      const res = await planChange.mutateAsync({
        action: 'plan-change',
        planCode: pickedPlan.code,
        family,
      })
      onClose()
      if (res.applied === 'immediately') {
        toast({
          title: `Your request is now on ${pickedPlan.name}`,
          description: `Your first payment (at the top of your portal) is for the new plan — ${formatNaira(pickedPlan.priceMonthly)}.`,
        })
      } else {
        toast({
          title: 'Switch scheduled',
          description: `From your next renewal you'll be on ${pickedPlan.name} at ${formatNaira(pickedPlan.priceMonthly)}/month. You can undo it any time before then.`,
        })
      }
    } catch (e: any) {
      toast({ title: 'Could not change the plan', description: e?.message, variant: 'destructive' })
    }
  }

  const onUndo = async () => {
    try {
      await planChange.mutateAsync({ action: 'plan-change-undo', family })
      onClose()
      toast({
        title: 'Switch undone',
        description: `You'll stay on ${currentPlan.name} — nothing else changes.`,
      })
    } catch (e: any) {
      toast({ title: 'Could not undo', description: e?.message, variant: 'destructive' })
    }
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg text-navy">Change plan</DialogTitle>
          <DialogDescription>
            {pending
              ? `Your ${currentPlan.name} request hasn't been paid yet — switching now simply changes the plan you'll start on.`
              : `Your ${currentPlan.name} runs until ${periodEnd ? formatDate(periodEnd) : 'the end of your paid month'}. A new plan takes over from your next renewal — the switch lands with that payment, and you can undo it any time before then.`}
          </DialogDescription>
        </DialogHeader>

        {scheduledPlan && (
          <div className="mt-2 rounded-xl border border-gold-200 bg-gold-50/60 p-3">
            <p className="text-sm font-semibold text-navy">
              Switching to {scheduledPlan.name} at your next renewal
            </p>
            <p className="mt-1 text-xs text-navy-300">
              {formatNaira(scheduledPlan.priceMonthly)}/month from then on.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={onUndo}
              disabled={planChange.isPending}
              className="mt-2 rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white"
            >
              <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Undo — stay on {currentPlan.name}
            </Button>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {options.length === 0 && (
            <p className="rounded-xl border border-dashed border-navy-200 p-4 text-center text-sm text-navy-300">
              No other plans are available right now.
            </p>
          )}
          {options.map((p) => {
            const selected = picked === p.code
            const descriptor = isClub
              ? `${p.shoesPerMonth} pair${p.shoesPerMonth === 1 ? '' : 's'} of cleans a month`
              : `${p.includedUnits} × ${p.unitName} pickups a month`
            return (
              <button
                key={p.code}
                type="button"
                onClick={() => setPicked(p.code)}
                className={
                  selected
                    ? 'flex w-full items-center justify-between gap-3 rounded-xl border-2 border-gold-300 bg-gold-50/50 p-3 text-left'
                    : 'flex w-full items-center justify-between gap-3 rounded-xl border border-navy-100 p-3 text-left transition hover:border-gold-200'
                }
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy">{p.name}</p>
                  <p className="text-[11px] text-navy-300">{descriptor}</p>
                </div>
                <p className="shrink-0 font-serif text-lg font-bold text-navy">
                  {formatNaira(p.priceMonthly)}
                  <span className="text-[10px] font-normal text-navy-300"> /mo</span>
                </p>
              </button>
            )
          })}
        </div>

        <Button
          onClick={onConfirm}
          disabled={!pickedPlan || planChange.isPending}
          className="mt-4 w-full rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90"
        >
          {planChange.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Switching…
            </>
          ) : pickedPlan ? (
            pending ? (
              <>Switch my request to {pickedPlan.name}</>
            ) : (
              <>
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Switch to {pickedPlan.name} at my next renewal
              </>
            )
          ) : (
            'Pick a plan above'
          )}
        </Button>
        <p className="text-center text-[10px] text-navy-300">
          {pending
            ? 'Nothing is charged until your first payment'
            : 'Nothing is charged now — the new plan starts with your next renewal'}
        </p>
      </DialogContent>
    </Dialog>
  )
}
