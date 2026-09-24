'use client'

// =============================================================================
// EARNINGS TAB (phase 61) — the rider's payout ledger
// =============================================================================
// "Aren't riders entitled to see their earnings?" — yes, and the number is
// only ever REAL: completed legs × the per-stop rates the office publishes
// in Settings → Rider pay. Until the office sets rates, this screen says so
// plainly instead of inventing a figure; once they do, it becomes a
// transparent ledger — every line a leg the rider swiped, priced at the
// published rate, rolled into the payout week (Monday, Lagos time).
// =============================================================================

import { useEffect, useState } from 'react'
import { Wallet, Package, Truck, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface LedgerRow {
  orderNumber: string
  leg: 'PICKUP' | 'DELIVERY'
  completedAt: string
  zone: string | null
  onTime: boolean | null
  amount: number
}

interface Earnings {
  published: boolean
  rates: { pickup: number; delivery: number }
  summary: {
    week: number
    weekLegs: number
    total: number
    pickups: number
    deliveries: number
    onTimePct: number | null
  }
  ledger: LedgerRow[]
}

const naira = (n: number) =>
  `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`

export function DriverEarningsTab() {
  const [data, setData] = useState<Earnings | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/driver/earnings')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((d) => {
        if (alive) setData(d)
      })
      .catch(() => {
        if (alive) setError('Could not load your earnings — pull down and try again.')
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

  if (data === null) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 animate-pulse rounded-2xl bg-slate-800" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-800" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-800" />
        ))}
      </div>
    )
  }

  if (!data.published) {
    // Rates unpublished — the honest state. Work is still visible; no fake numbers.
    const { summary } = data
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-slate-800 p-6 text-center ring-1 ring-inset ring-slate-700/60">
          <Wallet className="mx-auto mb-3 h-10 w-10 text-slate-500" />
          <p className="font-semibold text-white">Rider rates aren&apos;t published yet</p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
            The office sets the per-stop rates (pickup and delivery) in the admin
            console — the moment they do, this screen becomes your payout
            ledger. Until then, here is what you&apos;ve done:
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-800 p-3 text-center">
            <p className="text-xs text-slate-400">All-time</p>
            <p className="text-2xl font-bold text-white">{summary.pickups + summary.deliveries}</p>
            <p className="text-[10px] text-slate-500">stops completed</p>
          </div>
          <div className="rounded-xl bg-slate-800 p-3 text-center">
            <p className="text-xs text-slate-400">Pickups</p>
            <p className="text-2xl font-bold text-gold-400">{summary.pickups}</p>
            <p className="text-[10px] text-slate-500">collected</p>
          </div>
          <div className="rounded-xl bg-slate-800 p-3 text-center">
            <p className="text-xs text-slate-400">Deliveries</p>
            <p className="text-2xl font-bold text-cyan-400">{summary.deliveries}</p>
            <p className="text-[10px] text-slate-500">handed over</p>
          </div>
        </div>
        {summary.onTimePct !== null && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            {summary.onTimePct}% of your timed stops beat the customer&apos;s slot
          </p>
        )}
        <p className="text-center text-[10px] leading-relaxed text-slate-500">
          Full details of every completed ride are in the History tab.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* This payout week */}
      <div className="rounded-2xl bg-gradient-to-br from-navy to-navy-500 p-5 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold-300">This payout week</p>
        <p className="mt-1 text-4xl font-bold text-white">{naira(data.summary.week)}</p>
        <p className="mt-1 text-xs text-white/70">
          {data.summary.weekLegs} stop{data.summary.weekLegs === 1 ? '' : 's'} since Monday · resets Monday 00:00
        </p>
      </div>

      {/* All-time + reliability */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-800 p-4">
          <p className="text-xs text-slate-400">All-time</p>
          <p className="mt-0.5 text-xl font-bold text-white">{naira(data.summary.total)}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {data.summary.pickups + data.summary.deliveries} stops at today&apos;s rates
          </p>
        </div>
        <div className="rounded-xl bg-slate-800 p-4">
          <p className="text-xs text-slate-400">On-time</p>
          <p className="mt-0.5 text-xl font-bold text-emerald-400">
            {data.summary.onTimePct === null ? '—' : `${data.summary.onTimePct}%`}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">vs the customer&apos;s slot</p>
        </div>
      </div>

      {/* Published rates */}
      <div className="flex items-center justify-center gap-3 rounded-xl bg-slate-800/60 px-4 py-2.5 text-xs text-slate-300">
        <span className="flex items-center gap-1">
          <Package className="h-3 w-3 text-gold-400" /> {naira(data.rates.pickup)} / pickup
        </span>
        <span className="text-slate-600">·</span>
        <span className="flex items-center gap-1">
          <Truck className="h-3 w-3 text-cyan-400" /> {naira(data.rates.delivery)} / delivery
        </span>
      </div>

      {/* The ledger — every line a leg the rider swiped */}
      {data.ledger.length > 0 && (
        <div className="rounded-2xl bg-slate-800 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Recent stops</p>
          <ul className="mt-2 divide-y divide-slate-700/60">
            {data.ledger.map((row, i) => (
              <li key={`${row.orderNumber}-${row.leg}-${i}`} className="flex items-center justify-between gap-2 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  {row.leg === 'PICKUP' ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-400/15">
                      <Package className="h-3 w-3 text-gold-400" />
                    </span>
                  ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/15">
                      <Truck className="h-3 w-3 text-cyan-400" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-slate-300">#{row.orderNumber}</p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(row.completedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      {row.zone ? ` · ${row.zone}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {row.onTime === true && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                  {row.onTime === false && <AlertCircle className="h-3.5 w-3.5 text-rose-400" />}
                  <span className={cn('text-sm font-bold', row.amount > 0 ? 'text-emerald-300' : 'text-slate-500')}>
                    +{naira(row.amount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="flex items-start gap-1.5 pb-2 text-[10px] leading-relaxed text-slate-500">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Earnings are calculated per completed stop at the office&apos;s published rates. Payout
        timing and method follow your arrangement with the office — this screen is your
        record of the work behind it.
      </p>
    </div>
  )
}
