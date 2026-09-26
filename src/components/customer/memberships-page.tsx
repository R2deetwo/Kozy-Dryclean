'use client'

// =============================================================================
// MembershipsClient — The Kozy Circle marketing + join flow (phase 62)
// =============================================================================
// Sections: hero (understated, navy/gold) → how the kit works → the three
// tiers (middle anchored) → comparison table → the value math → FAQ → join.
// The join flow lives in-page: signed-out visitors are sent to login first
// (a membership needs an account by design); members land on their portal.
// Paystack members activate instantly via the webhook; transfer members
// attach a receipt and get verified by the team — identical end state.
// =============================================================================

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import {
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Check,
  Minus,
  Package,
  RefreshCcw,
  ConciergeBell,
  BedDouble,
  Layers,
  Sun,
  Scissors,
  Crown,
  ShieldCheck,
  Truck,
  Loader2,
  Upload,
  Banknote,
  CreditCard,
  BadgeCheck,
  LogIn,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { PublicNav } from '@/components/shell/public-nav'
import { SiteFooter } from './site-footer'
import { Logo } from '@/components/shell/logo'
import { formatNaira } from '@/lib/types'
import {
  useMembershipPlans,
  useMyMembership,
  useSubscribe,
  useMembershipPaystackInit,
  type ApiMembershipPlan,
} from '@/lib/hooks'

export function MembershipsClient() {
  const { data: session, status } = useSession()
  const { data: plans, isLoading: plansLoading } = useMembershipPlans(true)
  const { data: myMembership } = useMyMembership()

  const [joinPlan, setJoinPlan] = useState<ApiMembershipPlan | null>(null)

  const activePlans = useMemo(
    () => (plans ?? []).filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [plans]
  )

  const alreadyMember = Boolean(myMembership?.membership)

  return (
    <div className="bg-linen">
      <PublicNav />

      {/* ================= HERO — quiet, confident ================= */}
      <section className="relative overflow-hidden bg-navy-gradient">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-12 h-72 w-72 rounded-full bg-gold-400/10 blur-3xl" />
          <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-gold-400/10 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #D4AF37 1px, transparent 1px), linear-gradient(to bottom, #D4AF37 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:py-24">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-200 ring-1 ring-gold-400/30 backdrop-blur">
            <Sparkles className="h-3 w-3 text-gold-400" />
            The Kozy Circle · Membership
          </div>
          <h1 className="font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl">
            Laundry, on a rhythm.
            <br />
            <span className="text-gold-gradient">Never on your mind.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-navy-100/90 sm:text-lg">
            One monthly plan. We hand you a Kozy Bag or Box, collect it every week, and return
            everything pressed and packaged. No counting, no itemising — the bag sets the size,
            the plan sets the price.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {alreadyMember ? (
              <Link href="/portal">
                <Button
                  size="lg"
                  className="h-12 rounded-full bg-gold-gradient px-6 text-base font-semibold text-navy shadow-gold hover:opacity-90"
                >
                  <BadgeCheck className="mr-2 h-5 w-5" />
                  You&apos;re in the Circle — open your portal
                </Button>
              </Link>
            ) : (
              <a href="#tiers">
                <Button
                  size="lg"
                  className="h-12 rounded-full bg-gold-gradient px-6 text-base font-semibold text-navy shadow-gold hover:opacity-90"
                >
                  See the three circles
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
            )}
            <Link href="/book">
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-white/30 bg-white/5 px-6 text-base font-medium text-white backdrop-blur hover:bg-white/10 hover:text-white"
              >
                <ShoppingBag className="mr-2 h-4 w-4" /> Or book once, as always
              </Button>
            </Link>
          </div>
          <p className="mt-5 text-xs text-navy-100/70">
            Cancel any time · your plan runs to the end of the month · the kit is ours to lend
          </p>
        </div>
      </section>

      {/* ================= HOW IT WORKS — the kit ================= */}
      <section className="border-b border-navy-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
              How the Circle works
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-navy">
              The bag sets the size
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-navy-300">
              No spreadsheets, no garment counts at the door. Your plan is measured by the kit we
              hand you — fill it, that&apos;s a pickup.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Package,
                step: 'One',
                title: 'Your kit arrives',
                body: 'At your very first member pickup, the rider hands over your Kozy Bag or Box. It is ours, on loan to you — that is what keeps the plan honest.',
              },
              {
                icon: RefreshCcw,
                step: 'Every week',
                title: 'Fill it. We collect it.',
                body: 'Book your weekly pickup in one tap from the portal. Leave the filled kit with your rider — or hand over whatever is ready. It returns washed, folded, pressed.',
              },
              {
                icon: ConciergeBell,
                step: 'In between',
                title: 'Everything else still fits',
                body: 'Dry cleaning, shoes, alterations — all still one tap in the regular booking flow, now with your member discount applied automatically.',
              },
            ].map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="h-full border-navy-100 shadow-navy">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-800 text-gold-300">
                        <s.icon className="h-5 w-5" />
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-600">
                        {s.step}
                      </div>
                    </div>
                    <p className="mt-4 font-serif text-lg font-semibold text-navy">{s.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-navy-300">{s.body}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= THE THREE CIRCLES ================= */}
      <section id="tiers" className="bg-linen-200/60">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
              The three circles
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-navy">
              Pick your rhythm
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-navy-300">
              Prices are live from the studio — the team can adjust them any time.
            </p>
          </div>

          {plansLoading ? (
            <div className="mt-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-navy-300" />
            </div>
          ) : (
            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {activePlans.map((plan, i) => {
                const featured = plan.code === 'HOUSEHOLD' || (activePlans.length !== 3 && i === 1)
                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ delay: i * 0.08 }}
                    className={featured ? 'lg:-mt-3 lg:mb-3' : ''}
                  >
                    <Card
                      className={
                        featured
                          ? 'relative h-full border-gold-300 bg-white shadow-gold ring-1 ring-gold-200'
                          : 'relative h-full border-navy-100 bg-white shadow-navy'
                      }
                    >
                      {featured && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="rounded-full bg-gold-gradient px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-navy">
                            Most chosen
                          </Badge>
                        </div>
                      )}
                      <CardContent className="flex h-full flex-col p-6 sm:p-7">
                        <div className="flex items-center justify-between">
                          <p className="font-serif text-xl font-semibold text-navy">{plan.name}</p>
                          {plan.concierge && <Crown className="h-5 w-5 text-gold-500" />}
                        </div>
                        <p className="mt-1 min-h-[40px] text-xs leading-relaxed text-navy-300">
                          {plan.tagline}
                        </p>

                        <div className="mt-4 flex items-end gap-1.5">
                          <span className="font-serif text-4xl font-bold tracking-tight text-navy">
                            {formatNaira(plan.priceMonthly)}
                          </span>
                          <span className="pb-1.5 text-xs text-navy-300">/ month</span>
                        </div>

                        <div className="mt-4 rounded-xl bg-navy-50 p-3 text-center ring-1 ring-navy-100">
                          <p className="text-xs font-semibold text-navy">
                            {plan.includedUnits} × {plan.unitName} {plan.unitKind === 'bag' ? 'wash' : 'pickup'}s
                            a month
                          </p>
                          <p className="mt-0.5 text-[11px] text-navy-300">
                            {plan.unitKind === 'bag'
                              ? 'The long laundry bag — your weekly wash & fold'
                              : 'The big box — the whole household, weekly'}
                          </p>
                        </div>

                        <ul className="mt-5 flex-1 space-y-2.5 text-sm text-navy-200">
                          <Perk included>
                            Free pickup &amp; delivery, every order
                          </Perk>
                          <Perk included>
                            {plan.memberDiscountPct}% off everything à-la-carte
                          </Perk>
                          {plan.maxExtraUnits > 0 && (
                            <Perk included>
                              Up to {plan.maxExtraUnits} extra {plan.unitKind}s at{' '}
                              {formatNaira(plan.extraUnitPrice)} each
                            </Perk>
                          )}
                          <Perk included={plan.duvetsPerQuarter > 0}>
                            {plan.duvetsPerQuarter > 0
                              ? `Quarterly duvet washing — up to ${plan.duvetsPerQuarter} duvets`
                              : 'Duvet care — add from The Household'}
                          </Perk>
                          <Perk included={plan.curtainsPerQuarter > 0}>
                            {plan.curtainsPerQuarter > 0
                              ? `Quarterly curtain care — up to ${plan.curtainsPerQuarter} panels`
                              : 'Curtain care — Concierge circles'}
                          </Perk>
                          <Perk included={plan.springCleanPerYear > 0}>
                            {plan.springCleanPerYear > 0
                              ? 'Annual spring clean — rugs & heavy materials'
                              : 'Spring clean — Concierge circles'}
                          </Perk>
                          <Perk included={plan.concierge}>
                            {plan.concierge
                              ? 'The concierge desk — designer pieces, assessed before every treatment'
                              : 'Concierge desk — The Concierge circle'}
                          </Perk>
                          {plan.prioritySlots && (
                            <Perk included>Priority pickup windows</Perk>
                          )}
                        </ul>

                        <Button
                          onClick={() => {
                            if (alreadyMember) {
                              toast({
                                title: 'You are already in the Circle',
                                description:
                                  'To switch tiers, cancel from your portal first (it stays active to month end), then join the new circle.',
                              })
                              return
                            }
                            if (status !== 'authenticated') {
                              window.location.href = '/login?callbackUrl=/memberships'
                              return
                            }
                            setJoinPlan(plan)
                          }}
                          className={
                            featured
                              ? 'mt-6 w-full rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90'
                              : 'mt-6 w-full rounded-full bg-navy text-white hover:bg-navy-600'
                          }
                        >
                          Join {plan.name}
                        </Button>
                        <p className="mt-2 text-center text-[10px] text-navy-300">
                          Kit lent freely · return it or {formatNaira(plan.replacementFee)} to replace
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ================= VALUE MATH — pays for itself ================= */}
      <section className="bg-navy">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center md:text-left">
              <p className="font-serif text-3xl font-bold text-gold-300">₦6,000+</p>
              <p className="mt-1 text-xs leading-relaxed text-navy-100/80">
                Delivery alone, back in your pocket — four free collections and returns a month at
                today&apos;s {formatNaira(1500)} rate.
              </p>
            </div>
            <div className="text-center md:text-left">
              <p className="font-serif text-3xl font-bold text-gold-300">5–15%</p>
              <p className="mt-1 text-xs leading-relaxed text-navy-100/80">
                Off every dry-clean, shoe restoration and alteration — applied automatically at
                checkout, forever.
              </p>
            </div>
            <div className="text-center md:text-left">
              <p className="font-serif text-3xl font-bold text-gold-300">4 slots</p>
              <p className="mt-1 text-xs leading-relaxed text-navy-100/80">
                Of your week given back. The Circle is not really about laundry — it is about the
                Saturday mornings it returns to you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="border-t border-navy-100 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="text-center font-serif text-3xl font-semibold tracking-tight text-navy">
            Quiet questions, honest answers
          </h2>
          <div className="mt-8 space-y-6">
            {[
              {
                q: 'What if my bag is not full — or overflowing?',
                a: 'A half-full bag still counts as one of your pickups (the rider still rides). An overflowing one becomes your extra unit for the month — up to two extras at the plan rate, charged on that order, nothing surprises you.',
              },
              {
                q: 'What happens to the bag or box if I leave?',
                a: 'It returns with your final delivery and that closes the chapter cleanly. If it does not come back, the replacement fee on your plan covers it — no deposits, no drama.',
              },
              {
                q: 'When do my duvets and curtains refresh?',
                a: 'Quarterly perks reset with the calendar quarter; the annual spring clean resets each January. Your portal always shows what is left, so there is nothing to remember.',
              },
              {
                q: 'Can I really cancel any time?',
                a: 'Yes — one tap in your portal. The membership stays fully active to the last day you paid for, then simply does not renew. No calls, no forms, no retention theatre.',
              },
              {
                q: 'How do I pay?',
                a: 'Card members are charged automatically each month through Paystack. Transfer members receive a reminder before renewal with the studio account details — pay, attach the receipt, and the month extends.',
              },
            ].map((f) => (
              <div key={f.q} className="rounded-2xl border border-navy-100 bg-linen-50 p-5">
                <p className="font-medium text-navy">{f.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-navy-300">{f.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            {alreadyMember ? (
              <Link href="/portal">
                <Button className="rounded-full bg-navy px-8 text-white hover:bg-navy-600">
                  Manage my membership <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <a href="#tiers">
                <Button className="rounded-full bg-gold-gradient px-8 font-semibold text-navy hover:opacity-90">
                  Join the Circle <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
            )}
          </div>
        </div>
      </section>

      <SiteFooter />

      {/* ================= JOIN DIALOG ================= */}
      {joinPlan && (
        <JoinDialog
          plan={joinPlan}
          onClose={() => setJoinPlan(null)}
          sessionEmail={session?.user?.email ?? null}
        />
      )}
    </div>
  )
}

function Perk({ included, children }: { included?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {included ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <Minus className="mt-0.5 h-4 w-4 shrink-0 text-navy-200" />
      )}
      <span className={included ? 'text-navy-200' : 'text-navy-300/60'}>{children}</span>
    </li>
  )
}

// =====================================================
// JOIN DIALOG — confirm plan → choose payment → done
// =====================================================
function JoinDialog({
  plan,
  onClose,
  sessionEmail,
}: {
  plan: ApiMembershipPlan
  onClose: () => void
  sessionEmail: string | null
}) {
  const subscribe = useSubscribe()
  const paystackInit = useMembershipPaystackInit()
  const [paymentMethod, setPaymentMethod] = useState<'PAYSTACK' | 'BANK_TRANSFER'>('PAYSTACK')
  const [receipt, setReceipt] = useState<string | null>(null)
  const [done, setDone] = useState<'paystack-redirect' | 'transfer-pending' | null>(null)
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null)

  const downscaleReceipt = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const maxEdge = 1200
          const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(img.width * scale))
          canvas.height = Math.max(1, Math.round(img.height * scale))
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('Canvas unavailable'))
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.82))
        }
        img.onerror = () => reject(new Error('Could not decode the image'))
        img.src = reader.result as string
      }
      reader.onerror = () => reject(new Error('Could not read the image'))
      reader.readAsDataURL(file)
    })

  const onJoin = async () => {
    try {
      const res = await subscribe.mutateAsync({
        planCode: plan.code,
        paymentMethod,
        ...(receipt ? { transferReceipt: receipt } : {}),
      })
      setSubscriptionId(res.subscription.id)

      if (res.next === 'paystack') {
        setDone('paystack-redirect')
        try {
          const init = await paystackInit.mutateAsync(res.subscription.id)
          window.location.href = init.authorizationUrl
        } catch (e: any) {
          // Paystack unavailable/failed — fall back to transfer guidance.
          toast({
            title: 'Card payment unavailable right now',
            description: e?.message ?? 'Please pay by bank transfer below.',
          })
          setPaymentMethod('BANK_TRANSFER')
          setDone('transfer-pending')
        }
      } else {
        setDone('transfer-pending')
      }
    } catch (e: any) {
      toast({
        title: 'Could not start the membership',
        description: e?.message ?? 'Please try again in a moment.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-md">
        {!done ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl text-navy">
                Join {plan.name}
              </DialogTitle>
              <DialogDescription>
                {plan.includedUnits} × {plan.unitName} pickups a month · free delivery ·{' '}
                {plan.memberDiscountPct}% off à-la-carte
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl bg-navy-50 p-4 ring-1 ring-navy-100">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-navy">Monthly</span>
                <span className="font-serif text-3xl font-bold text-navy">
                  {formatNaira(plan.priceMonthly)}
                </span>
              </div>
              {sessionEmail && (
                <p className="mt-2 text-[11px] text-navy-300">Billed to {sessionEmail}</p>
              )}
            </div>

            {/* Payment method */}
            <div className="mt-4 space-y-2">
              <button
                onClick={() => setPaymentMethod('PAYSTACK')}
                className={
                  paymentMethod === 'PAYSTACK'
                    ? 'flex w-full items-center gap-3 rounded-xl border-2 border-gold-300 bg-gold-50/50 p-3 text-left'
                    : 'flex w-full items-center gap-3 rounded-xl border border-navy-100 p-3 text-left transition hover:border-gold-200'
                }
              >
                <CreditCard className="h-5 w-5 shrink-0 text-navy" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy">Pay by card</p>
                  <p className="text-[11px] text-navy-300">
                    Instant activation · renews automatically each month
                  </p>
                </div>
              </button>
              <button
                onClick={() => setPaymentMethod('BANK_TRANSFER')}
                className={
                  paymentMethod === 'BANK_TRANSFER'
                    ? 'flex w-full items-center gap-3 rounded-xl border-2 border-gold-300 bg-gold-50/50 p-3 text-left'
                    : 'flex w-full items-center gap-3 rounded-xl border border-navy-100 p-3 text-left transition hover:border-gold-200'
                }
              >
                <Banknote className="h-5 w-5 shrink-0 text-navy" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy">Pay by bank transfer</p>
                  <p className="text-[11px] text-navy-300">
                    Attach your receipt · we activate on verification
                  </p>
                </div>
              </button>
            </div>

            {paymentMethod === 'BANK_TRANSFER' && (
              <div className="mt-3 rounded-xl border border-dashed border-navy-200 p-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <Upload className="h-4 w-4 shrink-0 text-navy-300" />
                  <span className="text-xs text-navy-300">
                    {receipt ? 'Receipt attached — looking good' : 'Attach your transfer receipt (optional now)'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      try {
                        setReceipt(await downscaleReceipt(file))
                      } catch {
                        toast({
                          title: 'Receipt not attached',
                          description: "We couldn't read that image — you can continue without it.",
                          variant: 'destructive',
                        })
                      }
                    }}
                  />
                </label>
              </div>
            )}

            <Button
              onClick={onJoin}
              disabled={subscribe.isPending || paystackInit.isPending}
              className="mt-4 w-full rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90"
            >
              {subscribe.isPending || paystackInit.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting…
                </>
              ) : (
                <>
                  Start my membership · {formatNaira(plan.priceMonthly)}/mo
                </>
              )}
            </Button>
            <p className="text-center text-[10px] text-navy-300">
              Cancel any time — the plan runs to the end of the month
            </p>
          </>
        ) : done === 'transfer-pending' ? (
          <div className="py-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold-100">
              <BadgeCheck className="h-7 w-7 text-gold-600" />
            </div>
            <DialogTitle className="mt-4 font-serif text-xl text-navy">
              Almost in the Circle
            </DialogTitle>
            <p className="mt-2 text-sm leading-relaxed text-navy-300">
              Transfer <strong className="text-navy">{formatNaira(plan.priceMonthly)}</strong> to the
              studio account (bank details are in your portal and your confirmation email). The
              moment our team verifies it, your month starts and your rider schedules the kit
              hand-over.
            </p>
            <Link href="/portal" className="mt-5 block">
              <Button className="w-full rounded-full bg-navy text-white hover:bg-navy-600">
                Open my portal <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-gold-500" />
            <p className="mt-3 text-sm text-navy-300">
              Taking you to the secure card checkout…
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
