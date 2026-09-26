'use client'

// =============================================================================
// BranchHealth — per-location pulse (phase 62)
// =============================================================================
// The founder's "is something going wrong at Chevron?" view. One card per
// active branch: live load, today's pickups, money waiting, riders on duty —
// with amber alert chips when a branch is drifting (unrouted pickups, stale
// receipts, no riders). Shares the orders/payments/users query caches with
// the rest of the console, so opening this tab costs no extra requests.
// =============================================================================

import { useMemo } from 'react'
import {
  MapPin,
  Package,
  Truck,
  Wallet,
  CreditCard,
  Bike,
  AlertTriangle,
  Activity,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useOrders, usePayments, useUsers, useBranches, ADMIN_POLL } from '@/lib/hooks'
import { formatNaira } from '@/lib/types'
import { cn } from '@/lib/utils'

export function BranchHealth() {
  const { data: branches } = useBranches()
  const { data: orders } = useOrders({
    fetchAll: true,
    refetchInterval: ADMIN_POLL.medium,
    refetchOnWindowFocus: true,
  })
  const { data: payments } = usePayments({
    fetchAll: true,
    refetchInterval: ADMIN_POLL.medium,
    refetchOnWindowFocus: true,
  })
  const { data: users } = useUsers({ fetchAll: true, refetchInterval: ADMIN_POLL.slow })

  const activeBranches = (branches ?? []).filter((b) => b.isActive)

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const stats = useMemo(() => {
    return activeBranches.map((branch) => {
      const branchOrders = (orders ?? []).filter((o) => o.branchId === branch.id)
      const active = branchOrders.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status))
      const todayPickups = branchOrders.filter(
        (o) =>
          new Date(o.pickupDate) >= startOfToday &&
          new Date(o.pickupDate) < new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000) &&
          !['CANCELLED', 'DELIVERED'].includes(o.status)
      )
      const unassignedToday = todayPickups.filter((o) => !o.driverId)
      const awaitingPayment = branchOrders.filter((o) => o.status === 'PAYMENT_PENDING_VERIFICATION')
      const staleReceipts = awaitingPayment.filter(
        (o) => Date.now() - new Date(o.createdAt).getTime() > 24 * 60 * 60 * 1000
      )
      // Revenue this week: verified payments on this branch's orders.
      const orderIds = new Set(branchOrders.map((o) => o.id))
      const weekRevenue = (payments ?? [])
        .filter(
          (p) =>
            p.status === 'VERIFIED' &&
            p.orderId &&
            orderIds.has(p.orderId) &&
            new Date(p.verifiedAt ?? p.createdAt) >= weekAgo
        )
        .reduce((s, p) => s + (p.amount ?? 0), 0)
      const riders = (users ?? []).filter((u) => u.role === 'DRIVER' && (u as any).branchId === branch.id)
      const ordersWithNoBranch = (orders ?? []).filter((o) => !o.branchId && o.status !== 'CANCELLED').length

      const alerts: string[] = []
      if (unassignedToday.length > 0)
        alerts.push(`${unassignedToday.length} of today's ${todayPickups.length} pickup${todayPickups.length === 1 ? '' : 's'} still has no rider`)
      if (staleReceipts.length > 0)
        alerts.push(`${staleReceipts.length} transfer receipt${staleReceipts.length === 1 ? '' : 's'} waiting over 24h`)
      if (riders.length === 0) alerts.push('No riders assigned to this branch (Team → Riders)')

      return {
        branch,
        active: active.length,
        todayPickups: todayPickups.length,
        unassignedToday: unassignedToday.length,
        awaitingPayment: awaitingPayment.length,
        weekRevenue,
        riders: riders.length,
        alerts,
      }
    })
    // startOfToday/weekAgo are recomputed every render — excluding them from
    // the dep list keeps the memo stable across renders within the same load.
  }, [activeBranches, orders, payments, users])

  const unassignedTotal = (orders ?? []).filter((o) => !o.branchId && o.status !== 'CANCELLED').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-semibold tracking-tight text-navy">
            Branch health
          </h2>
          <p className="mt-0.5 text-xs text-navy-300">
            The pulse of each location — live load, today&apos;s route, money waiting and riders
            on duty.
          </p>
        </div>
        {unassignedTotal > 0 && (
          <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-[10px] text-amber-700">
            {unassignedTotal} order{unassignedTotal === 1 ? '' : 's'} without a branch — route them from the order modal
          </Badge>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {stats.map((s) => (
          <Card key={s.branch.id} className="shadow-navy">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gold-600" />
                    <p className="font-serif text-lg font-semibold text-navy">{s.branch.name}</p>
                    {s.branch.isDefault && (
                      <Badge variant="outline" className="rounded-full text-[9px] text-navy-300">
                        default
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-navy-300">{s.branch.address}</p>
                  <p className="mt-0.5 text-[11px] text-navy-300">
                    Zones: {s.branch.zoneNames.length > 0 ? s.branch.zoneNames.join(', ') : 'none assigned'}
                  </p>
                </div>
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    s.alerts.length === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                  )}
                >
                  {s.alerts.length === 0 ? <Activity className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat icon={Package} label="Active orders" value={String(s.active)} />
                <Stat
                  icon={Truck}
                  label="Today's pickups"
                  value={String(s.todayPickups)}
                  tone={s.unassignedToday > 0 ? 'amber' : 'default'}
                />
                <Stat
                  icon={CreditCard}
                  label="Awaiting payment"
                  value={String(s.awaitingPayment)}
                  tone={s.awaitingPayment > 0 ? 'amber' : 'default'}
                />
                <Stat icon={Wallet} label="Revenue (7d)" value={formatNaira(s.weekRevenue)} />
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-xs text-navy-300">
                <Bike className="h-3.5 w-3.5 text-gold-600" />
                {s.riders > 0 ? `${s.riders} rider${s.riders === 1 ? '' : 's'} call this branch home` : 'No riders assigned'}
              </div>

              {s.alerts.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {s.alerts.map((a) => (
                    <li
                      key={a}
                      className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 ring-1 ring-amber-100"
                    >
                      <AlertTriangle className="h-3 w-3 shrink-0" /> {a}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: any
  label: string
  value: string
  tone?: 'default' | 'amber'
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        tone === 'amber' ? 'border-amber-200 bg-amber-50/60' : 'border-navy-100 bg-white'
      )}
    >
      <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-navy-300">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="mt-1 font-mono text-sm font-semibold text-navy">{value}</p>
    </div>
  )
}
