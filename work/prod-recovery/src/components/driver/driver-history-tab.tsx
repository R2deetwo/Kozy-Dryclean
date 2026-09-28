'use client'

// =============================================================================
// HISTORY TAB (phase 61) — the rider's completed rides
// =============================================================================
// "Aren't riders entitled to see their previous rides?" — yes, and the
// record is the honest one: only legs THIS rider swiped complete (the same
// StatusEvent attribution the ops board audits), with the same on-time
// clocks the board colours run on. Grouped by day so a rider can answer
// "what did I do today?" at a glance.
// =============================================================================

import { useEffect, useState } from 'react'
import { Package, Truck, History as HistoryIcon, Clock, MapPin, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface Leg {
  orderId: string
  orderNumber: string
  leg: 'PICKUP' | 'DELIVERY'
  completedAt: string
  customerName: string
  address: string
  zone: string | null
  onTime: boolean | null
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86400000)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function DriverHistoryTab() {
  const [legs, setLegs] = useState<Leg[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/driver/history?limit=50')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((d) => {
        if (alive) setLegs(d.legs ?? [])
      })
      .catch(() => {
        if (alive) setError('Could not load your history — pull down and try again.')
      })
    return () => {
      alive = false
    }
  }, [])

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-rose-400" />
        <p className="text-sm font-semibold text-white">{error}</p>
      </div>
    )
  }

  if (legs === null) {
    // Skeleton — same shape as the real list so nothing jumps on load.
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-800" />
        ))}
      </div>
    )
  }

  if (legs.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-800 p-8 text-center">
        <HistoryIcon className="mx-auto mb-3 h-10 w-10 text-slate-500" />
        <p className="font-semibold text-white">No completed rides yet</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Every pickup and delivery you swipe complete lands here — with the
          time, the address and whether it beat the customer&apos;s slot.
        </p>
      </div>
    )
  }

  // Group by day, preserving the API's newest-first order.
  const groups: { label: string; legs: Leg[] }[] = []
  for (const leg of legs) {
    const label = dayLabel(leg.completedAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.legs.push(leg)
    else groups.push({ label, legs: [leg] })
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.label}>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Clock className="h-3.5 w-3.5" /> {g.label}
            <span className="font-normal normal-case text-slate-500">
              {g.legs.length} stop{g.legs.length === 1 ? '' : 's'}
            </span>
          </h3>
          <ul className="space-y-2">
            {g.legs.map((leg) => (
              <li
                key={`${leg.orderId}-${leg.leg}`}
                className="rounded-2xl bg-slate-800 p-4 ring-1 ring-inset ring-slate-700/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {leg.leg === 'PICKUP' ? (
                      <Badge className="bg-gold-400/90 text-navy hover:bg-gold-400/90">
                        <Package className="mr-1 h-3 w-3" /> Pickup
                      </Badge>
                    ) : (
                      <Badge className="bg-cyan-500/90 text-white hover:bg-cyan-500/90">
                        <Truck className="mr-1 h-3 w-3" /> Delivery
                      </Badge>
                    )}
                    <span className="font-mono text-[10px] text-slate-400">#{leg.orderNumber}</span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-semibold">
                    {leg.onTime === true && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-emerald-300">
                        <CheckCircle2 className="h-2.5 w-2.5" /> on time
                      </span>
                    )}
                    {leg.onTime === false && (
                      <span className="flex items-center gap-1 rounded-full bg-rose-400/15 px-2 py-0.5 text-rose-300">
                        <AlertCircle className="h-2.5 w-2.5" /> late
                      </span>
                    )}
                    {leg.onTime === null && (
                      <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-slate-400">—</span>
                    )}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-white">{leg.customerName}</p>
                <p className="mt-0.5 flex items-start gap-1 text-xs leading-snug text-slate-400">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="line-clamp-1">{leg.address}</span>
                </p>
                <p className="mt-1.5 text-[10px] text-slate-500">
                  Completed {timeLabel(leg.completedAt)}
                  {leg.zone ? ` · ${leg.zone}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="pb-2 text-center text-[10px] text-slate-500">
        Legs are credited to the rider who swiped them complete — re-assignments never rewrite your record.
      </p>
    </div>
  )
}
