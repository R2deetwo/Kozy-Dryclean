'use client'

// =============================================================================
// KitScanClient — what opens when someone scans the QR on a Kozy Bag/Box
// =============================================================================
// The API decides what the scanner may see (privacy ladder: passer-by →
// brand card; rider → operational subset; office → the full snapshot).
// Mobile-first: this page lives in someone's hand on a wash floor or in a
// van, one-handed, in a hurry.
// =============================================================================

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  Package,
  Footprints,
  BedDouble,
  Layers,
  Sun,
  Loader2,
  ScanLine,
  AlertTriangle,
  CalendarClock,
  RefreshCcw,
  Phone,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/types'
import { cn } from '@/lib/utils'

interface KitOrder {
  id: string
  orderNumber: string
  label: string
  status: string
  missed: boolean
  pickupDate: string
}

interface KitPayload {
  scope: 'public' | 'rider' | 'office'
  member?: { name: string; email?: string; phone?: string }
  planName?: string
  unitName?: string
  status?: string
  periodEnd?: string | null
  kitState?: string
  usage?: {
    unitsUsed: number
    unitsRemaining: number
    shoesRemaining: number
    duvetsRemaining: number
    curtainsRemaining: number
    springCleanRemaining: number
  } | null
  priority?: boolean
  activity?: KitOrder[]
}

const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EXPIRING: 'bg-amber-50 text-amber-700 border-amber-200',
  PAST_DUE: 'bg-amber-50 text-amber-700 border-amber-200',
  PENDING_ACTIVATION: 'bg-gold-50 text-navy border-gold-300',
  LAPSED: 'bg-navy-50 text-navy-300 border-navy-200',
  CANCELLED: 'bg-navy-50 text-navy-300 border-navy-200',
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Scheduled',
  PAYMENT_PENDING_VERIFICATION: 'Awaiting payment',
  PAYMENT_VERIFIED: 'Paid — awaiting pickup',
  PICKED_UP: 'Picked up',
  AT_STATION: 'At the station',
  PROCESSING: 'In the wash',
  FINISHING: 'Finishing',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

export function KitScanClient({ code }: { code: string }) {
  const { status: sessionStatus } = useSession()
  const [data, setData] = useState<KitPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Re-fetch once the session resolves — the privacy ladder depends on it.
  // `loading` is derived (no sync setState in the effect): pending session or
  // no payload yet. A scope swap after sign-in just swaps the card content.
  const loading = sessionStatus === 'loading' || (!data && !error)

  useEffect(() => {
    if (sessionStatus === 'loading') return
    let cancelled = false
    fetch(`/api/kit/${encodeURIComponent(code)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body?.message ?? 'Could not read this tag.')
        return body as KitPayload
      })
      .then((body) => {
        if (!cancelled) {
          setData(body)
          setError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? 'Could not read this tag.')
      })
    return () => {
      cancelled = true
    }
  }, [code, sessionStatus])

  return (
    <div className="min-h-screen bg-linen-100 pb-10">
      {/* Header */}
      <div className="bg-navy-gradient px-5 pb-6 pt-6 text-white">
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-gold-400" />
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-300">
              Kozy kit tag
            </p>
          </div>
          <p className="mt-1 font-mono text-lg font-semibold tracking-wider">{code.toUpperCase()}</p>
        </div>
      </div>

      <div className="mx-auto -mt-3 max-w-md px-4">
        {loading && (
          <div className="flex justify-center py-14">
            <Loader2 className="h-6 w-6 animate-spin text-navy-300" />
          </div>
        )}

        {!loading && error && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
            <AlertTriangle className="mx-auto h-6 w-6 text-amber-600" />
            <p className="mt-2 text-sm font-medium text-navy">{error}</p>
            <p className="mt-1 text-xs text-navy-300">
              If this bag is in your hands, the office can sort it out: 0803 175 5230.
            </p>
          </div>
        )}

        {/* ----- Passer-by: the brand card ----- */}
        {!loading && !error && data?.scope === 'public' && (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-navy-100 bg-white p-5 text-center shadow-navy">
              <Sparkles className="mx-auto h-6 w-6 text-gold-500" />
              <p className="mt-2 font-serif text-lg font-semibold text-navy">
                A Kozy Circle {data.unitName?.toLowerCase() ?? 'bag'}
              </p>
              <p className="mt-1 text-sm text-navy-300">
                This tag belongs to a {data.planName} member — their laundry travels in it, week
                in, week out, picked up and delivered by Kozy Care.
              </p>
              {data.kitState === 'WITH_MEMBER' && (
                <p className="mt-3 rounded-xl bg-linen-100 p-2.5 text-xs text-navy-300">
                  If you found this bag, please call Kozy Care on{' '}
                  <a href="tel:+2348031755230" className="font-semibold text-navy underline">
                    0803 175 5230
                  </a>{' '}
                  — a member is looking for it.
                </p>
              )}
            </div>
            <Link
              href="/"
              className="block rounded-full bg-gold-gradient py-3 text-center text-sm font-semibold text-navy"
            >
              See what Kozy Care does
            </Link>
          </div>
        )}

        {/* ----- Rider / office: the identification snapshot ----- */}
        {!loading && !error && data && data.scope !== 'public' && (
          <div className="mt-4 space-y-3">
            {/* Member hero */}
            <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-navy">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">
                    {data.scope === 'office' ? 'Member' : 'Kozy Circle member'}
                  </p>
                  <p className="mt-0.5 truncate font-serif text-xl font-semibold text-navy">
                    {data.member?.name ?? 'Member'}
                  </p>
                  <p className="mt-1 text-sm text-navy-300">{data.planName}</p>
                </div>
                {data.status && (
                  <Badge
                    variant="outline"
                    className={cn('rounded-full text-[10px]', STATUS_TONE[data.status] ?? STATUS_TONE.ACTIVE)}
                  >
                    {data.status === 'ACTIVE' ? 'active' : data.status.toLowerCase().replace('_', ' ')}
                  </Badge>
                )}
              </div>

              {data.scope === 'office' && data.member?.phone && (
                <a
                  href={`tel:${data.member.phone.replace(/\s/g, '')}`}
                  className="mt-3 flex items-center gap-2 rounded-xl bg-linen-100 p-3 text-sm font-medium text-navy"
                >
                  <Phone className="h-4 w-4 text-gold-600" />
                  {data.member.phone}
                </a>
              )}

              {data.periodEnd && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-navy-300">
                  <CalendarClock className="h-3.5 w-3.5 text-gold-600" />
                  Cycle runs to {formatDate(data.periodEnd)}
                  {data.priority && ' · priority windows'}
                </p>
              )}
            </div>

            {/* Cycle usage — the "what level are they at" answer */}
            {data.usage && (
              <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-navy">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">
                  This cycle
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <UsagePill
                    icon={Package}
                    label={`${data.unitName ?? 'Bag'} pickups left`}
                    value={data.usage.unitsRemaining}
                  />
                  {data.usage.shoesRemaining >= 0 && data.activity?.some((a) => a.label.includes('Shoe')) && (
                    <UsagePill icon={Footprints} label="Shoe cleans left" value={data.usage.shoesRemaining} />
                  )}
                  {data.usage.duvetsRemaining > 0 && (
                    <UsagePill icon={BedDouble} label="Duvet washes left" value={data.usage.duvetsRemaining} />
                  )}
                  {data.usage.curtainsRemaining > 0 && (
                    <UsagePill icon={Layers} label="Curtain care left" value={data.usage.curtainsRemaining} />
                  )}
                  {data.usage.springCleanRemaining > 0 && (
                    <UsagePill icon={Sun} label="Spring cleans left" value={data.usage.springCleanRemaining} />
                  )}
                </div>
              </div>
            )}

            {/* Kit state */}
            <div className="flex items-center gap-2 rounded-2xl border border-navy-100 bg-white p-4 text-xs text-navy-300 shadow-navy">
              <ShieldCheck className="h-4 w-4 shrink-0 text-gold-600" />
              {data.kitState === 'WITH_MEMBER'
                ? `${data.unitName ?? 'Kit'} is with the member — expect it full at pickup.`
                : data.kitState === 'PENDING_DELIVERY'
                  ? 'Kit not yet delivered — hand it over at the next pickup.'
                  : `Kit state: ${(data.kitState ?? '—').toLowerCase().replace('_', ' ')}.`}
            </div>

            {/* Recent pickups */}
            {data.activity && data.activity.length > 0 && (
              <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-navy">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">
                  Recent bookings
                </p>
                <div className="mt-2 divide-y divide-linen-100">
                  {data.activity.map((o) => (
                    <div key={o.id} className="flex items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-navy">{o.label}</p>
                        <p className="text-[11px] text-navy-300">
                          {formatDate(o.pickupDate)} · {ORDER_STATUS_LABEL[o.status] ?? o.status.toLowerCase()}
                        </p>
                      </div>
                      {o.missed && (
                        <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 text-[10px] text-rose-700">
                          missed
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Link
              href="/"
              className="flex items-center justify-center gap-2 rounded-full border border-navy-200 py-3 text-center text-sm font-semibold text-navy"
            >
              <RefreshCcw className="h-4 w-4" /> Kozy Care home
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

function UsagePill({
  icon: Icon,
  label,
  value,
}: {
  icon: any
  label: string
  value: number
}) {
  return (
    <div className="rounded-xl bg-linen-100 p-3">
      <div className="flex items-center gap-1.5 text-navy-300">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[10px] font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-1 font-serif text-xl font-bold text-navy">{value}</p>
    </div>
  )
}
