'use client'

import { useState } from 'react'
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Save,
  CheckCircle2,
  Banknote,
  Tag,
  Percent,
  Scale,
  Truck,
  Sparkles,
  Scissors,
  CreditCard,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useStore } from '@/lib/store'
import { GARMENT_CATALOG, formatNaira, type KozySettings, type KozyAppSettings } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const CATEGORY_LABELS: Record<string, string> = {
  Shirts: 'Shirts & Tops',
  Trousers: 'Trousers',
  Suits: 'Suits & Blazers',
  Traditional: 'Traditional',
  "Women's Wear": 'Women’s Wear',
  Outerwear: 'Outerwear & Knitwear',
  Household: 'Household',
  Extras: 'Extras',
  Shoes: 'Shoes & Sneakers',
  Other: 'Other & Bespoke (quoted)',
}

export function SettingsView() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const setGarmentPrice = useStore((s) => s.setGarmentPrice)
  const queryClient = useQueryClient()

  // ----- Server-managed app settings (Phase 14) -----
  // Bank details, commercial terms and offers live in the AppSetting table
  // so an edit reaches EVERY visitor instantly — the old flow only updated
  // this browser's localStorage and customers kept seeing stale details
  // (the client-reported bug). Load current values from the server.
  const { data: appSettings } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings/app')
      if (!res.ok) throw new Error('Failed to load settings')
      const data = await res.json()
      return data.settings as KozyAppSettings
    },
    staleTime: 30 * 1000,
  })

  const [appDraft, setAppDraft] = useState<KozyAppSettings | null>(null)
  // The draft starts from whatever the server currently says (once loaded).
  const app = appDraft ?? appSettings
  const setApp = (patch: Partial<KozyAppSettings>) =>
    setAppDraft({ ...(app as KozyAppSettings), ...patch })

  const [draft, setDraft] = useState<KozySettings>(settings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    // ----- 1. Server-side app settings (bank, contact, commercial) -----
    if (appDraft && appSettings) {
      const changed: Partial<KozyAppSettings> = {}
      ;(Object.keys(appDraft) as (keyof KozyAppSettings)[]).forEach((k) => {
        if (appDraft[k] !== appSettings[k]) {
          ;(changed as Record<string, unknown>)[k] = appDraft[k]
        }
      })
      if (Object.keys(changed).length > 0) {
        try {
          const res = await fetch('/api/settings/app', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: changed }),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.error || 'Server rejected the settings update')
          }
          await queryClient.invalidateQueries({ queryKey: ['app-settings'] })
        } catch (e: any) {
          toast({
            title: 'Settings not saved',
            description: e?.message || 'Could not reach the server — nothing was changed.',
            variant: 'destructive',
          })
          setSaving(false)
          return
        }
      }
    }

    // ----- 2. Legacy local settings (B2B per-kg pricing, guarantee note) -----
    updateSettings({
      pricePerKg: draft.pricePerKg,
      minimumKg: draft.minimumKg,
      guaranteeDiscountPercent: draft.guaranteeDiscountPercent,
    })
    // ----- 3. Garment prices -> PriceCatalog (server-side, live for all) -----
    const changedPrices: Record<string, number> = {}
    Object.entries(draft.garmentPrices).forEach(([id, price]) => {
      if (settings.garmentPrices[id] !== price) {
        setGarmentPrice(id, price)
        changedPrices[id] = price
      }
    })
    // …and push them to the server (PriceCatalog) so they go live on the
    // storefront and match what customers are charged at checkout.
    if (Object.keys(changedPrices).length > 0) {
      try {
        const res = await fetch('/api/settings/prices', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ garmentPrices: changedPrices }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Server rejected the price update')
        }
      } catch (e: any) {
        toast({
          title: 'Prices saved locally only',
          description: e?.message || 'Could not reach the server — storefront prices were not updated.',
          variant: 'destructive',
        })
        setSaving(false)
        return
      }
    }
    setAppDraft(null)
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      toast({
        title: 'Settings saved',
        description: 'Changes are now live across the customer-facing app.',
      })
      setTimeout(() => setSaved(false), 2000)
    }, 600)
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-navy">
            Settings
          </h1>
          <p className="mt-1 text-sm text-navy-300">
            Manage bank account, contact details, and pricing. Changes appear instantly on the
            customer-facing app.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'rounded-full',
              saved
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-gold-gradient text-navy hover:opacity-90'
            )}
          >
            {saving ? (
              'Saving...'
            ) : saved ? (
              <>
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Saved
              </>
            ) : (
              <>
                <Save className="mr-1.5 h-4 w-4" /> Save changes
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="bank">
        <TabsList className="bg-linen-200">
          <TabsTrigger value="bank" className="data-[state=active]:bg-navy data-[state=active]:text-white">
            <Banknote className="mr-1.5 h-3.5 w-3.5" /> Bank Account
          </TabsTrigger>
          <TabsTrigger value="contact" className="data-[state=active]:bg-navy data-[state=active]:text-white">
            <Phone className="mr-1.5 h-3.5 w-3.5" /> Contact
          </TabsTrigger>
          <TabsTrigger value="pricing" className="data-[state=active]:bg-navy data-[state=active]:text-white">
            <Tag className="mr-1.5 h-3.5 w-3.5" /> Pricing
          </TabsTrigger>
          <TabsTrigger value="terms" className="data-[state=active]:bg-navy data-[state=active]:text-white">
            <Truck className="mr-1.5 h-3.5 w-3.5" /> Offers & Delivery
          </TabsTrigger>
          <TabsTrigger value="guarantee" className="data-[state=active]:bg-navy data-[state=active]:text-white">
            <Percent className="mr-1.5 h-3.5 w-3.5" /> Guarantee
          </TabsTrigger>
        </TabsList>

        {/* BANK ACCOUNT TAB — server-backed (Phase 14): edits are saved to
            the AppSetting table and reach EVERY customer's checkout screen. */}
        <TabsContent value="bank" className="mt-4">
          <Card className="border-navy-100 shadow-navy">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-navy">
                <Building2 className="h-4 w-4 text-gold-400" /> Bank Account Details
              </CardTitle>
              <p className="text-xs text-navy-300">
                These details appear during checkout when customers choose
                &ldquo;Bank Transfer&rdquo; — saved on the server, so every customer sees
                your changes immediately after you hit Save.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!app ? (
                <p className="py-6 text-center text-sm text-navy-300">Loading current account details…</p>
              ) : (
                <>
                  <div>
                    <Label htmlFor="bank-name" className="text-xs uppercase tracking-wide text-navy-300">
                      Bank Name
                    </Label>
                    <Input
                      id="bank-name"
                      value={app.bankName}
                      onChange={(e) => setApp({ bankName: e.target.value })}
                      placeholder="e.g. Guaranty Trust Bank (GTB)"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="account-name" className="text-xs uppercase tracking-wide text-navy-300">
                      Account Name
                    </Label>
                    <Input
                      id="account-name"
                      value={app.accountName}
                      onChange={(e) => setApp({ accountName: e.target.value })}
                      placeholder="e.g. Kozy Premium Dry Cleaning Ltd"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="account-number" className="text-xs uppercase tracking-wide text-navy-300">
                      Account Number
                    </Label>
                    <Input
                      id="account-number"
                      value={app.accountNumber}
                      onChange={(e) => setApp({ accountNumber: e.target.value })}
                      placeholder="10-digit account number"
                      className="mt-1.5 font-mono"
                    />
                  </div>

                  {/* Preview */}
                  <div className="mt-6 rounded-xl bg-navy p-5 text-white">
                    <p className="text-xs uppercase tracking-wider text-gold-300">
                      Customer sees this during checkout:
                    </p>
                    <div className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-navy-100/70">Bank</span>
                        <span className="font-medium">{app.bankName || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-navy-100/70">Account Name</span>
                        <span className="font-medium">{app.accountName || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-navy-100/70">Account Number</span>
                        <span className="font-mono font-bold text-gold-300">
                          {app.accountNumber || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card payments (Paystack) status — read-only, env-derived.
                   * Makes it obvious to the admin why customers only see the
                   * transfer option at checkout. */}
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-navy-100 bg-linen-50 p-4">
                    <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-navy-300" />
                    <div className="text-sm">
                      <p className="font-semibold text-navy">
                        Card payments (Paystack){' '}
                        <span
                          className={
                            app.paystackAvailable
                              ? 'ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700'
                              : 'ml-1 rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-300'
                          }
                        >
                          {app.paystackAvailable ? 'Live' : 'Unavailable'}
                        </span>
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-navy-300">
                        {app.paystackAvailable
                          ? 'Customers can pay by card — the option is selectable at checkout.'
                          : 'Customers currently see the card option greyed out with “not available at the moment” and pay by bank transfer only. To enable cards, add PAYSTACK_SECRET_KEY in your deployment environment — it switches on automatically.'}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTACT TAB — server-backed, same as bank */}
        <TabsContent value="contact" className="mt-4">
          <Card className="border-navy-100 shadow-navy">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-navy">
                <Phone className="h-4 w-4 text-gold-400" /> Contact Information
              </CardTitle>
              <p className="text-xs text-navy-300">
                Shown at checkout and on the offers strip — saved on the server for
                every visitor, not just this browser.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!app ? (
                <p className="py-6 text-center text-sm text-navy-300">Loading contact details…</p>
              ) : (
                <>
                  <div>
                    <Label htmlFor="contact-phone" className="text-xs uppercase tracking-wide text-navy-300">
                      <Phone className="mr-1 inline h-3 w-3" /> Phone Number
                    </Label>
                    <Input
                      id="contact-phone"
                      value={app.contactPhone}
                      onChange={(e) => setApp({ contactPhone: e.target.value })}
                      placeholder="+234 803 175 5230"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact-email" className="text-xs uppercase tracking-wide text-navy-300">
                      <Mail className="mr-1 inline h-3 w-3" /> Email Address
                    </Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={app.contactEmail}
                      onChange={(e) => setApp({ contactEmail: e.target.value })}
                      placeholder="kozygarmentcare@gmail.com"
                      className="mt-1.5"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRICING TAB */}
        <TabsContent value="pricing" className="mt-4 space-y-4">
          {/* Bulk pricing */}
          <Card className="border-navy-100 shadow-navy">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-navy">
                <Scale className="h-4 w-4 text-gold-400" /> Corporate (Per-Kg) Pricing
              </CardTitle>
              <p className="text-xs text-navy-300">
                Used for bulk/corporate orders. Final invoice = weight × price per kg
                (minimum charge applies).
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="price-per-kg" className="text-xs uppercase tracking-wide text-navy-300">
                  Price per kg (₦)
                </Label>
                <Input
                  id="price-per-kg"
                  type="number"
                  value={draft.pricePerKg}
                  onChange={(e) =>
                    setDraft({ ...draft, pricePerKg: parseInt(e.target.value) || 0 })
                  }
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-navy-300">
                  Current: {formatNaira(draft.pricePerKg)}/kg
                </p>
              </div>
              <div>
                <Label htmlFor="minimum-kg" className="text-xs uppercase tracking-wide text-navy-300">
                  Minimum chargeable weight (kg)
                </Label>
                <Input
                  id="minimum-kg"
                  type="number"
                  value={draft.minimumKg}
                  onChange={(e) =>
                    setDraft({ ...draft, minimumKg: parseInt(e.target.value) || 0 })
                  }
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-navy-300">
                  Minimum charge: {formatNaira(draft.pricePerKg * draft.minimumKg)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Per-item pricing */}
          <Card className="border-navy-100 shadow-navy">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-navy">
                <Tag className="h-4 w-4 text-gold-400" /> Retail (Per-Item) Pricing
              </CardTitle>
              <p className="text-xs text-navy-300">
                Prices shown on the landing page price list and during retail booking.
                Changes are reflected immediately on the public site.
              </p>
            </CardHeader>
            <CardContent>
              {(['Shirts', 'Trousers', 'Suits', 'Traditional', "Women's Wear", 'Outerwear', 'Household', 'Extras', 'Shoes', 'Other'] as const).map(
                (cat) => (
                  <div key={cat} className="mb-5 last:mb-0">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-400">
                      {CATEGORY_LABELS[cat]}
                    </h4>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {GARMENT_CATALOG.filter((g) => g.category === cat).map((g) => {
                        const currentPrice = settings.garmentPrices[g.id] ?? g.price
                        const draftPrice = draft.garmentPrices[g.id] ?? currentPrice
                        const changed = draftPrice !== currentPrice
                        return (
                          <div
                            key={g.id}
                            className={cn(
                              'flex items-center gap-2 rounded-lg border p-2 transition',
                              changed
                                ? 'border-gold-400 bg-gold-50'
                                : 'border-navy-100 bg-linen-50'
                            )}
                          >
                            <img src={g.icon} alt="" className="h-6 w-6 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-xs font-medium text-navy">{g.name}</p>
                              <p className="text-[10px] text-navy-300">
                                Was {formatNaira(currentPrice)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-navy-300">₦</span>
                              <Input
                                type="number"
                                value={draftPrice}
                                onChange={(e) =>
                                  setDraft({
                                    ...draft,
                                    garmentPrices: {
                                      ...draft.garmentPrices,
                                      [g.id]: parseInt(e.target.value) || 0,
                                    },
                                  })
                                }
                                className="h-7 w-20 px-2 py-1 text-xs"
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* OFFERS & DELIVERY TAB — the commercial terms customers see
            (offers strip, delivery pricing, handwash surcharge, guarantee
            eligibility, alterations from-price). All server-backed. */}
        <TabsContent value="terms" className="mt-4 space-y-4">
          {!app ? (
            <Card className="border-navy-100 shadow-navy">
              <CardContent className="py-10 text-center text-sm text-navy-300">
                Loading commercial terms…
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Offers */}
              <Card className="border-navy-100 shadow-navy">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-serif text-navy">
                    <Sparkles className="h-4 w-4 text-gold-400" /> Discounts & Offers
                  </CardTitle>
                  <p className="text-xs text-navy-300">
                    Shown on the site&apos;s offers strip and applied automatically at
                    checkout. The picture discount is set on the Guarantee tab.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="first-order-pct" className="text-xs uppercase tracking-wide text-navy-300">
                      First-order discount (%)
                    </Label>
                    <Input
                      id="first-order-pct"
                      type="number"
                      min="0"
                      max="50"
                      value={app.firstOrderDiscountPercent}
                      onChange={(e) => setApp({ firstOrderDiscountPercent: Number(e.target.value) || 0 })}
                      className="mt-1.5 w-32"
                    />
                    <p className="mt-1 text-xs text-navy-300">Applied to every new customer&apos;s first order.</p>
                  </div>
                  <div>
                    <Label htmlFor="hotel-guest-pct" className="text-xs uppercase tracking-wide text-navy-300">
                      Hotel &amp; corporate first-order discount (%)
                    </Label>
                    <Input
                      id="hotel-guest-pct"
                      type="number"
                      min="0"
                      max="50"
                      value={app.hotelGuestDiscountPercent}
                      onChange={(e) => setApp({ hotelGuestDiscountPercent: Number(e.target.value) || 0 })}
                      className="mt-1.5 w-32"
                    />
                    <p className="mt-1 text-xs text-navy-300">
                      Redeemed with the offer code below — replaces the standard first-order
                      discount and stacks with the 5% picture discount.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="hotel-promo-code" className="text-xs uppercase tracking-wide text-navy-300">
                      Hotel &amp; corporate offer code
                    </Label>
                    <Input
                      id="hotel-promo-code"
                      value={app.hotelGuestPromoCode}
                      onChange={(e) => setApp({ hotelGuestPromoCode: e.target.value.toUpperCase() })}
                      placeholder="HOTEL15"
                      className="mt-1.5 w-40 font-mono uppercase"
                    />
                    <p className="mt-1 text-xs text-navy-300">
                      Hotels &amp; corporate clients type this at checkout. Print it on hotel partner cards.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Delivery + handwash */}
              <Card className="border-navy-100 shadow-navy">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-serif text-navy">
                    <Truck className="h-4 w-4 text-gold-400" /> Delivery & Wash Surcharges
                  </CardTitle>
                  <p className="text-xs text-navy-300">
                    First delivery is always free — these rates apply after that, and to
                    the handwash option on the order form.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="delivery-fee" className="text-xs uppercase tracking-wide text-navy-300">
                      Delivery fee after the first free one (₦)
                    </Label>
                    <Input
                      id="delivery-fee"
                      type="number"
                      min="0"
                      value={app.deliveryFee}
                      onChange={(e) => setApp({ deliveryFee: Number(e.target.value) || 0 })}
                      className="mt-1.5 w-40"
                    />
                    <p className="mt-1 text-xs text-navy-300">
                      Currently {formatNaira(app.deliveryFee)} flat, island-wide. Research
                      benchmark: Lagos dispatch platforms ₦800–₦2,500 per delivery.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="handwash-pct" className="text-xs uppercase tracking-wide text-navy-300">
                      Handwash surcharge (% of cleaning subtotal)
                    </Label>
                    <Input
                      id="handwash-pct"
                      type="number"
                      min="0"
                      max="200"
                      value={app.handwashSurchargePercent}
                      onChange={(e) => setApp({ handwashSurchargePercent: Number(e.target.value) || 0 })}
                      className="mt-1.5 w-32"
                    />
                    <p className="mt-1 text-xs text-navy-300">
                      Machine wash stays free of surcharge — this is the gentle-care premium
                      for hand-finished pieces.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Guarantee eligibility + alterations */}
              <Card className="border-navy-100 shadow-navy">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-serif text-navy">
                    <Percent className="h-4 w-4 text-gold-400" /> Guarantee Eligibility & Alterations
                  </CardTitle>
                  <p className="text-xs text-navy-300">
                    &ldquo;Eligible order&rdquo; thresholds are shown word-for-word on the
                    Guarantee section; set 0 to disable a threshold.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="guarantee-min-garments" className="text-xs uppercase tracking-wide text-navy-300">
                      Minimum garments
                    </Label>
                    <Input
                      id="guarantee-min-garments"
                      type="number"
                      min="0"
                      value={app.guaranteeMinGarments}
                      onChange={(e) => setApp({ guaranteeMinGarments: Number(e.target.value) || 0 })}
                      className="mt-1.5 w-28"
                    />
                    <p className="mt-1 text-xs text-navy-300">e.g. 2 garments</p>
                  </div>
                  <div>
                    <Label htmlFor="guarantee-min-value" className="text-xs uppercase tracking-wide text-navy-300">
                      …or minimum order value (₦)
                    </Label>
                    <Input
                      id="guarantee-min-value"
                      type="number"
                      min="0"
                      value={app.guaranteeMinOrderValue}
                      onChange={(e) => setApp({ guaranteeMinOrderValue: Number(e.target.value) || 0 })}
                      className="mt-1.5 w-36"
                    />
                    <p className="mt-1 text-xs text-navy-300">Either threshold qualifies.</p>
                  </div>
                  <div>
                    <Label htmlFor="alterations-from" className="text-xs uppercase tracking-wide text-navy-300">
                      Alterations from-price (₦)
                    </Label>
                    <Input
                      id="alterations-from"
                      type="number"
                      min="0"
                      value={app.alterationsFromPrice}
                      onChange={(e) => setApp({ alterationsFromPrice: Number(e.target.value) || 0 })}
                      className="mt-1.5 w-36"
                    />
                    <p className="mt-1 text-xs text-navy-300">
                      <Scissors className="mr-1 inline h-3 w-3" />
                      Set once the tailor confirms — 0 shows &ldquo;quoted before we sew&rdquo;.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* GUARANTEE TAB */}
        <TabsContent value="guarantee" className="mt-4">
          <Card className="border-navy-100 shadow-navy">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-navy">
                <Percent className="h-4 w-4 text-gold-400" /> Return-as-Received Guarantee
              </CardTitle>
              <p className="text-xs text-navy-300">
                Discount applied when customers upload condition photos during retail
                booking.
              </p>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="guarantee-discount" className="text-xs uppercase tracking-wide text-navy-300">
                  Discount Percentage
                </Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <Input
                    id="guarantee-discount"
                    type="number"
                    min="0"
                    max="100"
                    value={draft.guaranteeDiscountPercent}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        guaranteeDiscountPercent: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-32"
                  />
                  <span className="text-sm font-medium text-navy">%</span>
                  <span className="ml-3 text-xs text-navy-300">
                    Customers save{' '}
                    <strong className="text-navy">
                      {draft.guaranteeDiscountPercent}% off
                    </strong>{' '}
                    their order when they upload condition photos
                  </span>
                </div>
              </div>

              <div className="mt-6 rounded-lg bg-gold-50 p-4 text-sm text-navy ring-1 ring-gold-200">
                <p className="font-serif font-semibold text-navy">Guarantee Terms</p>
                <p className="mt-2 text-xs leading-relaxed text-navy-300">
                  Return-as-Received Guarantee: By utilizing our Condition Capture feature,
                  we guarantee your garments will be returned clean and in the exact
                  structural condition documented at pickup. Covers physical damage in our
                  care; does not cover pre-existing wear or inherent fabric degradation.
                  Claims must be made within 24 hours of delivery.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
