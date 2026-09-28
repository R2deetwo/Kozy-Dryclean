'use client'

// =============================================================================
// PARTNER EARNINGS TAB (phase 72) — the share ledger + settlements
// =============================================================================
// The partner's money, in the same shape the rider's Earnings tab uses:
// PENDING (share earned minus what the office has settled) is the headline,
// with the month's work, the settlement history and every delivered order
// behind the numbers. The office's Partners desk reads the same functions —
// the numbers cannot disagree.
// =============================================================================

import { Info, Banknote, Landmark, TrendingUp, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePartnerEarnings } from '@/lib/hooks'

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })

export function PartnerEarningsTab() {
  const { data, isLoading, error } = usePartnerEarnings({ refetchInterval: 60_000 })

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <p className="text-sm font-semibold text-white">Could not load your earnings — try again in a moment.</p>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <div className="h-28 animate-pulse rounded-2xl bg-slate-800" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 animate-pulse rounded-xl bg-slate-800" />
          <div className="h-20 animate-pulse rounded-xl bg-slate-800" />
        </div>
        <div className="h-32 animate-pulse rounded-2xl bg-slate-800" />
      </div>
    )
  }

  const { ledger, settlements, deliveredOrders, sharePct } = data
  const pending = settlements.pending

  return (
    <div className="space-y-4">
      {/* Pending settlement — the headline */}
      <div className="rounded-2xl bg-gradient-to-br from-navy to-navy-500 p-5 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold-300">Pending settlement</p>
        <p className="mt-1 text-4xl font-bold text-white">{naira(Math.max(pending, 0))}</p>
        <p className="mt-1 text-xs text-white/70">
          {pending < 0
            ? `You are ${naira(-pending)} settled ahead of the ledger — the office will account for it`
            : `your ${sharePct}% share of delivered orders, not yet settled`}
        </p>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-white/10 px-3.5 py-2.5">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/60">Share earned</p>
            <p className="text-lg font-bold text-white">{naira(ledger.shareEarned)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Settled to date</p>
            <p className="text-lg font-bold text-emerald-300">{naira(settlements.settledTotal)}</p>
          </div>
        </div>
      </div>

      {/* This month */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-800 p-4">
          <p className="flex items-center gap-1 text-xs text-slate-400">
            <TrendingUp className="h-3 w-3 text-gold-400" /> This month
          </p>
          <p className="mt-0.5 text-xl font-bold text-white">{naira(ledger.shareThisMonth)}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {ledger.ordersThisMonth} order{ledger.ordersThisMonth === 1 ? '' : 's'} · {naira(ledger.revenueThisMonth)} value
          </p>
        </div>
        <div className="rounded-xl bg-slate-800 p-4">
          <p className="text-xs text-slate-400">Lifetime</p>
          <p className="mt-0.5 text-xl font-bold text-white">{naira(ledger.shareEarned)}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {ledger.ordersLifetime} order{ledger.ordersLifetime === 1 ? '' : 's'} · {naira(ledger.revenueLifetime)} value
          </p>
        </div>
      </div>

      {/* Settlements — the money that moved */}
      {settlements.history.length > 0 ? (
        <div className="rounded-2xl bg-slate-800 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Settlements received</p>
          <ul className="mt-2 divide-y divide-slate-700/60">
            {settlements.history.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
                    <Banknote className="h-3 w-3 text-emerald-400" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-slate-300">
                      {s.method === 'CASH' ? 'Cash' : 'Bank transfer'}
                      {s.reference ? <span className="text-slate-500"> · {s.reference}</span> : null}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {fmtDate(s.createdAt)}
                      {s.note ? ` · ${s.note}` : ''}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-bold text-emerald-300">{naira(s.amount)}</span>
              </li>
            ))}
          </ul>
          {settlements.lastSettlementAt && (
            <p className="mt-2 text-[10px] text-slate-500">
              Last settlement {fmtDate(settlements.lastSettlementAt)} — a receipt email follows every one.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-800 p-5 text-center ring-1 ring-inset ring-slate-700/60">
          <Landmark className="mx-auto mb-2 h-7 w-7 text-slate-500" />
          <p className="text-sm font-semibold text-white">No settlements yet</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            The office settles your share as agreed (typically monthly). Your earned share and the
            orders behind it are listed below — this screen is your record of both sides.
          </p>
        </div>
      )}

      {/* The orders behind the numbers — the proof ledger */}
      {deliveredOrders.length > 0 && (
        <div className="rounded-2xl bg-slate-800 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Delivered orders</p>
          <ul className="mt-2 divide-y divide-slate-700/60">
            {deliveredOrders.map((o, i) => (
              <li key={`${o.orderNumber}-${i}`} className="flex items-center justify-between gap-2 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/15">
                    <CheckCircle2 className="h-3 w-3 text-cyan-400" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-slate-300">#{o.orderNumber}</p>
                    <p className="text-[10px] text-slate-500">
                      {o.customerName} · {o.deliveredAt ? fmtDate(o.deliveredAt) : '—'}
                      {o.serviceSpeed !== 'STANDARD' ? ' · express' : ''}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn('text-sm font-bold text-emerald-300')}>{naira(o.yourShare)}</p>
                  <p className="text-[9px] text-slate-500">of {naira(o.orderValue)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="flex items-start gap-1.5 pb-2 text-[10px] leading-relaxed text-slate-500">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        You earn {sharePct}% of the value of every delivered order routed to you. Settlements land in
        the bank account on your Account tab, and a receipt email follows each one. Questions about
        a figure? The office sees exactly the same ledger.
      </p>
    </div>
  )
}
