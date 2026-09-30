'use client'

// =============================================================================
// StoreSettings (phase 77) — Settings → Store, super admins only
// =============================================================================
// The Kozy Store ships DARK: the master switch (AppSetting store_enabled,
// saved with the console's shared Save button) is the ONLY thing that makes
// products appear in the customer portal and as the quiet line in the
// monthly member summary. This whole Settings page is already admin-only in
// the console nav, and the settings PUT is ADMIN-only server-side, so staff
// can never light the store up. Product rows + requests manage themselves
// through the store APIs (instant, no Save needed).
// =============================================================================

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Store, Plus, Trash2, Check, X, PackageCheck, PackageX, Clock, Loader2, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { formatNaira, type KozyAppSettings } from '@/lib/types'
import { cn } from '@/lib/utils'

interface AdminProduct {
  id: string
  name: string
  tagline: string | null
  price: number
  active: boolean
  sortOrder: number
}

interface AdminRequest {
  id: string
  qty: number
  status: string
  note: string | null
  createdAt: string
  product: { id: string; name: string; price: number }
  user: { id: string; name: string; email: string; phone: string }
}

export function StoreSettings({
  app,
  setApp,
  saving,
}: {
  app: KozyAppSettings | null
  setApp: (patch: Partial<KozyAppSettings>) => void
  saving: boolean
}) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', tagline: '', price: '' })
  const [creating, setCreating] = useState(false)

  const { data: productsData } = useQuery({
    queryKey: ['store-admin-products'],
    queryFn: async () => {
      const res = await fetch('/api/store?all=1')
      if (!res.ok) throw new Error('Failed to load products')
      const data = await res.json()
      return (data.products ?? []) as AdminProduct[]
    },
    staleTime: 15 * 1000,
  })

  const { data: requestsData } = useQuery({
    queryKey: ['store-admin-requests'],
    queryFn: async () => {
      const res = await fetch('/api/store/requests')
      if (!res.ok) throw new Error('Failed to load requests')
      const data = await res.json()
      return (data.requests ?? []) as AdminRequest[]
    },
    refetchInterval: 30 * 1000,
  })

  const products = productsData ?? []
  const requests = requestsData ?? []
  const pending = requests.filter((r) => r.status === 'PENDING')

  const createProduct = async () => {
    const price = Number(form.price)
    if (form.name.trim().length < 2) {
      toast({ title: 'Give the product a name', variant: 'destructive' })
      return
    }
    if (!Number.isFinite(price) || price < 100) {
      toast({ title: 'Price must be at least ₦100', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/store/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, tagline: form.tagline, price }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save the product')
      setForm({ name: '', tagline: '', price: '' })
      queryClient.invalidateQueries({ queryKey: ['store-admin-products'] })
      toast({ title: 'Product listed', description: 'It stays hidden until the store switch is on.' })
    } catch (e: any) {
      toast({ title: 'Could not save the product', description: e?.message, variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const toggleProduct = async (p: AdminProduct) => {
    setBusy(p.id)
    try {
      const res = await fetch(`/api/store/products/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !p.active }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed')
      }
      queryClient.invalidateQueries({ queryKey: ['store-admin-products'] })
    } catch (e: any) {
      toast({ title: 'Could not update the product', description: e?.message, variant: 'destructive' })
    } finally {
      setBusy(null)
    }
  }

  const removeProduct = async (p: AdminProduct) => {
    setBusy(p.id)
    try {
      const res = await fetch(`/api/store/products/${p.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed')
      }
      queryClient.invalidateQueries({ queryKey: ['store-admin-products'] })
      toast({ title: 'Product retired' })
    } catch (e: any) {
      toast({ title: 'Could not delete the product', description: e?.message, variant: 'destructive' })
    } finally {
      setBusy(null)
    }
  }

  const decideRequest = async (r: AdminRequest, status: 'CONFIRMED' | 'DECLINED') => {
    setBusy(r.id)
    try {
      const res = await fetch(`/api/store/requests/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed')
      }
      queryClient.invalidateQueries({ queryKey: ['store-admin-requests'] })
      toast({
        title: status === 'CONFIRMED' ? 'Confirmed — it rides along' : 'Declined',
        description:
          status === 'CONFIRMED'
            ? `${r.user.name} sees "coming with your next pickup" in their portal.`
            : `${r.user.name} sees "not this time" in their portal.`,
      })
    } catch (e: any) {
      toast({ title: 'Could not update the request', description: e?.message, variant: 'destructive' })
    } finally {
      setBusy(null)
    }
  }

  const enabled = app?.storeEnabled === true

  return (
    <div className="space-y-4">
      {/* The master switch — super admin only by construction (this page is
          admin-only in the nav AND the settings PUT is ADMIN-only). */}
      <Card className={cn('border-navy-100 shadow-navy', enabled && 'border-emerald-200')}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-navy">
            <Store className="h-4 w-4 text-gold-400" /> The Kozy Store
            <Badge
              variant="outline"
              className={cn(
                'rounded-full',
                enabled
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-navy-200 bg-linen-100 text-navy-300'
              )}
            >
              {enabled ? 'ON — customers can see it' : 'OFF — completely hidden'}
            </Badge>
          </CardTitle>
          <p className="text-xs leading-relaxed text-navy-300">
            Hygiene essentials (scents, soaps, sprays — whitelabelled to Kozy) that ride along
            with a member&apos;s delivery. While the switch is OFF nothing exists anywhere a
            customer can see — no portal tab, no line in the monthly summary, never the
            landing page. Flip it ON and active products appear in the customer portal&apos;s
            Store tab and as ONE quiet line in the monthly summary email — never a separate
            mailshot. Customers tap &ldquo;add to my next delivery&rdquo;; you confirm or
            decline below. Only super admins can change this switch.
          </p>
        </CardHeader>
        <CardContent>
          <label
            className={cn(
              'flex cursor-pointer items-start justify-between gap-4 rounded-lg border p-3 transition',
              enabled ? 'border-emerald-300 bg-emerald-50/50' : 'border-navy-100 bg-white'
            )}
          >
            <span className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-linen-200 text-navy-300'
                )}
              >
                <Sparkles className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-medium text-navy">
                  Offer the store to customers and members
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-navy-300">
                  {saving
                    ? 'Saving…'
                    : 'Saves with the console Save button — the switch, and only this page, controls it.'}
                </span>
              </span>
            </span>
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-emerald-700"
              checked={enabled}
              onChange={(e) => setApp({ storeEnabled: e.target.checked })}
            />
          </label>
        </CardContent>
      </Card>

      {/* Products */}
      <Card className="border-navy-100 shadow-navy">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-navy">
            <PackageCheck className="h-4 w-4 text-gold-400" /> Products
          </CardTitle>
          <p className="text-xs text-navy-300">
            Instant to add, edit or retire (no Save needed). Inactive products stay on this
            list but never reach customers.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add-product form */}
          <div className="grid gap-2 rounded-lg border border-navy-100 bg-linen-50 p-3 sm:grid-cols-[1fr_1.4fr_120px_auto]">
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-navy-300">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Fresh Linen Spray"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-navy-300">Tagline (optional)</Label>
              <Input
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                placeholder="One spritz, hotel-fresh sheets for days"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-navy-300">Price (₦)</Label>
              <Input
                type="number"
                min={100}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="3500"
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={createProduct}
                disabled={creating}
                className="w-full rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90 sm:w-auto"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
                Add
              </Button>
            </div>
          </div>

          {products.length === 0 ? (
            <p className="py-4 text-center text-sm text-navy-300">
              No products yet — the shelf starts filling the moment you add the first one.
            </p>
          ) : (
            <div className="space-y-2">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-navy-100 bg-white px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-navy">
                      {p.name}
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wide',
                          p.active
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                            : 'bg-linen-200 text-navy-300'
                        )}
                      >
                        {p.active ? 'listed' : 'hidden'}
                      </span>
                    </p>
                    {p.tagline && <p className="truncate text-xs text-navy-300">{p.tagline}</p>}
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-navy">{formatNaira(p.price)}</p>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleProduct(p)}
                      disabled={busy === p.id}
                      className="h-8 rounded-full border-navy-200 text-xs text-navy hover:bg-navy hover:text-white"
                    >
                      {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : p.active ? 'Hide' : 'List'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeProduct(p)}
                      disabled={busy === p.id}
                      className="h-8 rounded-full border-rose-200 text-xs text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Requests */}
      <Card className="border-navy-100 shadow-navy">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-navy">
            <Clock className="h-4 w-4 text-gold-400" /> Requests
            {pending.length > 0 && (
              <Badge className="rounded-full bg-gold-400 text-[10px] font-bold uppercase tracking-wide text-navy">
                {pending.length} waiting
              </Badge>
            )}
          </CardTitle>
          <p className="text-xs text-navy-300">
            Customers asking for a product to ride along with their next pickup. Confirming
            tells them it&apos;s coming; declining reads as a polite &ldquo;not this time&rdquo;.
          </p>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="py-4 text-center text-sm text-navy-300">
              No requests yet — they land here the moment a customer taps
              &ldquo;add to my next delivery&rdquo;.
            </p>
          ) : (
            <div className="space-y-2">
              {requests.slice(0, 15).map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-navy-100 bg-white px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-navy">
                      {r.qty} × {r.product.name}{' '}
                      <span className="font-normal text-navy-300">
                        ({formatNaira(r.product.price * r.qty)})
                      </span>
                    </p>
                    <p className="truncate text-xs text-navy-300">
                      {r.user.name} · {r.user.email} · {r.user.phone}
                      {r.note ? ` · “${r.note}”` : ''}
                    </p>
                  </div>
                  {r.status === 'PENDING' ? (
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => decideRequest(r, 'CONFIRMED')}
                        disabled={busy === r.id}
                        className="h-8 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 text-xs font-semibold text-white hover:opacity-90"
                      >
                        {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                        Confirm
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => decideRequest(r, 'DECLINED')}
                        disabled={busy === r.id}
                        className="h-8 rounded-full border-navy-200 text-xs text-navy-300 hover:bg-linen-200"
                      >
                        <X className="mr-1 h-3.5 w-3.5" /> Decline
                      </Button>
                    </div>
                  ) : (
                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0 rounded-full',
                        r.status === 'CONFIRMED'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-navy-200 bg-linen-100 text-navy-300'
                      )}
                    >
                      {r.status === 'CONFIRMED' ? <PackageCheck className="mr-1 h-3 w-3" /> : <PackageX className="mr-1 h-3 w-3" />}
                      {r.status === 'CONFIRMED' ? 'Confirmed' : 'Declined'}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
