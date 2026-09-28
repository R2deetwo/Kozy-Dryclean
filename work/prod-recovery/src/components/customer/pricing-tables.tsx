'use client'

// =============================================================================
// PricingTables — the full à-la-carte price list (phase 64).
// =============================================================================
// Extracted from ServicesDetail (phase 45) when the owner merged pricing INTO
// the membership page: /memberships is now "Plans & Pricing" — the three Kozy
// Circle tiers first, this per-item price list below. One page, one decision
// journey; the separate "Pricing" nav pill is retired so the top bar carries
// a single Membership button without crowding.
//
// Everything functional is unchanged: same catalog groups (shared with the
// booking wizard via pricing-groups.ts, so the surfaces can never drift),
// same server-managed numbers (admin edits reach every visitor), same
// deep links into the wizard. #pricing anchor kept for old deep links.
// =============================================================================

import { useState } from 'react'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Droplets,
  Sparkles,
  Truck,
  Zap,
} from 'lucide-react'
import {
  formatNaira,
  type GarmentCatalogItem,
} from '@/lib/types'
import {
  MEN_CATALOG_GROUPS,
  WOMEN_CATALOG_GROUPS,
  LANDING_SHARED_GROUPS,
  itemsForGroup,
} from '@/lib/pricing-groups'
import { useServerPrices, useAppSettings } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface Props {
  onBook: () => void
}

export function PricingTables({ onBook }: Props) {
  const [pricing, setPricing] = useState<'men' | 'women' | 'corporate'>('men')
  // Server-managed commercial terms (offers, delivery fee, guarantee rules,
  // alterations pricing, per-kg terms) — admin edits reach every visitor
  // instantly. The localStorage store is no longer consulted for anything
  // money-related.
  const appSettings = useAppSettings()
  // Live prices from PriceCatalog (what the server charges) — the bundle
  // defaults are only fallbacks.
  const serverPrices = useServerPrices()
  const priceOf = (id: string, fallback: number) =>
    serverPrices?.[id] ?? fallback
  // Price cell for the pricing cards — quote-mode items (wedding dress,
  // couture) read "Quoted"; from-mode items (restoration) read "From ₦X".
  const priceCell = (g: GarmentCatalogItem) =>
    g.pricingMode === 'quote' ? (
      <span className="font-semibold text-gold-600">Quoted</span>
    ) : g.pricingMode === 'from' ? (
      <span className="font-semibold text-navy">From {formatNaira(priceOf(g.id, g.price))}</span>
    ) : (
      <span className="font-semibold text-navy">{formatNaira(priceOf(g.id, g.price))}</span>
    )

  return (
    <section id="pricing" className="border-t border-navy-100 bg-white py-14 scroll-mt-20 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
              Transparent pricing
            </p>
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
              Not on a plan? Per item, plainly.
            </h2>
            <p className="mt-2 max-w-xl text-navy-300">
              Every price here is the price the server charges at checkout — nothing is
              estimated twice. Pay by bank transfer{appSettings.paystackAvailable ? ' or card' : ''},
              and Circle members: your discount comes off these prices automatically.
            </p>
          </div>
          <Tabs
            value={pricing}
            onValueChange={(v) => setPricing(v as 'men' | 'women' | 'corporate')}
          >
            <TabsList className="bg-linen-200">
              <TabsTrigger
                value="men"
                className="data-[state=active]:bg-navy data-[state=active]:text-white"
              >
                Men
              </TabsTrigger>
              <TabsTrigger
                value="women"
                className="data-[state=active]:bg-navy data-[state=active]:text-white"
              >
                Women
              </TabsTrigger>
              <TabsTrigger
                value="corporate"
                className="data-[state=active]:bg-navy data-[state=active]:text-white"
              >
                <Building2 className="mr-1 h-3 w-3" /> Corporate
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Tabs value={pricing} onValueChange={(v) => setPricing(v as 'men' | 'women' | 'corporate')}>
          {(['men', 'women'] as const).map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-8">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(tab === 'men' ? MEN_CATALOG_GROUPS : WOMEN_CATALOG_GROUPS).map((group) => (
                  <Card key={group.title} className="border-navy-100 shadow-navy">
                    <CardContent className="p-5">
                      <h3 className="mb-3 font-serif text-sm font-semibold uppercase tracking-wide text-gold-400">
                        {group.title}
                      </h3>
                      <ul className="space-y-2">
                        {itemsForGroup(group).map((g) => (
                          <li
                            key={g.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="flex items-center gap-2.5 text-navy/80">
                              <img
                                src={g.icon}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="h-5 w-5 text-navy"
                                style={{ filter: 'brightness(0) saturate(100%) invert(13%) sepia(15%) saturate(1500%) hue-rotate(190deg) brightness(95%) contrast(90%)' }}
                              />
                              {g.name}
                            </span>
                            {priceCell(g)}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Shared categories — home, shoes and extras serve everyone */}
              <div className="mt-8">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-300">
                  For the home &amp; everything else
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  {LANDING_SHARED_GROUPS.map((group) => (
                    <Card key={group.title} className="border-navy-100 shadow-navy">
                      <CardContent className="p-5">
                        <h3 className="mb-3 font-serif text-sm font-semibold uppercase tracking-wide text-gold-400">
                          {group.title}
                        </h3>
                        <ul className="space-y-2">
                          {itemsForGroup(group).map((g) => (
                            <li
                              key={g.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="flex items-center gap-2.5 text-navy/80">
                                <img
                                  src={g.icon}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  className="h-5 w-5 text-navy"
                                  style={{ filter: 'brightness(0) saturate(100%) invert(13%) sepia(15%) saturate(1500%) hue-rotate(190deg) brightness(95%) contrast(90%)' }}
                                />
                                {g.name}
                              </span>
                              {priceCell(g)}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* OTHER — wedding dress, couture & bespoke (owner directive):
                  there was no category for these, so a full-width banner lets
                  customers know a quote is available. Data comes from the same
                  OTHER_COUTURE_GROUP the wizard uses — content can't drift. */}
              <div className="mt-6 overflow-hidden rounded-2xl border border-gold-200 bg-linen-50 shadow-navy">
                <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-100">
                      <Sparkles className="h-5 w-5 text-gold-600" />
                    </div>
                    <div>
                      <p className="font-serif text-lg font-semibold text-navy">
                        Something not on the menu?
                      </p>
                      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-navy-300">
                        Wedding dresses, couture and bespoke pieces are{' '}
                        <span className="font-medium text-navy">quoted, not priced</span> —
                        beading, fabric and detail change the work. Book a pickup, we
                        assess your piece free of charge, and send a quote for your
                        approval before any work begins.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={onBook}
                    variant="outline"
                    className="shrink-0 rounded-full border-gold-300 bg-white text-navy hover:bg-gold-50"
                  >
                    Get a quote <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Express upsell */}
              <div className="mt-6 flex flex-col items-start justify-between gap-3 rounded-xl bg-navy p-4 text-white ring-1 ring-gold-400/25 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <Zap className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
                  <div>
                    <p className="text-sm font-semibold">
                      In a hurry? Express turnaround at checkout.
                    </p>
                    <p className="mt-0.5 text-xs text-navy-100/70">
                      Standard care returns in 3–5 days. Express 48 (+50%) or Express 24
                      (+100%) jumps the cleaning queue — ideal for last-minute events.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={onBook}
                  className="shrink-0 rounded-full bg-gold-gradient px-4 text-navy hover:opacity-90"
                >
                  Book express <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Mode of wash pricing — visibility requested by the
                  client (handwash is the LABOUR premium: every piece is
                  washed and finished by hand, so it costs MORE than
                  machine wash, not less). Percent comes live from
                  AppSetting so admin tuning reflects here instantly. */}
              <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-navy-100 bg-white p-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <Droplets className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                  <div>
                    <p className="text-sm font-semibold text-navy">
                      Machine or handwash — you choose at checkout.
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-navy-300">
                      Every price above is standard machine wash. Handwash adds{' '}
                      <span className="font-semibold text-navy">
                        +{appSettings.handwashSurchargePercent}%
                      </span>{' '}
                      to your cleaning subtotal — each piece is washed and finished
                      by hand, which takes more time and expert care, so it carries
                      a premium.
                    </p>
                  </div>
                </div>
                <Badge className="shrink-0 bg-gold-100 text-gold-800 hover:bg-gold-100">
                  Handwash +{appSettings.handwashSurchargePercent}%
                </Badge>
              </div>

              {/* Pickup & delivery pricing — transparency requested by the
                  client ("I see first delivery is free but I don't see
                  pricing for deliveries afterwards"). First delivery is
                  free; every delivery after that is a flat island-wide rate
                  that admin can tune in Settings. */}
              <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-navy-100 bg-white p-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <Truck className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                  <div>
                    <p className="text-sm font-semibold text-navy">
                      Pickup &amp; delivery — first one&apos;s on us.
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-navy-300">
                      Your first pickup and delivery is <span className="font-semibold text-navy">FREE</span>.
                      After that, every delivery is a flat{' '}
                      <span className="font-semibold text-navy">{formatNaira(appSettings.deliveryFee)}</span>{' '}
                      island-wide (Ikoyi to Lekki) — no distance surprises, added at checkout.
                      Express orders keep the same rate. Circle members never pay it.
                    </p>
                  </div>
                </div>
                <Badge className="shrink-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                  First delivery FREE
                </Badge>
              </div>
            </TabsContent>
          ))}

          <TabsContent value="corporate" className="mt-8">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <Card className="overflow-hidden border-navy-100 shadow-navy">
                <img
                  src="/brand/images/b2b-linens.png"
                  alt="Neatly folded stacks of pristine white hotel linens tied with gold ribbon"
                  loading="lazy"
                  decoding="async"
                  className="h-64 w-full object-cover"
                />
                <CardContent className="p-6">
                  <h3 className="font-serif text-xl font-semibold text-navy">
                    Weight-based corporate program
                  </h3>
                  <p className="mt-2 text-sm text-navy-300">
                    Hotels, estates, gyms, and restaurants rely on Kozy for predictable,
                    per-kilogram pricing. We weigh at the station, send you a digital
                    invoice, and route the next delivery.
                  </p>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="border-navy bg-navy-gradient text-white shadow-navy">
                  <CardContent className="p-6">
                    <p className="text-xs uppercase tracking-wider text-gold-200">
                      From, per kilogram
                    </p>
                    <p className="mt-1 font-serif text-4xl font-bold text-gold-100">
                      {formatNaira(appSettings.pricePerKg)}
                    </p>
                    <div className="mt-3 divider-gold" />
                    <p className="mt-3 text-xs text-navy-100">
                      Minimum charge{' '}
                      <span className="font-semibold text-white">
                        {formatNaira(appSettings.pricePerKg * appSettings.minimumKg)}
                      </span>{' '}
                      ({appSettings.minimumKg}kg minimum billable weight)
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-navy-100 shadow-navy">
                  <CardContent className="p-5">
                    <ul className="space-y-3 text-sm">
                      {[
                        'Dedicated account manager & priority routing',
                        'Itemised monthly statements for finance teams',
                        'Item-level tagging for chain-of-custody tracking',
                        'Net-15 invoice terms for verified partners',
                      ].map((t) => (
                        <li key={t} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
                          <span className="text-navy-300">{t}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      onClick={onBook}
                      className="mt-5 w-full rounded-full bg-gold-gradient text-navy hover:opacity-90"
                    >
                      Request bulk pickup <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* HOTEL & CORPORATE OFFER — Phase 14. Client directive via PM:
                hotels (corporate clients) are already high-value customers
                who bring volume, so they earn the better first-order deal:
                15% + the 5% picture discount. Wording deliberately targets
                the hotel as the business client, not individual guests.
                The code is redeemed at checkout in the booking wizard. */}
            <div className="mt-6 overflow-hidden rounded-2xl bg-navy-gradient p-6 text-white ring-1 ring-gold-400/30">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-400 text-navy">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-serif text-lg font-semibold">
                      Hotels &amp; corporate clients — your first order is{' '}
                      <span className="text-gold-300">{appSettings.hotelGuestDiscountPercent}% off.</span>
                    </p>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-navy-100/85">
                      Our hotel and corporate partners earn the better deal — you already trust Kozy with your
                      volumes. Use code{' '}
                      <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono font-bold text-gold-300 ring-1 ring-gold-400/40">
                        {appSettings.hotelGuestPromoCode}
                      </span>{' '}
                      at checkout for {appSettings.hotelGuestDiscountPercent}% off your first order,{' '}
                      <span className="font-semibold text-white">plus</span> the 5% picture discount
                      when you upload photos with the order — that&apos;s up to{' '}
                      {appSettings.hotelGuestDiscountPercent + 5}% back on your first clean.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={onBook}
                  className="shrink-0 rounded-full bg-gold-gradient px-5 text-navy hover:opacity-90"
                >
                  Claim your offer <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}
