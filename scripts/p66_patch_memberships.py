#!/usr/bin/env python3
# Phase 66 — rewrite the memberships page tier section: persona strip +
# 4-plan ladder + plain-language perks + value math + FAQ + join dialog copy.
# Exact-match asserts, idempotent.
import sys

PATH = "/home/z/my-project/src/components/customer/memberships-page.tsx"
src = open(PATH, encoding="utf-8").read()

def rep(old, new, label):
    global src
    if old in src:
        if src.count(old) != 1:
            print(f"FAIL {label}: old matches {src.count(old)} times")
            sys.exit(1)
        src = src.replace(old, new)
        print(f"OK   {label}")
    elif new in src:
        print(f"SKIP {label} (already applied)")
    else:
        print(f"FAIL {label}: old text not found")
        sys.exit(1)

# ---- 1. Tier section header ----------------------------------------------------
rep(
    """      {/* ================= THE THREE CIRCLES ================= */}
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
          </div>""",
    """      {/* ================= FIND YOUR PLAN — the ideal customers, by name ================= */}
      {/* The owner asked for the ideal customer profiles to be VISIBLE in the
          arrangement, not just implied: four one-glance personas, each
          pointing straight at the plan built for it. */}
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
                plan: 'The Essentials',
                href: '#tier-essentials',
              },
              {
                icon: Users,
                label: '“Dressing a whole family”',
                line: 'Everyone’s weekly load — school, work, weekend — plus the beds.',
                plan: 'The Household',
                href: '#tier-household',
              },
              {
                icon: Home,
                label: '“Running a full home”',
                line: 'Duvets, curtains and a yearly deep clean, all inside one plan.',
                plan: 'The Whole Home',
                href: '#tier-wholehome',
              },
              {
                icon: Crown,
                label: '“My wardrobe is the investment”',
                line: 'Couture, designer and premium traditional wear — cared for by hand.',
                plan: 'The Atelier',
                href: '#tier-atelier',
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
                  Start with {p.plan}
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
          </div>""",
    "1 tier section header + personas",
)

# ---- 2. Tier card grid + rendering ---------------------------------------------
rep(
    """            <div className="mt-10 grid gap-6 lg:grid-cols-3">
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

                        <Button""",
    """            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
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
                            {plan.concierge
                              ? `${plan.includedUnits} couture pickups a month`
                              : `${plan.includedUnits} × ${plan.unitName} pickups a month`}
                          </p>
                          <p className="mt-0.5 text-[10px] leading-relaxed text-navy-300">
                            {plan.concierge
                              ? 'Cleaned when it needs it — hand-finished, returned in protective covers'
                              : plan.unitKind === 'bag'
                                ? 'The long laundry bag — your weekly wash & fold'
                                : 'The big box — the whole household, weekly'}
                          </p>
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
                          {plan.concierge ? (
                            <>
                              <Perk included>Every piece assessed before treatment</Perk>
                              <Perk included>First pick of pickup times</Perk>
                            </>
                          ) : (
                            <>
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
                            </>
                          )}
                        </ul>

                        <Button""",
    "2 tier cards",
)

# ---- 3. Value math band copy -----------------------------------------------------
rep(
    """          <div className="grid gap-6 md:grid-cols-3">
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
          </div>""",
    """          <div className="grid gap-6 md:grid-cols-3">
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
          </div>""",
    "3 value math",
)

# ---- 4. FAQ: simplify + add the couture question ---------------------------------
rep(
    """            {[
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
            ].map((f) => (""",
    """            {[
              {
                q: 'What counts as “couture” for The Atelier?',
                a: 'Designer pieces, aso-oke and lace, agbada, bridal and anything delicate enough that you would rather ask first. Atelier pieces are assessed before every treatment, hand-finished, and returned in protective covers. If you are unsure, send it with your next pickup — the studio will tell you which plan (or per-item care) suits it.',
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
            ].map((f) => (""",
    "4 FAQ",
)

# ---- 5. Join dialog description ---------------------------------------------------
rep(
    """              <DialogDescription>
                {plan.includedUnits} × {plan.unitName} pickups a month · free delivery ·{' '}
                {plan.memberDiscountPct}% off à-la-carte
              </DialogDescription>""",
    """              <DialogDescription>
                {plan.concierge
                  ? `${plan.includedUnits} couture pickups a month · free delivery · `
                  : `${plan.includedUnits} × ${plan.unitName} pickups a month · free delivery · `}
                {plan.memberDiscountPct}% off everything else
              </DialogDescription>""",
    "5 join dialog",
)

# ---- 6. TIER_PRESENTATION map + cn import ----------------------------------------
rep(
    """function Perk({ included, children }: { included?: boolean; children: React.ReactNode }) {""",
    """// -----------------------------------------------------------------------------
// Tier presentation — plain-words positioning per plan code. All NUMBERS on
// the cards come from the database (admin-adjustable); this map only carries
// the icon and the one-glance "who is this for" line.
// -----------------------------------------------------------------------------
const TIER_PRESENTATION: Record<string, { icon: LucideIcon; who: string }> = {
  ESSENTIALS: { icon: ShoppingBag, who: 'For one busy person' },
  HOUSEHOLD: { icon: Users, who: 'For a family' },
  WHOLEHOME: { icon: Home, who: 'For a full house — beds, curtains, all' },
  ATELIER: { icon: Crown, who: 'For couture & designer wardrobes' },
  __default: { icon: Package, who: 'A Kozy Circle plan' },
}

function Perk({ included, children }: { included?: boolean; children: React.ReactNode }) {""",
    "6 tier presentation map",
)

# ---- 7. cn import ------------------------------------------------------------------
rep(
    """import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'""",
    """import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'""",
    "7 cn import",
)

# ---- 8. file header comment ---------------------------------------------------------
rep(
    """// Phase 64 (owner): pricing and the plans are MERGED here — plans first, the
// per-item price list below. The nav's separate Pricing pill is retired; one
// Membership button covers both, so the top bar stays uncluttered. Sections:
// hero (handover photo recycled from the home page) → how the kit works →
// the three tiers (middle anchored) → the value math → the à-la-carte price
// list (PricingTables) → FAQ → join.""",
    """// Phase 64 (owner): pricing and the plans are MERGED here — plans first, the
// per-item price list below. Phase 66 (owner): plain language throughout, a
// visible FIND-YOUR-PLAN persona strip (the ideal customer profiles, named),
// and a four-plan ladder — three sized by kit (Essentials bag → Household
// box → Whole Home) plus THE ATELIER, sized by care level: couture, designer
// and premium traditional wear, hand-finished. Sections:
// hero (recycled handover photo) → how the plan works → find your plan →
// the four plans → the value math → the per-item price list (PricingTables)
// → FAQ → join.""",
    "8 header comment",
)

open(PATH, "w", encoding="utf-8").write(src)
print("\nWROTE", PATH)
