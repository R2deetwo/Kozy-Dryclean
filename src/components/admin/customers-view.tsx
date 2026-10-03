'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  Search,
  Phone,
  Mail,
  MapPin,
  Building2,
  User as UserIcon,
  Truck,
  Calendar,
  Shield,
  ShoppingBag,
  PlusCircle,
  Trash2,
  AlertTriangle,
  MailCheck,
  MailX,
  Award,
  HeartPulse,
  Crown,
} from 'lucide-react'
import { useUsers, useOrders, useDeleteUser, useAdminMemberships, ADMIN_POLL } from '@/lib/hooks'
import { useMemo } from 'react'
import { formatNaira, formatDate } from '@/lib/types'
import {
  computeCustomerHealth,
  vipCustomerIds,
  healthLabel,
  type CustomerHealth,
} from '@/lib/customer-health'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'

/** A customer counts as NEW for their first 7 days after signing up. */
const NEW_CUSTOMER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function isNewCustomer(createdAt: string | Date): boolean {
  return Date.now() - new Date(createdAt).getTime() < NEW_CUSTOMER_WINDOW_MS
}

/** "3d ago" / "2h ago" for the Last-order column. */
function sinceLabel(ms: number): string {
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${Math.max(1, mins)}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

const HEALTH_CHIP: Record<string, string> = {
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warn: 'bg-amber-50 text-amber-700 ring-amber-200',
  risk: 'bg-rose-50 text-rose-700 ring-rose-200',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const HEALTH_DOT: Record<string, string> = {
  good: 'bg-emerald-400',
  warn: 'bg-amber-400',
  risk: 'bg-rose-400',
  neutral: 'bg-slate-300',
}

function HealthChip({ health }: { health: CustomerHealth }) {
  const { label, tone } = healthLabel(health.status)
  return (
    <span
      title={health.sentence}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-px text-[10px] font-semibold ring-1',
        HEALTH_CHIP[tone]
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', HEALTH_DOT[tone])} />
      {label}
    </span>
  )
}

export function CustomersView() {
  // Users are the primary list here → incremental paging with a "Load more"
  // control (orders joined per-row need the full set → fetchAll).
  // Live mode (phase 25): the CRM list polls itself — new signups appear
  // without a refresh.
  const { data: users, hasMore, loadMore, isFetchingMore } = useUsers({
    refetchInterval: ADMIN_POLL.slow,
    refetchOnWindowFocus: true,
  })
  const { data: orders } = useOrders({
    fetchAll: true,
    refetchInterval: ADMIN_POLL.medium,
    refetchOnWindowFocus: true,
  })
  // Task 88 — the memberships roster. A member's laundry orders are
  // zero-naira BY DESIGN (the plan covers them): the money they actually
  // paid lives on the membership. Without joining it in here, a loyal
  // ₦50,000/month member read as "spent nothing" in Total Spent — the
  // exact gap the owner flagged.
  const { data: memberships } = useAdminMemberships({
    refetchInterval: ADMIN_POLL.slow,
  })
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'B2C' | 'B2B'>('all')
  const [healthFilter, setHealthFilter] = useState<'all' | 'vip' | 'loyal' | 'cooling' | 'atrisk'>('all')
  const [selected, setSelected] = useState<any | undefined>(undefined)

  // Phase 59 — this is the CUSTOMERS list, customers only. Riders and
  // admins are different kinds of people with different data models: a
  // rider is tracked on stops completed and GPS presence (their home is
  // the Riders tab), an admin is a team member (Staff tab). Neither has
  // "orders placed" nor "money spent" — those columns only ever made
  // sense for the people who actually buy the service.
  const customers = (users ?? []).filter((u) => u.role === 'B2C' || u.role === 'B2B')

  // ----- Phase 60: retention intelligence -----
  // Every customer's health is computed from their own order rhythm
  // (cadence, recency, value), and VIP is a cohort call — the top decile of
  // lifetime value among customers with delivered orders. One pass, memo'd;
  // re-computes as the orders poll refreshes. Task 88: lifetime value now
  // INCLUDES confirmed plan payments (membershipSpend below) — a paying
  // member is by definition one of the most valuable people in the book.
  const memberSpendByUser = useMemo(() => {
    const m = new Map<string, number>()
    for (const sub of memberships ?? []) {
      m.set(sub.userId, (m.get(sub.userId) ?? 0) + (sub.lifetimePaid ?? 0))
    }
    return m
  }, [memberships])
  const membershipByUser = useMemo(() => {
    const m = new Map<string, { plan: string; status: string; lifetimePaid: number }>()
    // One membership per customer is enforced at the API; when history
    // coexists (e.g. a cancelled row beside a fresh join) the LIVE one is
    // what the CRM should badge, and a cancelled past should not.
    const rank = (s: string) =>
      s === 'ACTIVE' ? 3 : s === 'PAST_DUE' ? 2 : s === 'PENDING_ACTIVATION' ? 1 : 0
    for (const sub of memberships ?? []) {
      const existing = m.get(sub.userId)
      if (!existing || rank(sub.status) > rank(existing.status)) {
        m.set(sub.userId, {
          plan: sub.plan?.name ?? 'Plan',
          status: sub.status,
          lifetimePaid: sub.lifetimePaid ?? 0,
        })
      }
    }
    return m
  }, [memberships])
  const healthById = useMemo(() => {
    const map = new Map<string, CustomerHealth>()
    for (const u of customers) {
      map.set(
        u.id,
        computeCustomerHealth(
          (orders ?? []).filter((o) => o.userId === u.id),
          undefined,
          memberSpendByUser.get(u.id) ?? 0
        )
      )
    }
    return map
  }, [customers, orders, memberSpendByUser])
  const vipSet = useMemo(
    () => vipCustomerIds(customers.map((u) => ({ id: u.id, health: healthById.get(u.id)! }))),
    [customers, healthById]
  )
  const counts = useMemo(() => {
    let vip = 0
    let loyal = 0
    let cooling = 0
    let atrisk = 0
    for (const u of customers) {
      if (vipSet.has(u.id)) vip++
      const h = healthById.get(u.id)
      if (h?.status === 'loyal') loyal++
      else if (h?.status === 'cooling') cooling++
      else if (h?.status === 'atrisk') atrisk++
    }
    return { vip, loyal, cooling, atrisk }
  }, [customers, healthById, vipSet])

  const filtered = customers.filter((u) => {
    if (filter !== 'all' && u.role !== filter) return false
    if (healthFilter !== 'all') {
      if (healthFilter === 'vip' && !vipSet.has(u.id)) return false
      if (healthFilter !== 'vip') {
        const h = healthById.get(u.id)
        if (h?.status !== healthFilter) return false
      }
    }
    if (!search) return true
    const s = search.toLowerCase()
    return (
      u.name.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s) ||
      u.phone.includes(s)
    )
  })

  return (
    <div className="p-4 sm:p-6">
      {/* Task 88 — no heading here on purpose: the page above the tab strip
       * already says "Customers". The old block (a "Customers (CRM)"
       * heading plus a paragraph of internal explanation) read like
       * developer notes pasted into the UI — removed. */}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
          <Input
            placeholder="Search name, email, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="B2C">Retail</TabsTrigger>
            <TabsTrigger value="B2B">Corporate</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Phase 60 — health filter chips: the retention workflow
       * ("who is slipping?") in one tap. */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {([
          ['all', 'All', customers.length, 'bg-navy text-white'],
          ['vip', 'VIP', counts.vip, 'bg-gold-50 text-gold-700 ring-gold-300'],
          ['loyal', 'On rhythm', counts.loyal, 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
          ['cooling', 'Going quiet', counts.cooling, 'bg-amber-50 text-amber-700 ring-amber-200'],
          ['atrisk', 'At risk', counts.atrisk, 'bg-rose-50 text-rose-700 ring-rose-200'],
        ] as const).map(([key, label, count, active]) => (
          <button
            key={key}
            type="button"
            onClick={() => setHealthFilter(key as any)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition',
              healthFilter === key
                ? active
                : 'bg-white text-navy-300 ring-navy-100 hover:text-navy',
              // A category nobody currently matches reads as "ready, empty" —
              // dimmed rather than shouting 0.
              healthFilter !== key && count === 0 && key !== 'all' && 'opacity-40'
            )}
          >
            {label}
            <span className="ml-1 opacity-70">{count}</span>
          </button>
        ))}
      </div>

      {/* Phase 77 (mobile): every column renders and the whole table
       *  scrolls horizontally — the phone swipe the owner asked for — instead
       *  of columns silently vanishing behind hidden md:table-cell classes. */}
      <div className="nav-scroll overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[900px] whitespace-nowrap text-sm">
          <thead className="bg-linen-200 text-left text-xs uppercase tracking-wide text-navy-300">
            <tr>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2 text-center">Orders</th>
              <th className="px-4 py-2">Health</th>
              <th className="px-4 py-2">Last order</th>
              <th className="px-4 py-2">Total Spent</th>
              <th className="px-4 py-2">Since</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const userOrders = (orders ?? []).filter((o) => o.userId === u.id)
              const health = healthById.get(u.id)
              const isVip = vipSet.has(u.id)
              const isNew = isNewCustomer(u.createdAt)
              return (
                <tr
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className={cn(
                    'cursor-pointer border-b transition last:border-0 hover:bg-linen-200',
                    isNew && 'bg-gold-50/60'
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                          u.role === 'B2B'
                            ? 'bg-indigo-100 text-indigo-700'
                            : u.role === 'DRIVER'
                            ? 'bg-amber-100 text-amber-700'
                            : u.role === 'ADMIN'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-gold-100 text-navy'
                        )}
                      >
                        {u.role === 'B2B' ? (
                          <Building2 className="h-3.5 w-3.5" />
                        ) : u.role === 'DRIVER' ? (
                          <Truck className="h-3.5 w-3.5" />
                        ) : (
                          u.name.split(' ').map((p) => p[0]).slice(0, 2).join('')
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate font-medium text-navy">
                          {u.name}
                          {membershipByUser.get(u.id) && (
                            <span
                              title={`${membershipByUser.get(u.id)!.plan} member — plan payments are counted in Total Spent`}
                              className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-navy px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white"
                            >
                              <Crown className="h-2.5 w-2.5" /> member
                            </span>
                          )}
                          {isVip && (
                            <span
                              title="VIP — top 10% of lifetime value"
                              className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-gold-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-gold-700 ring-1 ring-gold-300"
                            >
                              <Award className="h-2.5 w-2.5" /> VIP
                            </span>
                          )}
                          {/* NEW badge — recent signups stand out so the owner
                              can personally welcome fresh customers (and spot
                              duplicate/junk entries fast). */}
                          {isNew && (
                            <span className="inline-flex shrink-0 items-center rounded-full bg-gold-400 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-navy">
                              new
                            </span>
                          )}
                          {!u.emailVerified && (
                            <span
                              title="Email not verified — the verification email may never have arrived"
                              className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-rose-50 px-1.5 py-px text-[9px] font-semibold text-rose-600 ring-1 ring-rose-200"
                            >
                              <MailX className="h-2.5 w-2.5" /> unverified
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-navy-300">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3">
                    {/* Contact = phone. The email already sits under the
                     * customer's name one column over — repeating it here was
                     * the same fact twice per row. */}
                    <p className="text-xs text-navy">{u.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-navy">{userOrders.length}</span>
                  </td>
                  <td className="px-4 py-3">
                    {health ? <HealthChip health={health} /> : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-navy-300">
                    {health?.lastDeliveredAt
                      ? sinceLabel(Date.now() - new Date(health.lastDeliveredAt).getTime())
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-navy-300">{formatNaira(health?.ltv ?? 0)}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-navy-300">
                    {formatDate(u.createdAt)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-10 text-center text-sm text-navy-300">
            No customers match your search.
          </div>
        )}
        {hasMore && (
          <div className="flex items-center justify-center gap-3 border-t bg-linen-100 px-4 py-3">
            <p className="text-xs text-navy-300">
              Showing {filtered.length} loaded — more records available.
            </p>
            <button
              onClick={() => loadMore()}
              disabled={isFetchingMore}
              className="rounded-full border border-navy-200 px-4 py-1.5 text-xs font-semibold text-navy transition hover:border-gold-300 hover:text-navy disabled:opacity-50"
            >
              {isFetchingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>

      {selected && (
        <CustomerDetailModal
          user={selected}
          orderCount={(orders ?? []).filter((o) => o.userId === selected.id).length}
          health={healthById.get(selected.id)}
          isVip={vipSet.has(selected.id)}
          membership={membershipByUser.get(selected.id)}
          onClose={() => setSelected(undefined)}
        />
      )}
    </div>
  )
}

function RoleBadge({ role }: { role: any }) {
  if (role === 'ADMIN') {
    return <Badge className="rounded-full bg-rose-100 text-rose-700 hover:bg-rose-100">Admin</Badge>
  }
  if (role === 'DRIVER') {
    return <Badge className="rounded-full bg-amber-100 text-amber-700 hover:bg-amber-100">Driver</Badge>
  }
  if (role === 'B2B') {
    return <Badge className="rounded-full bg-indigo-100 text-indigo-700 hover:bg-indigo-100">Corporate</Badge>
  }
  return <Badge className="rounded-full bg-gold-100 text-navy hover:bg-gold-100">Retail</Badge>
}

function CustomerDetailModal({
  user,
  orderCount,
  health,
  isVip,
  membership,
  onClose,
}: {
  user: any
  orderCount: number
  health?: CustomerHealth
  isVip?: boolean
  membership?: { plan: string; status: string; lifetimePaid: number }
  onClose: () => void
}) {
  // Phase 31: staff browse the CRM but the destructive delete is
  // admin-only (the API enforces this too — hide the button so a staff
  // member never sees an action that would just 403).
  const { data: session } = useSession()
  const isManager = (session?.user as any)?.role === 'ADMIN'
  // fetchAll: the modal computes this customer's LTV/order counts over the
  // whole order history, not just the first page.
  const allOrders = useOrders({ fetchAll: true }).data ?? []
  const orders = useMemo(
    () => allOrders.filter((o) => o.userId === user.id),
    [allOrders, user.id]
  )
  const activeCount = orders.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status)).length
  const reviewCount = 0 // reviews ride along with orders server-side; shown via the warning copy

  // ----- Delete flow -----
  const deleteMutation = useDeleteUser()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const handleDelete = () => {
    if (confirmText.trim().toUpperCase() !== 'DELETE') return
    deleteMutation.mutate(
      { id: user.id, confirm: 'DELETE' },
      {
        onSuccess: (data) => {
          const bits = [
            `${data.deleted.orders} order${data.deleted.orders === 1 ? '' : 's'}`,
            ...(data.deleted.memberships
              ? [`${data.deleted.memberships} membership${data.deleted.memberships === 1 ? '' : 's'}`]
              : []),
          ]
          toast({
            title: 'Customer deleted',
            description: `${user.name} and ${bits.join(', ')} were permanently removed.`,
            variant: 'destructive',
          })
          setConfirmOpen(false)
          onClose()
        },
        onError: (e: any) =>
          toast({
            title: 'Deletion failed',
            description: e?.message || 'Nothing was removed — please try again.',
            variant: 'destructive',
          }),
      }
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {user.name}
            <RoleBadge role={user.role} />
            {isVip && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-gold-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-gold-700 ring-1 ring-gold-300">
                <Award className="h-2.5 w-2.5" /> VIP
              </span>
            )}
            {isNewCustomer(user.createdAt) && (
              <span className="inline-flex items-center rounded-full bg-gold-400 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-navy">
                new
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Joined {formatDate(user.createdAt)}
            {!user.emailVerified && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-rose-50 px-1.5 py-px text-[10px] font-semibold text-rose-600 ring-1 ring-rose-200">
                <MailX className="h-2.5 w-2.5" /> email unverified
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-navy-100">
              <CardContent className="p-4">
                <p className="text-xs text-navy-300">Total orders</p>
                <p className="text-2xl font-bold text-navy">{orders.length}</p>
              </CardContent>
            </Card>
            <Card className="border-navy-100">
              <CardContent className="p-4">
                <p className="text-xs text-navy-300">Active</p>
                <p className="text-2xl font-bold text-navy">{activeCount}</p>
              </CardContent>
            </Card>
            <Card className="border-navy-100">
              <CardContent className="p-4">
                <p className="text-xs text-navy-300">Total spent</p>
                {/* Task 88: members' laundry orders are zero-naira by design —
                    their plan payments join here so a loyal member finally
                    reads as the high-value customer they are. */}
                <p className="text-xl font-bold text-navy-300">
                  {formatNaira(
                    health?.ltv ??
                      orders.reduce((s, o) => s + (o.totalPrice ?? 0), 0) + (membership?.lifetimePaid ?? 0)
                  )}
                </p>
                {membership && membership.lifetimePaid > 0 && (
                  <p className="mt-0.5 text-[10px] text-navy-300/80">
                    incl. {formatNaira(membership.lifetimePaid)} in membership payments
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Phase 60 — the relationship, read against their own rhythm. */}
          {health && (
            <div className="rounded-lg border border-navy-100 bg-linen-100 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-navy">
                <HeartPulse className="h-4 w-4 text-gold-500" /> Relationship
                {isVip && (
                  <span className="ml-1 rounded-full bg-gold-50 px-2 py-px text-[10px] font-bold uppercase tracking-wide text-gold-700 ring-1 ring-gold-300">
                    VIP
                  </span>
                )}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-navy-300">{health.sentence}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div>
                  <p className="text-navy-300/80">Delivered</p>
                  <p className="font-semibold text-navy">{health.deliveredCount}</p>
                </div>
                <div>
                  <p className="text-navy-300/80">Avg order</p>
                  <p className="font-semibold text-navy">{health.aov ? formatNaira(health.aov) : '—'}</p>
                </div>
                <div>
                  <p className="text-navy-300/80">Their rhythm</p>
                  <p className="font-semibold text-navy">
                    {health.cadenceDays ? `every ~${health.cadenceDays}d` : 'still forming'}
                  </p>
                </div>
                <div>
                  <p className="text-navy-300/80">Last order</p>
                  <p className="font-semibold text-navy">
                    {health.daysSinceLastOrder !== null ? `${health.daysSinceLastOrder}d ago` : '—'}
                  </p>
                </div>
              </div>
              {health.churnRisk !== null && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] font-medium text-navy-300">
                    <span>Quietness risk</span>
                    <span className={cn(
                      'font-bold',
                      health.churnRisk >= 45 ? 'text-rose-600' : health.churnRisk >= 15 ? 'text-amber-600' : 'text-emerald-600'
                    )}>
                      {health.churnRisk}/100
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-navy-100">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        health.churnRisk >= 45 ? 'bg-rose-400' : health.churnRisk >= 15 ? 'bg-amber-400' : 'bg-emerald-400'
                      )}
                      style={{ width: `${Math.max(3, health.churnRisk)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-linen-200 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-navy">
                <Mail className="h-3.5 w-3.5" /> Email
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-navy-300">
                {user.email}
                {user.emailVerified ? (
                  <MailCheck className="h-3 w-3 text-emerald-600" aria-label="verified" />
                ) : (
                  <MailX className="h-3 w-3 text-rose-500" aria-label="unverified" />
                )}
              </p>
            </div>
            <div className="rounded-lg bg-linen-200 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-navy">
                <Phone className="h-3.5 w-3.5" /> Phone
              </p>
              <p className="mt-1 text-navy-300">{user.phone}</p>
            </div>
            {membership && (
              <div className="rounded-lg bg-linen-200 p-3 text-sm sm:col-span-2">
                <p className="flex items-center gap-1.5 font-medium text-navy">
                  <Crown className="h-3.5 w-3.5 text-gold-500" /> Membership
                </p>
                <p className="mt-1 text-navy-300">
                  {membership.plan}
                  {membership.status === 'ACTIVE' ? ' — active' : membership.status === 'PENDING_ACTIVATION' ? ' — awaiting payment confirmation' : ''}
                  {membership.lifetimePaid > 0 && ` · ${formatNaira(membership.lifetimePaid)} paid to date`}
                </p>
              </div>
            )}
            {user.address && (
              <div className="rounded-lg bg-linen-200 p-3 text-sm sm:col-span-2">
                <p className="flex items-center gap-1.5 font-medium text-navy">
                  <MapPin className="h-3.5 w-3.5" /> Address
                </p>
                <p className="mt-1 text-navy-300">{user.address}</p>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-navy">Order history</h3>
            {orders.length === 0 ? (
              <p className="text-sm text-navy-300">No orders yet.</p>
            ) : (
              <ul className="space-y-2">
                {orders.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between rounded-lg border bg-white p-3 text-sm"
                  >
                    <div>
                      <p className="font-mono text-xs font-semibold text-navy">
                        #{o.orderNumber}
                      </p>
                      <p className="text-xs text-navy-300">
                        <Calendar className="mr-1 inline h-3 w-3" />
                        {formatDate(o.pickupDate)} ·{' '}
                        {o.type === 'ITEM' ? (() => { try { return JSON.parse(o.itemsManifest || '[]').length + ' items' } catch { return 'items' } })() : 'Bulk'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {o.guaranteeActive && (
                        <Shield className="h-3.5 w-3.5 text-gold-400" />
                      )}
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        {o.status.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                      {o.totalPrice !== null && o.totalPrice !== undefined && (
                        <span className="font-semibold text-navy">
                          {formatNaira(o.totalPrice)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ----- Danger zone (client-requested): permanent deletion ----- */}
          {user.role !== 'ADMIN' && isManager && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-800">
                <AlertTriangle className="h-4 w-4" /> Danger zone
              </p>
              <p className="mt-1 text-xs leading-relaxed text-rose-700">
                Permanently delete this customer — for duplicate or junk entries (e.g. a
                re-registration after a mistyped email). This removes{' '}
                <strong>their entire history</strong>: {orders.length} order
                {orders.length === 1 ? '' : 's'}, payment records, receipts, reviews, their
                membership(s) and usage history, and all stats attached to them.{' '}
                <strong>It cannot be undone.</strong>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setConfirmOpen(true); setConfirmText('') }}
                className="mt-3 border-rose-300 text-rose-700 hover:bg-rose-100"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete customer
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Second-guess dialog: type DELETE to unlock the button. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-800">
              <AlertTriangle className="h-5 w-5" /> Delete {user.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              This will <strong>permanently erase</strong> {user.name} ({user.email}) along
              with <strong>all {orders.length} of their order{orders.length === 1 ? '' : 's'}</strong>,
              payment records and receipts, reviews, any membership they hold, and every stat
              attached to this account. <strong>This action cannot be undone or recovered.</strong>
              <br />
              <br />
              If this entry is a duplicate (the customer re-registered), make sure you are
              deleting the wrong one — not the account with the real order history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <p className="text-xs font-medium text-navy-300">
              Type <span className="font-mono font-bold text-rose-700">DELETE</span> to confirm:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmText.trim().toUpperCase() !== 'DELETE' || deleteMutation.isPending}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {deleteMutation.isPending ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
