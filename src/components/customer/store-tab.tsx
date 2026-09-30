'use client'

// =============================================================================
// StoreTab (phase 77) — the Kozy Store in the customer portal
// =============================================================================
// Hygiene add-ons (scents, soaps, sprays — whitelabelled to Kozy) that ride
// along with a delivery. This tab is ONLY mounted when /api/store says the
// store is enabled AND has active products — while the office keeps the
// switch off, this component never renders a single pixel, and the landing
// page never carries the store at all. Ordering is deliberately light: tap
// "add to my next delivery", the office confirms, the status shows here.
// =============================================================================

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, ShoppingBag, PackageCheck, PackageX, Clock, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { formatNaira } from '@/lib/types'
import { cn } from '@/lib/utils'

interface StoreProduct {
  id: string
  name: string
  tagline: string | null
  price: number
}

interface MyRequest {
  id: string
  qty: number
  status: string
  note: string | null
  createdAt: string
  product: { id: string; name: string; price: number }
}

export function StoreTab({ products }: { products: StoreProduct[] }) {
  const queryClient = useQueryClient()
  const [busyId, setBusyId] = useState<string | null>(null)

  const { data: myRequests } = useQuery({
    queryKey: ['my-store-requests'],
    queryFn: async () => {
      const res = await fetch('/api/store/requests?mine=1')
      if (!res.ok) return { requests: [] as MyRequest[] }
      const data = await res.json()
      return { requests: (data.requests ?? []) as MyRequest[] }
    },
    staleTime: 30 * 1000,
  })

  const request = async (product: StoreProduct) => {
    setBusyId(product.id)
    try {
      const res = await fetch('/api/store/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, qty: 1 }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast({
          title: 'Noted — it rides along',
          description: `${product.name} joins your next pickup once the office confirms. You'll see the status here.`,
        })
        queryClient.invalidateQueries({ queryKey: ['my-store-requests'] })
      } else {
        toast({
          title: 'Could not send the request',
          description: data?.message ?? data?.error ?? 'Please try again in a moment.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Network hiccup',
        description: 'Please check your connection and try again.',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const requests = myRequests?.requests ?? []
  const pending = requests.filter((r) => r.status === 'PENDING')
  const resolved = requests.filter((r) => r.status !== 'PENDING')

  return (
    <div className="space-y-4">
      <Card className="border-navy-100 shadow-navy">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-600">
                The Kozy Store
              </p>
              <p className="mt-1 font-serif text-xl font-semibold text-navy">
                Little extras, delivered with your laundry
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-100 text-navy">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-navy-300">
            Scent, soap and care essentials chosen by the Kozy office. Tap add and it rides
            along with your next pickup — the office confirms, then it appears with your
            fresh laundry. No separate trip, no separate delivery fee.
          </p>
        </CardContent>
      </Card>

      <StoreProducts products={products} busyId={busyId} onRequest={request} />

      {requests.length > 0 && (
        <Card className="border-navy-100 shadow-navy">
          <CardContent className="p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">
              Your requests
            </p>
            <div className="mt-3 space-y-2">
              {[...pending, ...resolved].slice(0, 8).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-navy-100 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy">
                      {r.qty} × {r.product.name}
                    </p>
                    <p className="text-xs text-navy-300">
                      {formatNaira(r.product.price * r.qty)}
                    </p>
                  </div>
                  {r.status === 'PENDING' && (
                    <Badge variant="outline" className="shrink-0 rounded-full border-amber-200 bg-amber-50 text-amber-700">
                      <Clock className="mr-1 h-3 w-3" /> Office confirming
                    </Badge>
                  )}
                  {r.status === 'CONFIRMED' && (
                    <Badge variant="outline" className="shrink-0 rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">
                      <PackageCheck className="mr-1 h-3 w-3" /> Coming with your next pickup
                    </Badge>
                  )}
                  {r.status === 'DECLINED' && (
                    <Badge variant="outline" className="shrink-0 rounded-full border-navy-200 bg-linen-100 text-navy-300">
                      <PackageX className="mr-1 h-3 w-3" /> Not this time
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// The product grid is fed by the PARENT (customer-portal) which already
// fetched /api/store to decide whether the tab exists at all — products are
// passed down so there is one fetch, one source of truth.
function StoreProducts({
  products,
  busyId,
  onRequest,
}: {
  products?: StoreProduct[]
  busyId: string | null
  onRequest: (p: StoreProduct) => void
}) {
  if (products === undefined) {
    return (
      <Card className="border-navy-100 shadow-navy">
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-navy-300" />
        </CardContent>
      </Card>
    )
  }
  if (products.length === 0) {
    return (
      <Card className="border-dashed border-navy-200">
        <CardContent className="flex flex-col items-center justify-center gap-2 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linen-200 text-navy-300">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <p className="font-medium text-navy">The shelf is being restocked</p>
          <p className="max-w-sm text-sm text-navy-300">
            New essentials are on their way — they&apos;ll appear here, and as a quiet line in
            your monthly summary.
          </p>
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {products.map((p) => (
        <Card key={p.id} className="border-navy-100 shadow-navy">
          <CardContent className="flex h-full flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-serif text-base font-semibold text-navy">{p.name}</p>
              <p className="shrink-0 font-serif text-base font-bold text-navy">
                {formatNaira(p.price)}
              </p>
            </div>
            {p.tagline && (
              <p className="mt-1 flex-1 text-xs leading-relaxed text-navy-300">{p.tagline}</p>
            )}
            <Button
              onClick={() => onRequest(p)}
              disabled={busyId !== null}
              className={cn(
                'mt-3 w-full rounded-full font-semibold',
                'bg-gradient-to-br from-emerald-600 to-emerald-800 text-white hover:opacity-90'
              )}
            >
              {busyId === p.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShoppingBag className="mr-2 h-4 w-4" />
              )}
              Add to my next delivery
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
