'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles,
  Clock,
  MapPin,
  Shield,
  Truck,
  CreditCard,
  Leaf,
  ArrowRight,
  CheckCircle2,
  Star,
  Phone,
  Mail,
  Building2,
  User,
  ShoppingBag,
} from 'lucide-react'
import {
  GARMENT_CATALOG,
  B2B_PRICING,
  formatNaira,
  COMPANY_BANK,
} from '@/lib/types'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface Props {
  onBook: () => void
  onDashboard: () => void
}

export function CustomerLanding({ onBook, onDashboard }: Props) {
  const [pricing, setPricing] = useState<'retail' | 'corporate'>('retail')
  const currentUser = useStore((s) => s.users.find((u) => u.id === s.currentUserId) ?? s.users[0])

  return (
    <div className="bg-white">
      {/* ============================================================
          HERO
      ============================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-50 via-emerald-50/40 to-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-12 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />
          <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />
        </div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Badge className="mb-4 rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              <Leaf className="mr-1.5 h-3 w-3" />
              Now serving all of Lagos · Same-day pickup
            </Badge>
            <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Lagos&apos; freshest laundry &amp; dry cleaning,{' '}
              <span className="bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                picked up at your door.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Book a pickup in 60 seconds. Retail and corporate clients welcome.
              Pay by bank transfer or Paystack, then track every stage of your order
              until it lands back at your door — clean, folded, and on time.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" onClick={onBook} className="h-12 rounded-full bg-emerald-600 px-6 text-base hover:bg-emerald-700">
                <ShoppingBag className="mr-2 h-5 w-5" />
                Book Pickup Now
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={onDashboard}
                className="h-12 rounded-full px-6 text-base"
              >
                Track My Orders
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-emerald-600" /> Return-as-Received Guarantee
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-600" /> 48-hour standard turnaround
              </span>
              <span className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-emerald-600" /> Free pickup & delivery in Lagos
              </span>
            </div>
          </motion.div>

          {/* Pricing & summary card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="relative"
          >
            <Card className="overflow-hidden border-emerald-100 shadow-xl shadow-emerald-100/50">
              <CardContent className="p-0">
                <div className="bg-gradient-to-br from-teal-600 to-emerald-600 px-6 py-5 text-white">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Instant Quote</p>
                    <Tabs
                      value={pricing}
                      onValueChange={(v) => setPricing(v as 'retail' | 'corporate')}
                    >
                      <TabsList className="bg-white/15 p-0.5">
                        <TabsTrigger
                          value="retail"
                          className="rounded-full px-3 py-1 text-xs data-[state=active]:bg-white data-[state=active]:text-emerald-700"
                        >
                          <User className="mr-1 h-3 w-3" />
                          Retail
                        </TabsTrigger>
                        <TabsTrigger
                          value="corporate"
                          className="rounded-full px-3 py-1 text-xs data-[state=active]:bg-white data-[state=active]:text-emerald-700"
                        >
                          <Building2 className="mr-1 h-3 w-3" />
                          Corporate
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>

                <div className="p-6">
                  {pricing === 'retail' ? (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Per-item pricing. Pick what you have, see the total instantly.
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {GARMENT_CATALOG.slice(0, 6).map((g) => (
                          <div
                            key={g.id}
                            className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="text-base">{g.icon}</span>
                              <span className="font-medium">{g.name}</span>
                            </span>
                            <span className="font-semibold text-emerald-700">
                              {formatNaira(g.price)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <Button
                        onClick={onBook}
                        className="mt-4 w-full rounded-full bg-emerald-600 hover:bg-emerald-700"
                      >
                        Start booking <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Weight-based pricing with a {B2B_PRICING.minimumKg}kg minimum. Perfect
                        for hotels, estates, gyms, and restaurants.
                      </p>
                      <div className="mt-4 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm font-medium text-emerald-900">Per kilogram</span>
                          <span className="text-2xl font-bold text-emerald-700">
                            {formatNaira(B2B_PRICING.pricePerKg)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between text-sm">
                          <span className="text-emerald-800">Minimum charge</span>
                          <span className="font-semibold text-emerald-900">
                            {formatNaira(B2B_PRICING.minimumCharge)} ({B2B_PRICING.minimumKg}kg)
                          </span>
                        </div>
                      </div>
                      <ul className="mt-4 space-y-2 text-sm">
                        {[
                          'Weigh-at-station model — final invoice after pickup',
                          'Itemised monthly statements for finance teams',
                          'Dedicated account manager & priority routing',
                        ].map((t) => (
                          <li key={t} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <span className="text-foreground/80">{t}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        onClick={onBook}
                        className="mt-4 w-full rounded-full bg-emerald-600 hover:bg-emerald-700"
                      >
                        Request bulk pickup <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <div className="absolute -bottom-3 -right-3 hidden rounded-xl bg-white px-3 py-2 shadow-lg ring-1 ring-black/5 sm:block">
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
                <span className="ml-1 text-xs font-medium text-foreground">4.9</span>
                <span className="text-xs text-muted-foreground">· 1,200+ orders</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============================================================
          HOW IT WORKS
      ============================================================ */}
      <section className="border-t border-muted/40 bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="mb-3 rounded-full">
              Simple process
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-3 text-muted-foreground">
              From your sofa to your wardrobe in three steps — no phone calls, no waiting on hold.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: ShoppingBag,
                title: '1. Book a pickup',
                body:
                  'Choose your garments or request a bulk pickup. Pick a date and time slot, snap optional photos for our Return-as-Received Guarantee, and you\'re done.',
              },
              {
                icon: Truck,
                title: '2. Rider collects & processes',
                body:
                  'Our rider arrives within your slot, hands you a tag, and brings your items to our station. Track each stage in real time from your dashboard.',
              },
              {
                icon: CheckCircle2,
                title: '3. Clean laundry, delivered',
                body:
                  'We wash, dry, iron, and package to spec. Your order is delivered back to your door — typically within 48 hours for retail clients.',
              },
            ].map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="h-full border-muted/60 shadow-sm">
                  <CardContent className="p-6">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <s.icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{s.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SERVICES / PRICING DETAIL
      ============================================================ */}
      <section className="bg-gradient-to-b from-emerald-50/40 to-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <Badge variant="outline" className="mb-3 rounded-full">
                Transparent pricing
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Full price list
              </h2>
              <p className="mt-2 max-w-xl text-muted-foreground">
                No hidden charges. Pay by bank transfer or Paystack. Corporate clients get
                weight-based pricing with a {B2B_PRICING.minimumKg}kg minimum.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(['Shirts', 'Trousers', 'Suits', 'Traditional', 'Household', 'Extras'] as const).map(
              (cat) => (
                <Card key={cat} className="border-muted/60 shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
                      {cat}
                    </h3>
                    <ul className="space-y-1.5">
                      {GARMENT_CATALOG.filter((g) => g.category === cat).map((g) => (
                        <li
                          key={g.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="flex items-center gap-2 text-foreground/80">
                            <span>{g.icon}</span>
                            {g.name}
                          </span>
                          <span className="font-semibold text-foreground">
                            {formatNaira(g.price)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        </div>
      </section>

      {/* ============================================================
          GUARANTEE
      ============================================================ */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <Card className="overflow-hidden border-emerald-100 shadow-md">
            <CardContent className="grid gap-6 p-0 md:grid-cols-[1fr_1.4fr]">
              <div className="flex flex-col justify-center bg-gradient-to-br from-emerald-600 to-teal-700 p-8 text-white">
                <Shield className="h-10 w-10" />
                <h3 className="mt-4 text-2xl font-bold">Return-as-Received Guarantee</h3>
                <p className="mt-2 text-sm text-emerald-50">
                  Snap photos of your items at pickup. We&apos;ll return them clean — and in
                  the exact structural condition documented.
                </p>
                <Badge className="mt-4 w-fit bg-white/15 text-white hover:bg-white/15">
                  Activates 5% discount on eligible orders
                </Badge>
              </div>
              <div className="p-8">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                  How the guarantee works
                </h4>
                <p className="mt-3 text-sm text-muted-foreground">
                  During the B2C booking flow, you&apos;ll see an optional photo uploader. Use
                  it to capture the current condition of your garments. Orders with uploaded
                  photos are automatically tagged &quot;Guarantee Activated&quot; and receive a
                  5% discount on the total.
                </p>
                <div className="mt-4 rounded-lg bg-muted/60 p-4 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Terms of Service:</p>
                  <p className="mt-1">
                    Return-as-Received Guarantee: By utilizing our Condition Capture feature,
                    we guarantee your garments will be returned clean and in the exact
                    structural condition documented at pickup. Covers physical damage in our
                    care; does not cover pre-existing wear or inherent fabric degradation.
                    Claims must be made within 24 hours of delivery.
                  </p>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">B2B note:</span> For corporate
                  bulk orders, condition capture is hidden by default to streamline booking.
                  It can be enabled per-order on request.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ============================================================
          FOOTER
      ============================================================ */}
      <footer className="border-t bg-foreground text-background">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <span className="font-semibold">Lagos Fresh Laundry</span>
              </div>
              <p className="mt-3 text-sm text-background/70">
                Modern laundry & dry cleaning for individuals and businesses across Lagos
                State. Pickup, process, deliver — that simple.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold">Contact</p>
              <ul className="mt-3 space-y-2 text-sm text-background/70">
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4" /> +234 800 LAUNDRY
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4" /> hello@lagosfresh.ng
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> 12 Adeola Odeku St, Victoria Island, Lagos
                </li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold">Bank Transfer Details</p>
              <ul className="mt-3 space-y-2 text-sm text-background/70">
                <li>{COMPANY_BANK.bankName}</li>
                <li>{COMPANY_BANK.accountName}</li>
                <li className="font-mono font-semibold text-background">
                  {COMPANY_BANK.accountNumber}
                </li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold">Quick links</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <button onClick={onBook} className="text-background/70 hover:text-background">
                    Book a pickup
                  </button>
                </li>
                <li>
                  <button onClick={onDashboard} className="text-background/70 hover:text-background">
                    Track an order
                  </button>
                </li>
                <li className="text-background/70">Pricing</li>
                <li className="text-background/70">Return-as-Received Guarantee</li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-background/10 pt-6 text-xs text-background/50 sm:flex-row">
            <p>© 2026 Lagos Fresh Laundry Ltd. RC 1234567.</p>
            <p>Built for Lagos, by Lagosians.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
