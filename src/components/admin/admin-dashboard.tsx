'use client'

import { useState, useMemo } from 'react'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  KanbanSquare,
  CreditCard,
  Users as UsersIcon,
  Wallet,
  Search,
  Activity,
  TrendingUp,
  Truck,
  Settings,
  LifeBuoy,
  LogOut,
} from 'lucide-react'
import { useOrders, usePayments, useUsers } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KanbanBoard } from './kanban-board'
import { PaymentQueue } from './payment-queue'
import { CustomersView } from './customers-view'
import { FinanceView } from './finance-view'
import { SettingsView } from './settings-view'
import { ReviewsView } from './reviews-view'
import { FeedbackView } from './feedback-view'
import { HelpView } from './help-view'
import { Logo } from '@/components/shell/logo'
import { Star, MessageSquareHeart } from 'lucide-react'

type Tab = 'overview' | 'kanban' | 'payments' | 'customers' | 'finance' | 'reviews' | 'feedback' | 'settings' | 'help'

export function AdminDashboard() {
  // Real signed-in identity (the old header hardcoded a fake
  // "admin@kozy.ng" account that doesn't exist — audit finding).
  const { data: session } = useSession()
  const admin = {
    name: session?.user?.name || 'Admin',
    email: session?.user?.email || '',
  }
  // fetchAll: sidebar badges (active orders, pending payments) are counts over
  // the whole collections — the hooks page through the cursor API for them.
  const { data: orders } = useOrders({ fetchAll: true })
  const { data: payments } = usePayments({ fetchAll: true })
  const [tab, setTab] = useState<Tab>('overview')

  const pendingPayments = (payments ?? []).filter((p) => p.status === 'PENDING')
  const activeOrders = (orders ?? []).filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status))

  const nav: { key: Tab; label: string; icon: any; badge?: number }[] = [
    { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'kanban', label: 'Orders', icon: KanbanSquare, badge: activeOrders.length },
    {
      key: 'payments',
      label: 'Verify Payments',
      icon: CreditCard,
      badge: pendingPayments.length,
    },
    { key: 'customers', label: 'Customers', icon: UsersIcon },
    { key: 'finance', label: 'Finances', icon: Wallet },
    { key: 'reviews', label: 'Reviews', icon: Star },
    { key: 'feedback', label: 'Feedback', icon: MessageSquareHeart },
    { key: 'settings', label: 'Settings', icon: Settings },
    { key: 'help', label: 'Help', icon: LifeBuoy },
  ]

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] bg-linen-200">
      {/* Sidebar — Kozy midnight navy */}
      <aside className="sticky top-[3.5rem] hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 bg-navy text-navy-100 lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-navy-500 px-4 py-4">
            <div className="mb-3">
              <Logo size="sm" subtitle="Atelier Console" variant="dark" />
            </div>
            <p className="font-serif font-semibold text-white">{admin.name}</p>
            <p className="truncate text-xs text-navy-300">{admin.email}</p>
          </div>
          <nav className="flex-1 space-y-0.5 p-2">
            {nav.map((n) => {
              const Icon = n.icon
              const active = tab === n.key
              return (
                <button
                  key={n.key}
                  onClick={() => setTab(n.key)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                    active
                      ? 'bg-gold-400 text-navy shadow-gold'
                      : 'text-navy-100 hover:bg-navy-500 hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{n.label}</span>
                  {n.badge ? (
                    <Badge
                      className={cn(
                        'rounded-full px-1.5 py-0 text-[10px]',
                        n.key === 'payments'
                          ? 'bg-gold-400 text-navy hover:bg-gold-400'
                          : 'bg-white/15 text-white hover:bg-white/15'
                      )}
                    >
                      {n.badge}
                    </Badge>
                  ) : null}
                </button>
              )
            })}
          </nav>
          <div className="border-t border-navy-500 p-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="w-full justify-start text-xs text-navy-300 hover:bg-rose-600 hover:text-white"
            >
              <LogOut className="mr-2 h-3 w-3" /> Sign out
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile tab bar */}
        <div className="border-b bg-white lg:hidden">
          <div className="flex gap-1 overflow-x-auto px-3 py-2">
            {nav.map((n) => {
              const Icon = n.icon
              const active = tab === n.key
              return (
                <button
                  key={n.key}
                  onClick={() => setTab(n.key)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition',
                    active
                      ? 'bg-navy text-white'
                      : 'bg-linen-200 text-navy-300'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {n.label}
                  {n.badge ? (
                    <span className="ml-1 rounded-full bg-white/20 px-1 text-[10px]">
                      {n.badge}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        {/* Top bar (desktop) — signed-in identity only. The decorative
            search input and the notifications bell were removed: neither
            was wired to anything real (audit finding). */}
        <header className="hidden items-center justify-between border-b bg-white px-6 py-3 lg:flex">
          <div className="flex items-center gap-2 text-sm text-navy-300">
            <Search className="h-4 w-4" />
            <span>Use the tabs below to move between operations</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-semibold text-gold-400">
              {admin.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
            </div>
            <div className="leading-tight">
              <p className="text-xs font-medium text-navy">{admin.name}</p>
              <p className="text-[10px] text-navy-300">Administrator</p>
            </div>
          </div>
        </header>

        {/* Body */}
        <main className="flex-1 overflow-x-hidden">
          {tab === 'overview' && <Overview onGoto={setTab} />}
          {tab === 'kanban' && <KanbanBoard />}
          {tab === 'payments' && <PaymentQueue />}
          {tab === 'customers' && <CustomersView />}
          {tab === 'finance' && <FinanceView />}
          {tab === 'reviews' && <ReviewsView />}
          {tab === 'feedback' && <FeedbackView />}
          {tab === 'settings' && <SettingsView />}
          {tab === 'help' && <HelpView />}
        </main>
      </div>
    </div>
  )
}

function Overview({ onGoto }: { onGoto: (t: Tab) => void }) {
  // fetchAll: overview aggregates (revenue, active orders, customer counts)
  // must see every record — shared cache with the sidebar badges above.
  const { data: orders } = useOrders({ fetchAll: true })
  const { data: payments } = usePayments({ fetchAll: true })
  const { data: allUsers } = useUsers({ fetchAll: true })
  const customers = useMemo(
    () => (allUsers ?? []).filter((u) => u.role === 'B2C' || u.role === 'B2B'),
    [allUsers]
  )

  const pendingPayments = (payments ?? []).filter((p) => p.status === 'PENDING')
  const activeOrders = (orders ?? []).filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status))
  // Collected revenue = VERIFIED payments (money actually in the bank);
  // pipeline = value of orders still in flight. The old tile summed
  // DELIVERED orders' totals — close, but not what "verified" means.
  const collectedRevenue = (payments ?? [])
    .filter((p) => p.status === 'VERIFIED')
    .reduce((s, p) => s + (p.amount ?? 0), 0)
  const pipelineValue = activeOrders.reduce((s, o) => s + (o.totalPrice ?? 0), 0)
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const newToday = (orders ?? []).filter(
    (o) => new Date(o.createdAt) >= startOfToday
  ).length

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-navy">
          Atelier Console
        </h1>
        <p className="mt-1 text-sm text-navy-300">
          Operations overview · {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Active orders"
          value={activeOrders.length}
          delta={newToday > 0 ? `${newToday} new today` : 'No new orders today'}
          icon={Activity}
          tone="emerald"
        />
        <KpiCard
          label="Pending verifications"
          value={pendingPayments.length}
          delta={pendingPayments.length > 0 ? 'Needs attention' : 'All caught up'}
          icon={CreditCard}
          tone={pendingPayments.length > 0 ? 'amber' : 'emerald'}
          onClick={() => onGoto('payments')}
        />
        <KpiCard
          label="Revenue (verified payments)"
          value={`₦${collectedRevenue.toLocaleString('en-NG')}`}
          delta={`₦${pipelineValue.toLocaleString('en-NG')} in pipeline`}
          icon={TrendingUp}
          tone="emerald"
          onClick={() => onGoto('finance')}
        />
        <KpiCard
          label="Total customers"
          value={customers.length}
          delta={`${customers.filter((c) => c.role === 'B2B').length} corporate`}
          icon={UsersIcon}
          tone="emerald"
          onClick={() => onGoto('customers')}
        />
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <QuickActionCard
          title="Payment verification queue"
          desc={`${pendingPayments.length} receipt${pendingPayments.length === 1 ? '' : 's'} waiting for your review`}
          cta="Open queue"
          icon={CreditCard}
          onClick={() => onGoto('payments')}
        />
        <QuickActionCard
          title="Order Kanban"
          desc="Drag-and-drop orders across the pipeline stages"
          cta="Open board"
          icon={KanbanSquare}
          onClick={() => onGoto('kanban')}
        />
        <QuickActionCard
          title="Feedback inbox"
          desc="Complaints, questions and reviews from the feedback form — you get an email the moment one arrives"
          cta="Open inbox"
          icon={MessageSquareHeart}
          onClick={() => onGoto('feedback')}
        />
      </div>

      {/* Recent activity */}
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <RecentOrdersCard />
        <RecentCustomersCard onGoto={onGoto} />
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = 'emerald',
  onClick,
}: {
  label: string
  value: string | number
  delta?: string
  icon: any
  tone?: 'emerald' | 'amber'
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'flex flex-col items-start gap-2 rounded-xl border bg-white p-4 text-left transition',
        onClick ? 'cursor-pointer hover:border-gold-200 hover:shadow-sm' : 'cursor-default',
        tone === 'amber' ? 'border-amber-200' : 'border-navy-100'
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-navy-300">
          {label}
        </span>
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            tone === 'amber'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-gold-100 text-navy'
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-navy">{value}</p>
      {delta && (
        <p className={cn('text-xs', tone === 'amber' ? 'text-amber-700' : 'text-navy-300')}>
          {delta}
        </p>
      )}
    </button>
  )
}

function QuickActionCard({
  title,
  desc,
  cta,
  icon: Icon,
  onClick,
}: {
  title: string
  desc: string
  cta: string
  icon: any
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-3 rounded-xl border bg-white p-4 text-left transition hover:border-gold-200 hover:shadow-sm"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-100 text-navy">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-navy">{title}</p>
        <p className="mt-1 text-xs text-navy-300">{desc}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-navy-300 group-hover:underline">
          {cta} →
        </span>
      </div>
    </button>
  )
}

function RecentOrdersCard() {
  // Only the 5 newest orders are shown, but this shares the ['orders','all']
  // cache with the Overview aggregates — no extra requests, and the user
  // lookup map below needs the full users set anyway.
  const { data: allOrders } = useOrders({ fetchAll: true })
  const orders = useMemo(() => (allOrders ?? []).slice(0, 5), [allOrders])
  const { data: users } = useUsers({ fetchAll: true })
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-navy">Recent orders</h3>
        <Truck className="h-4 w-4 text-navy-300" />
      </div>
      <ul className="space-y-2 text-sm">
        {orders.map((o) => {
          const u = (users ?? []).find((u) => u.id === o.userId) ?? o.user
          return (
            <li
              key={o.id}
              className="flex items-center justify-between gap-2 border-b last:border-0"
            >
              <div className="py-1.5">
                <p className="font-mono text-xs font-semibold text-navy">
                  #{o.orderNumber}
                </p>
                <p className="text-xs text-navy-300">{u?.name}</p>
              </div>
              <Badge variant="outline" className="rounded-full text-[10px]">
                {o.status.replace(/_/g, ' ').toLowerCase()}
              </Badge>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Newest signups — replaces the old "Recent notifications" card, which was
 *  permanently empty (no server notification log exists). Real CRM signal:
 *  who just joined, with the unverified flag the team may need to chase. */
function RecentCustomersCard({ onGoto }: { onGoto: (t: Tab) => void }) {
  const { data: allUsers } = useUsers({ fetchAll: true })
  const recent = useMemo(
    () =>
      (allUsers ?? [])
        .filter((u) => u.role === 'B2C' || u.role === 'B2B')
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [allUsers]
  )
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-navy">Newest customers</h3>
        <button
          onClick={() => onGoto('customers')}
          className="text-xs font-medium text-navy-300 hover:underline"
        >
          Open CRM →
        </button>
      </div>
      <ul className="space-y-2 text-sm">
        {recent.map((u) => (
          <li
            key={u.id}
            className="flex items-center justify-between gap-2 border-b last:border-0"
          >
            <div className="min-w-0 py-1.5">
              <p className="truncate text-xs font-semibold text-navy">{u.name}</p>
              <p className="truncate text-xs text-navy-300">{u.email}</p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'rounded-full text-[10px]',
                !(u as any).emailVerified ? 'border-amber-200 text-amber-700' : 'text-emerald-700'
              )}
            >
              {!(u as any).emailVerified ? 'unverified' : u.role === 'B2B' ? 'corporate' : 'personal'}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  )
}
