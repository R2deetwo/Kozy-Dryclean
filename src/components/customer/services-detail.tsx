'use client'

// =============================================================================
// ServicesDetail — the specialty care content (phases 45 → 64 → 67 → 70).
// =============================================================================
// Phase 45 moved the full pricing tables, atelier story, sneaker restoration
// and alterations off the home page onto /services. Phase 64 (owner): pricing
// and the membership plans are now MERGED on /memberships — "Plans & Pricing",
// plans first, price list below — so this page keeps the specialty story.
// Phase 67 (owner): couture, designer and premium traditional wear is its own
// NAMED SPECIALIST SERVICE — Couture Care — not a membership tier (industry
// pattern: Jeeves, Margaret's, Hallak). A short pointer strip at the top
// (keeping the #pricing anchor) routes anyone who arrived via an old
// "pricing" deep link to the merged page.
// Phase 70 (owner): the standalone SHOE CLUB lives in this shoe-care section
// — a shoes-only monthly subscription, deliberately NOT part of the laundry
// tiers. Priced from live plan rows (admin-adjustable) to undercut the
// dedicated sneaker laundries in Lagos (researched at ₦7,000–₦8,000 a pair
// for a basic clean).
// =============================================================================

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Ruler,
  Scissors,
  Tag,
  Footprints,
  Check,
} from 'lucide-react'
import { formatNaira } from '@/lib/types'
import { useAppSettings, useMembershipPlans, useMyMembership, type ApiMembershipPlan } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { JoinDialog } from './join-dialog'

interface Props {
  onBook: () => void
  /** Deep-link straight into the wizard's Shoes tab (shoe-care section CTA).
   *  Falls back to onBook when not provided. */
  onBookShoes?: () => void
}

export function ServicesDetail({ onBook, onBookShoes }: Props) {
  // Server-managed commercial terms — alterations pricing lives here; the
  // per-item price list itself now renders on /memberships (PricingTables).
  const appSettings = useAppSettings()

  // ----- The Shoe Club (phase 70): live plan rows, SHOES family only -----
  const { data: session } = useSession()
  const { data: plans } = useMembershipPlans(true)
  const { data: myMembership } = useMyMembership()
  const [joinPlan, setJoinPlan] = useState<ApiMembershipPlan | null>(null)

  const clubPlans = useMemo(
    () =>
      (plans ?? [])
        .filter((p) => p.isActive && p.family === 'SHOES' && p.shoesPerMonth > 0)
        .sort((a, b) => a.shoesPerMonth - b.shoesPerMonth),
    [plans]
  )
  const inClub = Boolean(myMembership?.shoeClub)

  const onJoinClub = (plan: ApiMembershipPlan) => {
    if (!session) {
      // A membership lives in an account — same gate as the tiers page.
      window.location.assign('/login?callbackUrl=/services%23shoe-care')
      return
    }
    setJoinPlan(plan)
  }

  return (
    <>
      {/* ============================================================
          PRICING POINTER — plans & prices merged on /memberships
          (phase 64). The anchor is kept so old /services#pricing deep
          links (and Google's index) land somewhere honest instead of
          nowhere; one click takes the visitor to the merged page.
      ============================================================ */}
      <section id="pricing" className="border-b border-navy-100 bg-linen-50 py-8 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Link
            href="/memberships#pricing"
            className="group flex flex-col items-start justify-between gap-3 rounded-2xl border border-gold-200 bg-white p-5 shadow-navy transition-shadow hover:shadow-lg hover:ring-1 hover:ring-gold-200 sm:flex-row sm:items-center"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-100">
                <Tag className="h-5 w-5 text-gold-600" />
              </div>
              <div>
                <p className="font-serif text-lg font-semibold text-navy">
                  Looking for prices? They moved in with the plans.
                </p>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-navy-300">
                  One page now: the three Kozy Circle monthly plans first, the full
                  per-item price list below them — men, women, home and the per-kg
                  corporate program. Specialty care stays right here — and couture
                  pieces are always quoted after a free assessment, never flat-priced.
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-gold-gradient px-5 py-2.5 text-xs font-bold text-navy transition group-hover:opacity-90">
              Plans &amp; prices <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
            </span>
          </Link>
        </div>
      </section>

      {/* ============================================================
          COUTURE CARE — the specialist service (phase 67, owner directive)
          Couture, designer and premium traditional wear is deliberately NOT
          a membership tier — the industry pattern (Jeeves of Belgravia's
          couture division, Margaret's The Couture Cleaner, Hallak's
          inspection-first process) is a NAMED SPECIALIST SERVICE priced per
          piece: assess first (fabric tests, beading/sequins identified),
          hand-clean, hand-finish, return protected — quoted for approval
          before any work begins. The old #atelier anchor is kept inside the
          section so existing deep links still land here.
      ============================================================ */}
      <section id="couture" className="bg-navy-gradient py-20 text-white scroll-mt-20">
        <span id="atelier" className="block scroll-mt-20" aria-hidden />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="mb-0 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
                Couture Care — the specialist service
              </p>
              <Badge className="bg-gold-400 text-navy hover:bg-gold-400">
                Priced per piece
              </Badge>
            </div>
            <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
              For the pieces you don&rsquo;t trust to just anyone.
            </h2>
            <p className="mt-4 max-w-xl text-navy-100">
              Designer and couture pieces. Aso-oke and lace. Agbada with hand-sewn
              beadwork. Bridal gowns and heirloom silks. Some clothes are worth more
              than a ticket — so they get their own service, their own specialists,
              and their own process.
            </p>

            <ol className="mt-6 space-y-3 text-sm">
              {[
                {
                  t: 'Assessed first, always',
                  d: 'Every piece is inspected before anything touches it — fabric and trim tested, beading, sequins and leather trim identified, and the process chosen for that exact piece.',
                },
                {
                  t: 'Cleaned by hand',
                  d: 'Fabric-specific detergents and gentle hand-cleaning in dedicated zones for silks, wools and traditional fabrics — never the same cycle as everything else.',
                },
                {
                  t: 'Finished by hand',
                  d: 'Steam-only finishing for delicate structures, seams pressed by hand, shape and drape preserved — nothing leaves the floor untagged.',
                },
                {
                  t: 'Returned protected',
                  d: 'Sealed in protective garment covers and delivered to your door — the same free island-wide pickup and delivery as everything else.',
                },
              ].map((s, i) => (
                <li key={s.t} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-400 text-[11px] font-bold text-navy">
                    {i + 1}
                  </span>
                  <span>
                    <span className="font-semibold text-white">{s.t}</span>
                    <span className="text-navy-100"> — {s.d}</span>
                  </span>
                </li>
              ))}
            </ol>

            {/* Pricing posture: quote-first, assessment-first — the same
                honest pattern as wedding dresses, sneaker restorations and
                alterations (owner directive), and how the couture divisions
                of premium cleaners price. */}
            <p className="mt-6 rounded-xl border border-gold-400/30 bg-white/5 p-4 text-sm leading-relaxed text-white/90">
              <span className="font-semibold text-gold-300">Quoted, never flat-priced</span> —
              beading, fabric and detail change the work. The assessment is free with
              your pickup: we inspect the piece, send you a quote, and nothing begins
              until you approve it. If a piece is too delicate to treat safely, we
              say so honestly — no charge, no wasted collection. Circle members get
              their plan discount on the final quote.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                onClick={onBook}
                className="rounded-full bg-gold-gradient px-6 text-navy hover:opacity-90"
              >
                Book a couture pickup <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <a
                href="tel:+2348031755230"
                className="inline-flex h-10 items-center rounded-full border border-white/30 bg-white/5 px-5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/10"
              >
                Call to discuss it first
              </a>
            </div>
          </motion.div>

          <div className="overflow-hidden rounded-2xl ring-1 ring-gold-400/30 shadow-2xl">
            <img
              src="/brand/images/atelier-craftsman.png"
              alt="Kozy master presser hand-finishing a premium garment at the steam station"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* ============================================================
          SHOE CLEANING & RESTORATION — new service section
      ============================================================ */}
      <section id="shoe-care" className="bg-navy py-20 text-white scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 items-center">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
                Beyond Laundry
              </p>
              <h2 className="font-serif text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Sneaker &amp; Trainer Restoration
              </h2>
              <p className="mt-4 max-w-xl text-white">
                Got beat-up Jordans? Muddy Sambas? Yellowed Air Force soles? Our sneaker
                restoration specialists bring your favourite kicks back to box-fresh condition.
                From deep cleans to sole whitening to full restorations — we treat your
                sneakers like collectibles.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  'Deep clean & stain removal for sneakers, trainers, and canvas shoes',
                  'Sole whitening & midsole restoration (yellowing reversal)',
                  'Suede & nubuck revival for premium sneakers',
                  'Insole & lace replacement options',
                  'Repainting & colour restoration for scuffed uppers',
                  'Protective coating to keep them fresh longer',
                  'Free assessment — we confirm your pair can be saved before you commit',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                    <span className="text-white">{t}</span>
                  </li>
                ))}
              </ul>
              {/* Restoration consultation (owner directive): assessment-first,
                  exactly like a wedding-dress wash — a pair that is beyond
                  restoration should be declined BEFORE the trip, not after. */}
              <p className="mt-6 rounded-xl border border-gold-400/30 bg-white/5 p-4 text-sm leading-relaxed text-white/90">
                <span className="font-semibold text-gold-300">Restorations from ₦5,000</span> —
                priced by the extent of work after a free assessment. Every restoration
                starts with a consultation: our specialist inspects the pair, tells you
                honestly whether it can be saved, and sends the final quote for your
                approval before any work begins. If it&apos;s beyond restoration, we say so
                upfront — no charge, no wasted collection.
              </p>
              <Button
                onClick={onBookShoes ?? onBook}
                className="mt-7 rounded-full bg-gold-gradient px-6 text-navy hover:opacity-90"
              >
                Book shoe care <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
            <div className="overflow-hidden rounded-2xl ring-1 ring-gold-400/30 shadow-2xl">
              <img src="/brand/images/shoe-care.png" alt="Restored luxury shoes" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </div>
          </div>

          {/* ============================================================
              THE KOZY SHOE CLUB (phase 70) — a shoes-only monthly
              subscription, sold HERE (never as a laundry tier). Prices
              come from live plan rows, so an admin edit reaches this
              section without a deploy.
          ============================================================ */}
          {clubPlans.length > 0 && (
            <motion.div
              id="shoe-club"
              className="mt-16 scroll-mt-24 rounded-3xl border border-gold-400/30 bg-white/5 p-6 sm:p-8"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
                    <Footprints className="h-4 w-4" /> The Kozy Shoe Club
                  </p>
                  <h3 className="font-serif text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    Fresh kicks on rotation — a monthly shoe subscription
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/80">
                    Dedicated sneaker laundries in Lagos charge ₦7,000–₦8,000 to clean ONE pair.
                    Club members pay from <span className="font-semibold text-gold-300">₦800 a pair</span>{' '}
                    — with pickup and delivery included, and a discount on everything else we clean.
                    One pair means the standard sneaker &amp; canvas clean; suede, leather and
                    embellished pairs ride along with your member discount.
                  </p>
                </div>
                {inClub && (
                  <Badge className="rounded-full bg-gold-100 text-[10px] font-semibold text-gold-800 hover:bg-gold-100">
                    YOU&apos;RE IN THE CLUB
                  </Badge>
                )}
              </div>

              <div className="mt-7 grid gap-4 md:grid-cols-3">
                {clubPlans.map((plan) => {
                  const perPair = plan.shoesPerMonth > 0 ? Math.round(plan.priceMonthly / plan.shoesPerMonth) : 0
                  return (
                    <div
                      key={plan.id}
                      className="flex flex-col rounded-2xl border border-white/15 bg-navy-800/60 p-5 backdrop-blur-sm"
                    >
                      <p className="font-serif text-lg font-semibold text-white">{plan.name}</p>
                      <p className="mt-1 min-h-[2.5rem] text-xs leading-relaxed text-white/70">{plan.tagline}</p>
                      <div className="mt-4 flex items-baseline gap-2">
                        <span className="font-serif text-3xl font-bold text-white">
                          {formatNaira(plan.priceMonthly)}
                        </span>
                        <span className="text-xs text-white/60">/ month</span>
                      </div>
                      <ul className="mt-4 space-y-2 text-xs text-white/80">
                        <li className="flex items-start gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-400" />
                          {plan.shoesPerMonth} pair{plan.shoesPerMonth === 1 ? '' : 's'} cleaned every month
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-400" />
                          {perPair > 0 && <>₦{perPair.toLocaleString('en-NG')} a pair · </>}free pickup &amp; delivery
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-400" />
                          {plan.memberDiscountPct}% off everything else we clean
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-400" />
                          Cancel any time — runs to the end of the month
                        </li>
                      </ul>
                      <div className="mt-5 flex-1" />
                      {inClub ? (
                        <Link href="/portal">
                          <Button
                            variant="outline"
                            className="w-full rounded-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                          >
                            Manage my club <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          onClick={() => onJoinClub(plan)}
                          className="w-full rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90"
                        >
                          Join this club
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>

              <p className="mt-5 text-center text-[11px] text-white/50">
                Also on a laundry plan? The tiers already include monthly shoe cleans — the club is
                for shoes-only customers who don&apos;t need the bag.
              </p>
            </motion.div>
          )}
        </div>
      </section>

      {/* ============================================================
          ALTERATIONS — Exclusive to Kozy Care (Phase 14, client directive)
          In-house tailoring: hems, tapering, zips, waist adjustments.
          Pricing is confirmed with the tailor and published the moment it is
          set — until then every piece is measured and quoted for approval
          before any work begins (assessment-first, like wedding dresses).
      ============================================================ */}
      <section id="alterations" className="bg-linen py-20 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
                  Alterations &amp; Repairs
                </p>
                <Badge className="bg-gold-400 text-navy hover:bg-gold-400">
                  Exclusive to Kozy Care
                </Badge>
              </div>
              <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
                Cleaned, pressed — and made to fit.
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-navy-300">
                Our in-house tailor works alongside the cleaning team, so alterations ride
                the same pickup and delivery as your laundry. No separate trips, no
                tailoring shop queues — hand your pieces to your Kozy rider and collect
                them fitting the way they should. Available exclusively to Kozy Care
                customers; you won&apos;t find this service anywhere else on the island.
              </p>
              <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                {[
                  'Trousers & jeans — hems, tapering, waist adjustments',
                  'Shirts & dresses — take-in, sleeve shortening, re-hemming',
                  'Zips, buttons & linings replaced with matching materials',
                  'Traditional wear — agbada, kaftan and iro & buba adjustments',
                  'Blazers & suits — sleeve and body alterations by a suit tailor',
                  'You describe, she assesses — you approve the quote before we sew',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <Scissors className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                    <span className="text-navy-300">{t}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 rounded-xl border border-gold-200 bg-gold-50 p-4 text-sm leading-relaxed text-navy-300">
                <span className="font-semibold text-navy">
                  {appSettings.alterationsFromPrice > 0
                    ? `Alterations from ${formatNaira(appSettings.alterationsFromPrice)}`
                    : 'Simple, honest pricing — quoted before we sew'}
                </span>{' '}
                — tell us what needs changing when you book: "waist too loose", "sleeves
                too long", "zip needs replacing". No one measures you at the door —
                our seamstress assesses every piece at the studio, calls you to confirm
                the details, then sends your quote. Nothing is sewn until you approve
                it.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button
                  onClick={onBook}
                  className="rounded-full bg-gold-gradient px-6 text-navy hover:opacity-90"
                >
                  Book pickup with alterations <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                {/* Free measurement tutorial (Phase 18, client directive:
                    "besides 'book pickup with alterations', we could also have
                    'How do I take measurements?'... it should take them to a
                    separate page... in one of our brand colors, probably the
                    royal blue"). Royal-blue pill in the brand navy family. */}
                <Button
                  asChild
                  className="rounded-full border border-navy-600 bg-navy-500 px-6 text-white hover:bg-navy-600"
                >
                  <Link href="/measurements">
                    <Ruler className="mr-2 h-4 w-4" /> How do I take measurements?
                  </Link>
                </Button>
              </div>
            </motion.div>

            {/* Visual column — a seamstress at her workstation keeps this
                section about the craft of alterations (client directive:
                "have a seamstress working at her workstation in terms of
                alterations and repairs — be professional about it"). Style
                matches the marketing materials: photoreal, navy/gold. */}
            <div className="relative">
              <div className="overflow-hidden rounded-2xl ring-1 ring-gold-400/30 shadow-2xl">
                <img
                  src="/brand/images/seamstress.png"
                  alt="Young Kozy in-house seamstress sewing at her machine in a bright white-walled studio"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 hidden rounded-xl bg-white p-4 shadow-lg ring-1 ring-gold-200 sm:block">
                <div className="flex items-center gap-2">
                  <Scissors className="h-5 w-5 text-gold-500" />
                  <div>
                    <p className="text-xs font-bold text-navy">In-house tailor</p>
                    <p className="text-[10px] text-navy-300">Same rider, same delivery</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Shoe Club join flow (shared with the tiers page). */}
      {joinPlan && (
        <JoinDialog
          plan={joinPlan}
          onClose={() => setJoinPlan(null)}
          sessionEmail={session?.user?.email ?? null}
        />
      )}
    </>
  )
}
