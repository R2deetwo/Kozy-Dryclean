'use client'

// =============================================================================
// EARNINGS TAB (phase 61 → phase 72) — the rider's money, both sides
// =============================================================================
// Worked-out pay, end to end:
//   EARNED  — completed legs × the per-stop rates the office publishes in
//             Settings → Rider pay. Every line is a leg the rider swiped.
//   PAID    — payouts the office actually settled (weekly cycle, Monday
//             00:00 Lagos; recorded with method + reference).
//   PENDING — earned minus paid. This is the number the office settles next.
// Until the office publishes rates, the screen says so plainly instead of
// inventing a figure; once they do, it is a transparent ledger with a money
// trail behind it. Bank details live in the Account tab — the screen nudges
// the rider to add them if they haven't (that is where the money goes).
// =============================================================================

import { useEffect, useState } from 'react'
import { Wallet, Package, Truck, CheckCircle2, AlertCircle, Info, Landmark, Banknote } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LedgerRow {
  orderNumber: string
  leg: 'PICKUP' | 'DELIVERY'
  completedAt: string
  zone: string | null
  distanceKm: number | null
  onTime: boolean | null
  amount: number
  distancePay: number
}

interface PayoutRow {
  id: string
  amount: number
  method: string
  reference: string | null
  note: string | null
  createdAt: string
}

interface Earnings {
  published: boolean
  rates: { pickup: number; delivery: number; perKm: number; freeKm: number; cap: number }
  summary: {
    week: number
    weekLegs: number
    total: number
    pickups: number
    deliveries: number
    onTimePct: number | null
  }
  payouts: {
    paidTotal: number
    pending: number
    lastPayoutAt: string | null
    history: PayoutRow[]
  }
  bank: { set: boolean; bankName?: string | null; bankAccountNumber?: string | null }
  ledger: LedgerRow[]
}

const naira = (n: number) =>
  `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

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

  const pending = data.payouts.pending

  return (
    <div className="space-y-4">
      {/* Pending payout — the headline number */}
      <div className="rounded-2xl bg-gradient-to-br from-navy to-navy-500 p-5 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold-300">Pending payout</p>
        <p className="mt-1 text-4xl font-bold text-white">{naira(Math.max(pending, 0))}</p>
        <p className="mt-1 text-xs text-white/70">
          {pending < 0
            ? `You are ${naira(-pending)} settled ahead of the ledger — the office will account for it`
            : 'earned and not yet paid — the office settles every week'}
        </p>
        {/* This week, inside the same card: the week in progress */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-white/10 px-3.5 py-2.5">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/60">This week</p>
            <p className="text-lg font-bold text-white">
              {naira(data.summary.week)}{' '}
              <span className="text-[11px] font-normal text-white/60">
                · {data.summary.weekLegs} stop{data.summary.weekLegs === 1 ? '' : 's'} since Monday
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Paid to date</p>
            <p className="text-lg font-bold text-emerald-300">{naira(data.payouts.paidTotal)}</p>
          </div>
        </div>
      </div>

      {/* Bank details nudge — where the money goes */}
      {!data.bank.set && (
        <div className="flex items-start gap-2.5 rounded-xl border border-gold-400/30 bg-gold-400/10 p-3.5">
          <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
          <p className="text-xs leading-relaxed text-gold-100/90">
            Add your bank details in the <strong className="text-gold-200">Account</strong> tab so your
            payouts reach the right account — the office pays what is listed there.
          </p>
        </div>
      )}

      {/* All-time + reliability */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-800 p-4">
          <p className="text-xs text-slate-400">All-time earned</p>
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

      {/* Published rates — base per stop + the distance terms */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl bg-slate-800/60 px-4 py-2.5 text-xs text-slate-300">
        <span className="flex items-center gap-1">
          <Package className="h-3 w-3 text-gold-400" /> {naira(data.rates.pickup)} / pickup
        </span>
        <span className="text-slate-600">·</span>
        <span className="flex items-center gap-1">
          <Truck className="h-3 w-3 text-cyan-400" /> {naira(data.rates.delivery)} / delivery
        </span>
        {data.rates.perKm > 0 && (
          <>
            <span className="text-slate-600">·</span>
            <span className="flex items-center gap-1 text-slate-400">
              + {naira(data.rates.perKm)}/km past the first {data.rates.freeKm} km
            </span>
          </>
        )}
        {data.bank.set && (
          <>
            <span className="text-slate-600">·</span>
            <span className="flex items-center gap-1 text-slate-400">
              <Landmark className="h-3 w-3 text-emerald-400" />
              {data.bank.bankName} {data.bank.bankAccountNumber?.slice(-4) ? `··${data.bank.bankAccountNumber.slice(-4)}` : ''}
            </span>
          </>
        )}
      </div>

      {/* Payout history — the money that moved */}
      {data.payouts.history.length > 0 && (
        <div className="rounded-2xl bg-slate-800 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Payouts received</p>
          <ul className="mt-2 divide-y divide-slate-700/60">
            {data.payouts.history.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
                    <Banknote className="h-3 w-3 text-emerald-400" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-slate-300">
                      {p.method === 'CASH' ? 'Cash' : 'Bank transfer'}
                      {p.reference ? <span className="text-slate-500"> · {p.reference}</span> : null}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {fmtDate(p.createdAt)}
                      {p.note ? ` · ${p.note}` : ''}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-bold text-emerald-300">{naira(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
                      {row.distanceKm !== null && row.distanceKm !== undefined ? ` · ${row.distanceKm} km` : ''}
                    </p>
                    {row.distancePay > 0 && (
                      <p className="text-[10px] text-gold-400/80">incl. {naira(row.distancePay)} distance</p>
                    )}
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
        Every stop earns the published base rate, and longer legs earn a
        distance top-up on top — measured from your branch to the stop&apos;s area,
        with the first few kilometres included in the base. The office settles
        your pending balance weekly to the bank account on your Account tab, and
        a receipt is emailed the moment it is recorded.
      </p>
    </div>
  )
}
