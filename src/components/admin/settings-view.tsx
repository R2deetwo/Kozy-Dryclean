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
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { GARMENT_CATALOG, formatNaira, type KozySettings } from '@/lib/types'
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
  Household: 'Household',
  Extras: 'Extras',
  Shoes: 'Shoes & Sneakers',
  Other: 'Other & Bespoke (quoted)',
}

export function SettingsView() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const setGarmentPrice = useStore((s) => s.setGarmentPrice)

  const [draft, setDraft] = useState<KozySettings>(settings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    // Save bank/contact/pricing settings
    updateSettings({
      bankName: draft.bankName,
      accountName: draft.accountName,
      accountNumber: draft.accountNumber,
      contactPhone: draft.contactPhone,
      contactEmail: draft.contactEmail,
      atelierAddress: draft.atelierAddress,
      pricePerKg: draft.pricePerKg,
      minimumKg: draft.minimumKg,
      guaranteeDiscountPercent: draft.guaranteeDiscountPercent,
    })
    // Save individual garment prices locally…
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
          <TabsTrigger value="guarantee" className="data-[state=active]:bg-navy data-[state=active]:text-white">
            <Percent className="mr-1.5 h-3.5 w-3.5" /> Guarantee
          </TabsTrigger>
        </TabsList>

        {/* BANK ACCOUNT TAB */}
        <TabsContent value="bank" className="mt-4">
          <Card className="border-navy-100 shadow-navy">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-navy">
                <Building2 className="h-4 w-4 text-gold-400" /> Bank Account Details
              </CardTitle>
              <p className="text-xs text-navy-300">
                These details appear during checkout when customers choose
                &ldquo;Bank Transfer&rdquo; as their payment method.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="bank-name" className="text-xs uppercase tracking-wide text-navy-300">
                  Bank Name
                </Label>
                <Input
                  id="bank-name"
                  value={draft.bankName}
                  onChange={(e) => setDraft({ ...draft, bankName: e.target.value })}
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
                  value={draft.accountName}
                  onChange={(e) => setDraft({ ...draft, accountName: e.target.value })}
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
                  value={draft.accountNumber}
                  onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })}
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
                    <span className="font-medium">{draft.bankName || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-navy-100/70">Account Name</span>
                    <span className="font-medium">{draft.accountName || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-navy-100/70">Account Number</span>
                    <span className="font-mono font-bold text-gold-300">
                      {draft.accountNumber || '—'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTACT TAB */}
        <TabsContent value="contact" className="mt-4">
          <Card className="border-navy-100 shadow-navy">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-navy">
                <Phone className="h-4 w-4 text-gold-400" /> Contact Information
              </CardTitle>
              <p className="text-xs text-navy-300">
                Shown in the landing page footer, customer dashboard, and order
                confirmation messages.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="contact-phone" className="text-xs uppercase tracking-wide text-navy-300">
                  <Phone className="mr-1 inline h-3 w-3" /> Phone Number
                </Label>
                <Input
                  id="contact-phone"
                  value={draft.contactPhone}
                  onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })}
                  placeholder="+234 800 569 3789"
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
                  value={draft.contactEmail}
                  onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })}
                  placeholder="concierge@kozy.ng"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="atelier-address" className="text-xs uppercase tracking-wide text-navy-300">
                  <MapPin className="mr-1 inline h-3 w-3" /> Atelier Address
                </Label>
                <Input
                  id="atelier-address"
                  value={draft.atelierAddress}
                  onChange={(e) => setDraft({ ...draft, atelierAddress: e.target.value })}
                  placeholder="Kozy Atelier, 12 Gerard Rd, Ikoyi, Lagos"
                  className="mt-1.5"
                />
              </div>
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
              {(['Shirts', 'Trousers', 'Suits', 'Traditional', "Women's Wear", 'Household', 'Extras', 'Shoes', 'Other'] as const).map(
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
