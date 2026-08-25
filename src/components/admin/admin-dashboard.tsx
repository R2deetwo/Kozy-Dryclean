'use client'

import { useState, useMemo } from 'react'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  KanbanSquare,
  CreditCard,
  Users as UsersIcon,
  Wallet,
  Bell,
  Search,
  Activity,
  TrendingUp,
  Truck,
  Sparkles,
  RotateCcw,
  Settings,
  LogOut,
} from 'lucide-react'
import { useOrders, usePayments, useUsers } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { KanbanBoard } from './kanban-board'
import { PaymentQueue } from './payment-queue'
import { CustomersView } from './customers-view'
import { FinanceView } from './finance-view'
import { NotificationsPanel } from './notifications-panel'
import { SettingsView } from './settings-view'
import { Logo } from '@/components/shell/logo'

type Tab = 'overview' | 'kanban' | 'payments' | 'customers' | 'finance' | 'notifications' | 'settings'

export function AdminDashboard() {
  const admin = { name: 'Admin', email: 'admin@kozy.ng' }
  const { data: orders } = useOrders()
  const { data: payments } = usePayments()
  const notifications: any[] = []
  const resetDemo = () => alert('Reset not available in production mode')
  const [tab, setTab] = useState<Tab>('overview')

  const pendingPayments = (payments ?? []).filter((p) => p.status === 'PENDING')
  const activeOrders = (orders ?? []).filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status))
  const todayRevenue = (orders ?? [])
    .filter((o) => o.totalPrice !== undefined)
    .reduce((sum, o) => sum + (o.totalPrice ?? 0), 0)

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
    { key: 'notifications', label: 'Notifications', icon: Bell, badge: notifications.length },
    { key: 'settings', label: 'Settings', icon: Settings },
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
            <p className="text-xs text-navy-300">{admin.email}</p>
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
          <div className="border-t border-navy-500 p-3 space-y-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetDemo}
              className="w-full justify-start text-xs text-navy-300 hover:bg-navy-500 hover:text-white"
            >
              <RotateCcw className="mr-2 h-3 w-3" /> Reset demo data
            </Button>
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
                      : 'bg-linen-200 dark:bg-navy-700 text-navy-300 dark:text-navy-200'
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

        {/* Top bar (desktop) */}
        <header className="hidden items-center justify-between border-b bg-white px-6 py-3 lg:flex">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300 dark:text-navy-200" />
            <Input
              placeholder="Search orders, customers, IDs…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTab('notifications')}
              className="relative"
            >
              <Bell className="h-4 w-4" />
              {notifications.length > 0 && (
                <span className="absolute right-1 top-1 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                </span>
              )}
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-semibold text-gold-400">
                {admin.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
              </div>
              <div className="leading-tight">
                <p className="text-xs font-medium text-navy dark:text-white">{admin.name}</p>
                <p className="text-[10px] text-navy-300 dark:text-navy-200">Super Admin</p>
              </div>
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
          {tab === 'notifications' && <NotificationsPanel />}
          {tab === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  )
}

function Overview({ onGoto }: { onGoto: (t: Tab) => void }) {
  const { data: orders } = useOrders()
  const { data: payments } = usePayments()
  const { data: allUsers } = useUsers()
  const customers = useMemo(
    () => (allUsers ?? []).filter((u) => u.role === 'B2C' || u.role === 'B2B'),
    [allUsers]
  )
  const notifications: any[] = []

  const pendingPayments = (payments ?? []).filter((p) => p.status === 'PENDING')
  const activeOrders = (orders ?? []).filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status))
  const revenue = (orders ?? [])
    .filter((o) => o.totalPrice !== undefined && o.status === 'DELIVERED')
    .reduce((s, o) => s + (o.totalPrice ?? 0), 0)
  const expectedRevenue = (orders ?? [])
    .filter((o) => o.totalPrice !== undefined)
    .reduce((s, o) => s + (o.totalPrice ?? 0), 0)

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
          delta="+3 today"
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
          label="Revenue (verified)"
          value={`₦${revenue.toLocaleString('en-NG')}`}
          delta={`₦${expectedRevenue.toLocaleString('en-NG')} pipeline`}
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
          title="Notifications log"
          desc={`${notifications.length} notifications dispatched across SMS, email & in-app`}
          cta="View log"
          icon={Bell}
          onClick={() => onGoto('notifications')}
        />
      </div>

      {/* Recent activity */}
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <RecentOrdersCard />
        <RecentNotificationsCard />
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
        tone === 'amber' ? 'border-amber-200' : 'border-navy-100 dark:border-navy-600'
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-navy-300 dark:text-navy-200">
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
      <p className="text-2xl font-bold text-navy dark:text-white">{value}</p>
      {delta && (
        <p className={cn('text-xs', tone === 'amber' ? 'text-amber-700' : 'text-navy-300 dark:text-navy-200')}>
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
        <p className="text-sm font-semibold text-navy dark:text-white">{title}</p>
        <p className="mt-1 text-xs text-navy-300 dark:text-navy-200">{desc}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-navy-300 group-hover:underline">
          {cta} →
        </span>
      </div>
    </button>
  )
}

function RecentOrdersCard() {
  const { data: allOrders } = useOrders()
  const orders = useMemo(() => (allOrders ?? []).slice(0, 5), [allOrders])
  const { data: users } = useUsers()
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-navy dark:text-white">Recent orders</h3>
        <Truck className="h-4 w-4 text-navy-300 dark:text-navy-200" />
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
                <p className="font-mono text-xs font-semibold text-navy dark:text-white">
                  #{o.orderNumber}
                </p>
                <p className="text-xs text-navy-300 dark:text-navy-200">{u?.name}</p>
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

function RecentNotificationsCard() {
  const allNotifications: any[] = []
  const notifications = useMemo(() => allNotifications.slice(0, 5), [allNotifications])
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-navy dark:text-white">Recent notifications</h3>
        <Sparkles className="h-4 w-4 text-gold-400" />
      </div>
      <ul className="space-y-2 text-sm">
        {notifications.map((n) => (
          <li key={n.id} className="border-b last:border-0">
            <div className="flex items-center justify-between py-1.5">
              <Badge variant="outline" className="rounded-full text-[10px]">
                {n.channel}
              </Badge>
              <span className="text-[10px] text-navy-300 dark:text-navy-200">
                {new Date(n.sentAt).toLocaleString('en-NG', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
            </div>
            <p className="py-1 text-xs text-navy-300 dark:text-navy-200">{n.body}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
