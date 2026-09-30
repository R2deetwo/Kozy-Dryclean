'use client'

// =============================================================================
// MembershipsClient — Plans & Pricing: the Kozy Circle + the full price list
// (phase 62 → 64)
// =============================================================================
// Phase 64 (owner): pricing and the plans are MERGED here — plans first, the
// per-item price list below. Phase 66 (owner): plain language throughout and
// a visible FIND-YOUR-PLAN persona strip (the ideal customer profiles, named).
// Phase 67 (owner): three plans sized by kit (Essentials bag → Household box
// → Whole Home) — couture and designer wear is NOT a tier, it is the separate
// Couture Care specialist service on /services, routed from the persona strip
// and a pointer band after the plans. Sections:
// hero (recycled handover photo) → how the plan works → find your plan →
// the three plans → couture pointer → the value math → the per-item price list
// (PricingTables) → FAQ → join. The join flow lives in-page: signed-out
// visitors are sent to login first (a membership needs an account by design);
// members land on their portal. Paystack members activate instantly via the
// webhook; transfer members attach a receipt and get verified by the team —
// identical end state.
// =============================================================================

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import NextImage from 'next/image'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Check,
  Minus,
  Package,
  RefreshCcw,
  Shirt,
  Home,
  Users,
  Briefcase,
  Crown,
  Loader2,
  BadgeCheck,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { PublicNav } from '@/components/shell/public-nav'
import { SiteFooter } from './site-footer'
import { PricingTables } from './pricing-tables'
import { StickyMobileCta } from './sticky-mobile-cta'
import { JoinDialog } from './join-dialog'
import { Logo } from '@/components/shell/logo'
import { formatNaira } from '@/lib/types'
import {
  useMembershipPlans,
  useMyMembership,
  type ApiMembershipPlan,
} from '@/lib/hooks'

export function MembershipsClient() {
  const { data: session, status } = useSession()
  const { data: plans, isLoading: plansLoading } = useMembershipPlans(true)
  const membershipQuery = useMyMembership()
  const myMembership = membershipQuery.data

  const [joinPlan, setJoinPlan] = useState<ApiMembershipPlan | null>(null)

  // Phase 73 — a lingering rider/partner/team session must NEVER surface as
  // “Billed to” in the join dialog. Only genuine customer sessions (B2C/B2B)
  // count as signed-in here; everything else gets the dialog's account step.
  const sessionRole = typeof session?.user?.role === 'string' ? session.user.role : null
  const isCustomerSession =
    status === 'authenticated' && (sessionRole === 'B2C' || sessionRole === 'B2B')

  // Phase 70: only the KIT family renders here — the tiers grid is the
  // laundry ladder. The standalone Shoe Club (family=SHOES) is sold from the
  // /services shoe-care section, never as a fourth card here.
  const activePlans = useMemo(
    () =>
      (plans ?? [])
        .filter((p) => p.isActive && (p.family ?? 'KIT') === 'KIT')
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [plans]
  )

  const alreadyMember = Boolean(myMembership?.membership)
  // Phase 81 — a PENDING member on this page is here to PAY, not to browse:
  // their hero CTA becomes "Complete my first payment" → the banner at the
  // top of their portal (the deep link carries the focus).
  const pendingMember =
    alreadyMember &&
    (myMembership?.effectiveStatus ?? myMembership?.membership?.status) === 'PENDING_ACTIVATION'

  // Phase 80 — the join deep link: /memberships?join=ESSENTIALS re-opens the
  // exact plan's dialog. It arrives from the JoinDialog's own account step,
  // carried through signup → verification email → login (the chain that used
  // to lose the plan at the first hop). Guarded: only once the plan rows are
  // live AND the membership probe has settled (signed-out probes error — that
  // counts as settled and not-a-member); the param is stripped after use so a
  // refresh never re-triggers the dialog.
  // Phase 81 — a PENDING member carrying a join link is taken STRAIGHT to
  // their payment (they cannot join a second tier; the banner is where their
  // money lives). A live member simply browses — their switch door is Change
  // plan in the portal, never this page.
  useEffect(() => {
    if (joinPlan) return
    if (!activePlans.length) return
    if (!(membershipQuery.isSuccess || membershipQuery.isError)) return
    const code = new URLSearchParams(window.location.search).get('join')
    if (!code) return
    if (pendingMember) {
      window.history.replaceState({}, '', '/memberships')
      window.location.href = '/portal?pay=1'
      return
    }
    if (alreadyMember) return
    const target = activePlans.find(
      (p) => p.code.toUpperCase() === code.trim().toUpperCase()
    )
    if (!target) return
    setJoinPlan(target)
    window.history.replaceState({}, '', '/memberships')
  }, [joinPlan, alreadyMember, pendingMember, activePlans, membershipQuery.isSuccess, membershipQuery.isError])

  return (
    <div className="bg-linen">
      <PublicNav />

      {/* ================= HERO — quiet, confident, with a face ================= */}
      {/* The handover photo is recycled from the home page's lifestyle band
          (same asset, browser-cached, no new page weight) — a rider, a bag,
          a doorstep: the Circle has a human face now. Two-column on desktop
          like the home hero; the image stacks under the text on phones. */}
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

        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:py-20">
          <div className="text-center lg:text-left">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-200 ring-1 ring-gold-400/30 backdrop-blur">
              <Sparkles className="h-3 w-3 text-gold-400" />
              The Kozy Circle · Plans &amp; prices
            </div>
            <h1 className="font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl">
              Laundry, on a rhythm.
              <br />
              <span className="text-gold-gradient">Never on your mind.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-navy-100/90 sm:text-lg lg:mx-0">
              One monthly price. We hand you a Kozy Bag or Box, collect it every
              week, and bring everything back washed, pressed and packed. No
              counting items, no surprises. Prefer to pay per item? The{' '}
              <a
                href="#pricing"
                className="font-semibold text-gold-200 underline decoration-gold-400/60 underline-offset-4 transition hover:text-gold-100"
              >
                full price list
              </a>{' '}
              is right below.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              {alreadyMember ? (
                <Link href={pendingMember ? '/portal?pay=1' : '/portal'}>
                  <Button
                    size="lg"
                    className="h-12 rounded-full bg-gold-gradient px-6 text-base font-semibold text-navy shadow-gold hover:opacity-90"
                  >
                    <BadgeCheck className="mr-2 h-5 w-5" />
                    {pendingMember
                      ? 'Your payment is waiting — complete it now'
                      : "You're in the Circle — open your portal"}
                  </Button>
                </Link>
              ) : (
                <a href="#tiers">
                  <Button
                    size="lg"
                    className="h-12 rounded-full bg-gold-gradient px-6 text-base font-semibold text-navy shadow-gold hover:opacity-90"
                  >
                    Find your plan
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
              Cancel any time · your plan runs to the end of the month · the kit is ours to
              lend
            </p>
          </div>

          {/* Handover photo — recycled from the home page's footer band */}
          <div className="relative">
            <div className="relative h-[300px] overflow-hidden rounded-2xl ring-1 ring-gold-400/30 shadow-2xl shadow-navy-900/40 sm:h-[380px] lg:h-[420px]">
              <NextImage
                src="/brand/images/laundry-handover.png"
                alt="A Kozy rider handing a freshly cleaned laundry bag back to a customer at her doorstep"
                fill
                priority
                quality={85}
                sizes="(min-width: 1024px) 45vw, 100vw"
                placeholder="blur"
                blurDataURL="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjEwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjAiIHkyPSIxIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMxNTMwNTAiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwQTE5MkYiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSIxMCIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg=="
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-900/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="rounded-xl bg-navy/80 px-4 py-3 backdrop-blur ring-1 ring-gold-400/30">
                  <p className="font-serif text-sm font-semibold text-gold-100">
                    Your Kozy Bag, on rotation
                  </p>
                  <p className="text-[11px] text-navy-100">
                    Collected every week · returned pressed and packaged
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS — the kit ================= */}
      <section className="border-b border-navy-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
              How the plan works
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-navy">
              The bag sets the size
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-navy-300">
              No counting clothes at the door. Your plan is measured by the kit we
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
                icon: Shirt,
                step: 'In between',
                title: 'Everything else, one tap',
                body: 'Dry cleaning, shoes, alterations — book them as always. Your member discount applies automatically.',
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

      {/* ================= FIND YOUR PLAN — the ideal customers, by name ================= */}
      {/* The owner asked for the ideal customer profiles to be VISIBLE in the
          arrangement, not just implied: four one-glance personas. Three point
          straight at the plan built for them; the fourth (the designer-wardrobe
          owner) routes to Couture Care — the separate specialist service, not
          a bigger plan (phase 67). */}
      <section className="border-b border-navy-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
              Not sure where to start?
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-navy">
              Find yourself below
            </h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Briefcase,
                label: '“Always in work clothes”',
                line: 'Shirts and suits, Monday to Friday. One weekly bag keeps up.',
                cta: 'Start with The Essentials',
                href: '#tier-essentials',
              },
              {
                icon: Users,
                label: '“Dressing a whole family”',
                line: 'Everyone’s weekly load — school, work, weekend — plus the beds.',
                cta: 'Start with The Household',
                href: '#tier-household',
              },
              {
                icon: Home,
                label: '“Running a full home”',
                line: 'Duvets, curtains and a yearly deep clean, all inside one plan.',
                cta: 'Start with The Whole Home',
                href: '#tier-wholehome',
              },
              {
                icon: Crown,
                label: '“My wardrobe is the investment”',
                line: 'Designer, couture and premium traditional wear — a specialist service, priced per piece.',
                cta: 'See Couture Care — a separate service',
                href: '/services#couture',
              },
            ].map((p, i) => (
              <motion.a
                key={p.href}
                href={p.href}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: i * 0.06 }}
                className="group rounded-2xl border border-navy-100 bg-linen-50 p-5 transition hover:border-gold-300 hover:bg-white hover:shadow-navy"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-800 text-gold-300">
                  <p.icon className="h-5 w-5" />
                </div>
                <p className="mt-3 font-serif text-base font-semibold text-navy">{p.label}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-navy-300">{p.line}</p>
                <p className="mt-3 text-[11px] font-semibold text-gold-700">
                  {p.cta}
                  <ArrowRight className="ml-1 inline h-3 w-3 transition group-hover:translate-x-0.5" />
                </p>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* ================= THE PLANS ================= */}
      <section id="tiers" className="bg-linen-200/60">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
              The plans
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-navy">
              Pick the plan that fits your life
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
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {activePlans.map((plan, i) => {
                const featured = plan.code === 'HOUSEHOLD'
                const tier = TIER_PRESENTATION[plan.code] ?? TIER_PRESENTATION.__default
                const TierIcon = tier.icon
                return (
                  <motion.div
                    key={plan.id}
                    id={`tier-${plan.code.toLowerCase()}`}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ delay: i * 0.08 }}
                    className={cn('scroll-mt-28', featured && 'xl:-mt-3 xl:mb-3')}
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
                      <CardContent className="flex h-full flex-col p-5 sm:p-6">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-800 text-gold-300">
                            <TierIcon className="h-4 w-4" />
                          </div>
                          <p className="font-serif text-lg font-semibold text-navy">{plan.name}</p>
                        </div>
                        <p className="mt-2 min-h-[40px] text-[11px] leading-relaxed text-navy-300">
                          {plan.tagline}
                        </p>
                        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-700">
                          {tier.who}
                        </p>

                        <div className="mt-3 flex items-end gap-1.5">
                          <span className="font-serif text-3xl font-bold tracking-tight text-navy">
                            {formatNaira(plan.priceMonthly)}
                          </span>
                          <span className="pb-1 text-[11px] text-navy-300">/ month</span>
                        </div>

                        <div className="mt-3 rounded-xl bg-navy-50 p-2.5 text-center ring-1 ring-navy-100">
                          <p className="text-[11px] font-semibold text-navy">
                            {`${plan.includedUnits} × ${plan.unitName} pickups a month`}
                          </p>
                          <p className="mt-0.5 text-[10px] leading-relaxed text-navy-300">
                            {plan.unitKind === 'bag'
                              ? 'The long laundry bag — your weekly wash & fold'
                              : 'The big box — the whole household, weekly'}
                          </p>
                          {plan.shoesPerMonth > 0 && (
                            <p className="mt-1.5 border-t border-navy-100 pt-1.5 text-[10px] font-semibold text-gold-700">
                              + {plan.shoesPerMonth} pair{plan.shoesPerMonth === 1 ? '' : 's'} of shoes every month
                            </p>
                          )}
                        </div>

                        <ul className="mt-4 flex-1 space-y-2 text-[13px] text-navy-200">
                          <Perk included>
                            Free pickup &amp; delivery, every order
                          </Perk>
                          <Perk included>
                            {plan.memberDiscountPct}% off everything else
                          </Perk>
                          {plan.maxExtraUnits > 0 && (
                            <Perk included>
                              Extra {plan.unitKind}s when you need them — {formatNaira(plan.extraUnitPrice)} each
                            </Perk>
                          )}
                          <Perk included={plan.shoesPerMonth > 0}>
                            {plan.shoesPerMonth > 0
                              ? `${plan.shoesPerMonth} pair${plan.shoesPerMonth === 1 ? '' : 's'} of shoes cleaned every month`
                              : 'Shoe care — à-la-carte, with your member discount'}
                          </Perk>
                          <Perk included={plan.duvetsPerQuarter > 0}>
                            {plan.duvetsPerQuarter > 0
                              ? `${plan.duvetsPerQuarter} duvet washes free, every 3 months`
                              : 'Duvet washing — starts with The Household'}
                          </Perk>
                          <Perk included={plan.curtainsPerQuarter > 0}>
                            {plan.curtainsPerQuarter > 0
                              ? `Curtains cleaned free — ${plan.curtainsPerQuarter} panels every 3 months`
                              : 'Curtains — starts with The Whole Home'}
                          </Perk>
                          <Perk included={plan.springCleanPerYear > 0}>
                            {plan.springCleanPerYear > 0
                              ? 'One whole-home deep clean, every year'
                              : 'Yearly deep clean — The Whole Home'}
                          </Perk>
                          {plan.prioritySlots && (
                            <Perk included>First pick of pickup times</Perk>
                          )}
                        </ul>

                        <Button
                          onClick={() => {
                            if (alreadyMember) {
                              toast({
                                title: 'You are already in the Circle',
                                description:
                                  'To switch tiers, use Change plan in your portal\'s Membership tab — it takes effect at your next renewal.',
                              })
                              return
                            }
                            // Signed-out and non-customer sessions are handled
                            // INSIDE the dialog now (account step) — no more
                            // blind redirects that lose the plan context.
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

      {/* ================= COUTURE POINTER — the service that is not a plan ================= */}
      {/* Phase 67 (owner): couture and designer wear is NOT a fourth tier — it
          is the separate Couture Care specialist service on /services. This
          quiet band sits right where the retired tier used to be, so the
          designer-wardrobe persona (ICP 4) still finds a home on the page
          without the plans pretending to size it. */}
      <section className="border-b border-navy-100 bg-linen-100/60 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Link
            href="/services#couture"
            className="group flex flex-col items-start justify-between gap-4 rounded-2xl border border-gold-200 bg-white p-5 shadow-navy transition-shadow hover:shadow-lg hover:ring-1 hover:ring-gold-200 sm:flex-row sm:items-center"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy-800 text-gold-300">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <p className="font-serif text-lg font-semibold text-navy">
                  Designer, couture or premium traditional wear?
                </p>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-navy-300">
                  That is not a bigger plan — it is a different craft.{' '}
                  <span className="font-medium text-navy">Couture Care</span> is our
                  specialist service: every piece assessed before treatment, cleaned and
                  finished by hand, returned in protective covers, and quoted for your
                  approval before any work begins. Circle members get their plan discount
                  on the quote.
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-gold-gradient px-5 py-2.5 text-xs font-bold text-navy transition group-hover:opacity-90">
              See Couture Care <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
            </span>
          </Link>
        </div>
      </section>

      {/* ================= VALUE MATH — pays for itself ================= */}
      <section className="bg-navy">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center md:text-left">
              <p className="font-serif text-3xl font-bold text-gold-300">₦6,000+</p>
              <p className="mt-1 text-xs leading-relaxed text-navy-100/80">
                Delivery money, back in your pocket — free collection and return on every single
                order.
              </p>
            </div>
            <div className="text-center md:text-left">
              <p className="font-serif text-3xl font-bold text-gold-300">5–20%</p>
              <p className="mt-1 text-xs leading-relaxed text-navy-100/80">
                Off every dry-clean, shoe restoration and alteration — applied automatically at
                checkout.
              </p>
            </div>
            <div className="text-center md:text-left">
              <p className="font-serif text-3xl font-bold text-gold-300">Your Saturdays</p>
              <p className="mt-1 text-xs leading-relaxed text-navy-100/80">
                The plan is not really about laundry — it is about the weekend it quietly hands
                back to you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= À-LA-CARTE PRICE LIST (merged, phase 64) ================= */}
      {/* The owner's merge: plans first (above), the full per-item price list
          below — same component /services used, same server-managed numbers,
          #pricing anchor for deep links from the home page and footer. */}
      <PricingTables
        onBook={() => {
          window.location.href = '/book'
        }}
      />

      {/* ================= FAQ ================= */}
      <section className="border-t border-navy-100 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="text-center font-serif text-3xl font-semibold tracking-tight text-navy">
            Quiet questions, honest answers
          </h2>
          <div className="mt-8 space-y-6">
            {[
              {
                q: 'What about couture, designer or premium traditional wear?',
                a: 'That is Couture Care — its own specialist service, not a bigger plan. Designer pieces, aso-oke and lace, agbada, bridal: every piece is assessed before treatment, cleaned and finished by hand, returned in protective covers, and quoted for your approval before any work begins. Circle members get their plan discount on the quote. If you are unsure, send it with your next pickup — the studio will tell you honestly whether it needs the specialists or the normal wash.',
              },
              {
                q: 'Do the plans really include shoes?',
                a: 'Yes — every plan cleans shoes monthly, on the house: 1 pair on The Essentials, 3 pairs on The Household, 5 pairs on The Whole Home. One pair means the standard sneaker and canvas clean (washed, brushed, deodorised); suede, leather and embellished pairs use the specialist service with your member discount. Need more pairs than your plan includes — or shoes only, without a laundry plan? The Shoe Club adds 2, 4 or 6 pairs a month and stacks on top of any tier.',
              },
              {
                q: 'What if my bag is not full — or overflowing?',
                a: 'A half-full bag still counts as one of your pickups (the rider still rides). An overflowing one becomes an extra pickup — up to two a month at the plan rate, charged on that order. Nothing surprises you.',
              },
              {
                q: 'What happens to the bag or box if I leave?',
                a: 'It returns with your final delivery and that closes the chapter cleanly. If it does not come back, the replacement fee on your plan covers it — no deposits, no drama.',
              },
              {
                q: 'When do my duvets and curtains refresh?',
                a: 'Duvet and curtain perks reset every 3 months; the yearly deep clean resets each January. Your portal always shows what is left, so there is nothing to remember.',
              },
              {
                q: 'Can I really cancel any time?',
                a: 'Yes — one tap in your portal. The plan stays fully active to the last day you paid for, then simply does not renew. No calls, no forms, no drama.',
              },
              {
                q: 'How do I pay?',
                a: 'Card members are charged automatically each month through Paystack. Transfer members get a reminder before renewal with the studio account details — pay, attach the receipt, and the month extends.',
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
              <Link href={pendingMember ? '/portal?pay=1' : '/portal'}>
                <Button className="rounded-full bg-navy px-8 text-white hover:bg-navy-600">
                  {pendingMember ? 'Complete my first payment' : 'Manage my membership'}{' '}
                  <ArrowRight className="ml-2 h-4 w-4" />
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
      <StickyMobileCta
        onBook={() => {
          window.location.href = '/book'
        }}
      />

      {/* ================= JOIN DIALOG ================= */}
      {joinPlan && (
        <JoinDialog
          plan={joinPlan}
          onClose={() => setJoinPlan(null)}
          sessionEmail={isCustomerSession ? session?.user?.email ?? null : null}
          sessionRole={sessionRole}
          authStatus={status}
        />
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Tier presentation — plain-words positioning per plan code. All NUMBERS on
// the cards come from the database (admin-adjustable); this map only carries
// the icon and the one-glance "who is this for" line.
// -----------------------------------------------------------------------------
const TIER_PRESENTATION: Record<string, { icon: LucideIcon; who: string }> = {
  ESSENTIALS: { icon: ShoppingBag, who: 'For one busy person' },
  HOUSEHOLD: { icon: Users, who: 'For a family' },
  WHOLEHOME: { icon: Home, who: 'For a full house — beds, curtains, all' },
  __default: { icon: Package, who: 'A Kozy Circle plan' },
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
