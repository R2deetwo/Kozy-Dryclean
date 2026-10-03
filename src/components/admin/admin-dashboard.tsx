'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  KanbanSquare,
  CreditCard,
  Users as UsersIcon,
  Wallet,
  Activity,
  TrendingUp,
  Truck,
  Settings,
  LifeBuoy,
  LogOut,
  Bell,
  Megaphone,
  ChevronRight,
  Crown,
  Handshake,
  MapPin,
  Check,
} from 'lucide-react'
import { useOrders, usePayments, useUsers, useNotificationEvents, useBranches, useAdminMemberships, usePartners, ADMIN_POLL } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { OperationsView } from './operations-view'
import { CustomersPage } from './customers-page'
import { TeamView } from './team-view'
import { MembershipsView } from './memberships-view'
import { PartnersView } from './partners-view'
import { FinanceView } from './finance-view'
import { SettingsView } from './settings-view'
import { NotificationsView } from './notifications-view'
import { MarketingView } from './marketing-view'
import { HelpView } from './help-view'
import { ChangePasswordDialog } from './change-password-dialog'
import { Logo } from '@/components/shell/logo'
import { Star, MessageSquareHeart, KeyRound, UserCog, Bike } from 'lucide-react'

// =============================================================================
// The console shell (phase 62 restructure)
// =============================================================================
// The left rail went from 13 flat rows to 9 grouped ones:
//   Overview · Notifications
//   RUN      → Operations (Pipeline · Payments · Health)
//   GROW     → Customers (Directory · Reviews · Feedback) · Memberships · Growth
//   SCALE    → Partners · Team (Staff · Riders)
//   MANAGE   → Finance · Settings
// plus a global BRANCH SWITCHER (All / Ogombo / Chevron Drive) in the header
// that filters Overview, Operations and Finance. Deep links from
// notifications are remapped from the old tab keys so nothing breaks.

type Tab =
  | 'overview'
  | 'notifications'
  | 'operations'
  | 'customers'
  | 'memberships'
  | 'growth'
  | 'partners'
  | 'team'
  | 'finance'
  | 'settings'
  | 'help'

/** Old linkTab values (pre-restructure) → new { tab, subtab } targets. */
const DEEP_LINK_MAP: Record<string, { tab: Tab; sub?: string }> = {
  overview: { tab: 'overview' },
  kanban: { tab: 'operations', sub: 'pipeline' },
  payments: { tab: 'operations', sub: 'payments' },
  customers: { tab: 'customers', sub: 'directory' },
  reviews: { tab: 'customers', sub: 'reviews' },
  feedback: { tab: 'customers', sub: 'feedback' },
  memberships: { tab: 'memberships' },
  marketing: { tab: 'growth' },
  partners: { tab: 'partners' },
  staff: { tab: 'team', sub: 'staff' },
  riders: { tab: 'team', sub: 'riders' },
  finance: { tab: 'finance' },
  settings: { tab: 'settings' },
  help: { tab: 'help' },
}

// -----------------------------------------------------------------------------
// Task 82 — /admin?tab=<key> on arrival (the email CTAs use it). Old linkTab
// keys are accepted through the same DEEP_LINK_MAP. Applied in an EFFECT
// (not useState init) so the first client render matches the server HTML —
// no hydration mismatch. Enabled only for admins: the email CTA targets are
// admin tabs, and STAFF must stay on their operational side.
// -----------------------------------------------------------------------------
function useAdminDeepTabParam(
  onArrive: (target: { tab: Tab; sub?: string }) => void,
  enabled: boolean
) {
  const applied = useRef(false)
  useEffect(() => {
    // Wait for the session to settle the role (it loads async) — but apply
    // at most once per page visit, so in-app navigation is never fought by
    // a stale URL param.
    if (!enabled || applied.current) return
    applied.current = true
    try {
      const params = new URLSearchParams(window.location.search)
      const key = params.get('tab')
      if (!key) return
      const target = DEEP_LINK_MAP[key]
      // Task 87: apply the SUB-tab too (reviews → the Customers page's
      // Reviews sub-tab, payments → Operations → Payments, …). Before this
      // the hook only set the top tab, so ?tab=reviews landed on the CRM
      // directory instead of the reviews wall.
      if (target) onArrive({ tab: target.tab, sub: target.sub })
    } catch {
      /* no param or malformed URL — stay on the overview */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])
}

export function AdminDashboard() {
  // Real signed-in identity (the old header hardcoded a fake
  // "admin@kozy.ng" account that doesn't exist — audit finding).
  const router = useRouter()
  const { data: session, status } = useSession()
  // Phase 31: the console is shared by ADMIN (everything) and STAFF (the
  // operational side). The ROLE comes from the JWT, but the gate below +
  // the heartbeat keep it honest against the live database.
  const role = (session?.user as any)?.role as string | undefined
  const isAdmin = role === 'ADMIN'
  const isConsoleUser = isAdmin || role === 'STAFF'
  const admin = {
    name: session?.user?.name || (role === 'STAFF' ? 'Staff' : 'Admin'),
    email: session?.user?.email || '',
  }

  // ----- Console gate (phase 31) -----
  // ADMIN and STAFF only. Signed-out visitors go to login; customers and
  // riders are redirected to THEIR portals — the console shell must never
  // render for them, even with empty data. (APIs enforce this too; this
  // gate is for honest UX, not security.)
  useEffect(() => {
    if (status === 'loading' || status === 'authenticated') {
      // fall through to the role check below
    } else if (status === 'unauthenticated') {
      router.replace('/login')
    }
    if (status === 'authenticated' && session && !isConsoleUser) {
      if (role === 'DRIVER') router.replace('/driver')
      else router.replace('/portal')
    }
  }, [status, session, isConsoleUser, role, router])

  // ----- Pause/revoke heartbeat (phase 31) + must-change-password (32) -----
  // /api/users/me reads the DATABASE (not the 30-day JWT). Polling it once a
  // minute means a paused or revoked staff member — or a demoted admin —
  // is signed out of the console within ~60 seconds, without waiting for an
  // API call to 403 first. Server-side, every console API ALSO checks
  // live access, so this is UX polish on top of real enforcement.
  // Phase 32: the same read carries mustChangePassword — set at invite /
  // password-reset — which opens the non-dismissible set-your-own-password
  // dialog (the emailed initial password is a shared secret until rotated).
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  useEffect(() => {
    if (status !== 'authenticated' || !isConsoleUser) return
    const check = async () => {
      try {
        const res = await fetch('/api/users/me', { cache: 'no-store' })
        if (res.status === 401) {
          signOut({ callbackUrl: '/login' })
          return
        }
        if (!res.ok) return // transient error — the APIs still guard us
        const data = await res.json()
        const liveRole = data?.user?.role
        const liveStatus = data?.user?.accessStatus
        if (liveRole !== 'ADMIN' && liveRole !== 'STAFF') {
          signOut({ callbackUrl: '/login' })
        } else if (liveStatus !== 'ACTIVE') {
          signOut({ callbackUrl: '/login' })
        } else {
          setMustChangePassword(Boolean(data?.user?.mustChangePassword))
        }
      } catch {
        // Network blip — ignore; next poll or the API guard will catch it.
      }
    }
    check()
    const timer = setInterval(check, 60_000)
    return () => clearInterval(timer)
  }, [status, isConsoleUser])

  // fetchAll: sidebar badges (active orders, pending payments) are counts over
  // the whole collections — the hooks page through the cursor API for them.
  // LIVE MODE (phase 25): the dashboard polls itself — badges, KPIs and every
  // view sharing these cache keys stay current without a manual refresh.
  // Polling pauses while the tab is in the background and refetches the
  // instant it regains focus.
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
  // Operations feed (phase 24): unread signup/order/payment alerts — the
  // sidebar badge mirrors the owner's email inbox, but guaranteed visible.
  const { data: notifications } = useNotificationEvents({
    refetchInterval: ADMIN_POLL.medium,
    refetchOnWindowFocus: true,
  })
  // Phase 62: branches (the switcher), membership + partner badges.
  const { data: branches } = useBranches({ refetchInterval: ADMIN_POLL.slow })
  const { data: memberships } = useAdminMemberships({ refetchInterval: 60_000 })
  const { data: partnerData } = usePartners({ refetchInterval: 60_000 })

  const [tab, setTab] = useState<Tab>('overview')
  // Sub-tab targets for deep links (operations → payments etc.).
  const [deepSub, setDeepSub] = useState<{ operations?: string; customers?: string; team?: string }>({})
  // Task 82 — an email CTA (/admin?tab=memberships) lands the office straight
  // on the tab that needs them. Applied once, after the console gate has
  // settled the role (admin-only tabs are only honoured for admins).
  useAdminDeepTabParam((t) => {
    setTab(t.tab)
    // The sub-tab lands through the deepSub state (each host page picks its
    // own initial tab up from there — customers/operations/team).
    if (t.sub) {
      const key = t.tab === 'operations' ? 'operations' : t.tab === 'team' ? 'team' : 'customers'
      setDeepSub((prev) => ({ ...prev, [key]: t.sub }))
    }
  }, isAdmin)
  // Phase 62: the global branch switcher. 'ALL' | branch id.
  const [branchFilter, setBranchFilter] = useState<string>('ALL')
  const branchId = branchFilter === 'ALL' ? null : branchFilter
  const activeBranches = (branches ?? []).filter((b) => b.isActive)

  const pendingPayments = (payments ?? []).filter(
    (p) => p.status === 'PENDING' && (!branchId || (p as any).order?.branchId === branchId)
  )
  const activeOrders = (orders ?? []).filter(
    (o) => !['DELIVERED', 'CANCELLED'].includes(o.status) && (!branchId || o.branchId === branchId)
  )
  const unreadNotifications = notifications?.unread ?? 0
  const pendingMemberships = (memberships ?? []).filter((m) => m.status === 'PENDING_ACTIVATION')
  const pendingPartners = (partnerData?.partners ?? []).filter((p) => p.status === 'PENDING')

  /** Notification deep-links arrive as OLD tab keys — remap them. */
  const onDeepGoto = (key: string) => {
    const target = DEEP_LINK_MAP[key] ?? { tab: 'overview' as Tab }
    setTab(target.tab)
    if (target.sub) {
      setDeepSub((d) => ({ ...d, [target.tab]: target.sub }))
    }
  }

  // ----- Mobile tab-row affordance (phase-33) -------------------------------
  // iOS Safari renders no scrollbar on the horizontal tab row, so the user
  // has no signal that more tabs live off the right edge. We track scroll
  // position to toggle edge fades, and centre the active tab when it changes
  // so the current view is always visible without swiping.
  const tabRowRef = useRef<HTMLDivElement | null>(null)
  const activeTabRef = useRef<HTMLButtonElement | null>(null)
  const [tabCanScrollRight, setTabCanScrollRight] = useState(true)
  const [tabScrolled, setTabScrolled] = useState(false)

  const updateTabFades = () => {
    const el = tabRowRef.current
    if (!el) return
    const canRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setTabCanScrollRight(canRight)
    setTabScrolled(el.scrollLeft > 4)
  }

  useEffect(() => {
    updateTabFades()
    // re-check after fonts/content settle (badge counts change row width)
    const t = setTimeout(updateTabFades, 400)
    return () => clearTimeout(t)
  }, [tab, pendingPayments.length, activeOrders.length, unreadNotifications])

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }, [tab])

  // ----- Role-aware navigation (phase 31 + 62 groups) -----
  // STAFF gets the operational side only. Money (Finances), memberships
  // pricing, marketing, partners, business configuration (Settings) and team
  // management itself are ADMIN-only, hidden here AND enforced server-side
  // on every one of those API routes.
  const navGroups: {
    label: string | null
    items: { key: Tab; label: string; icon: any; badge?: number; adminOnly?: boolean }[]
  }[] = [
    {
      label: null,
      items: [
        { key: 'overview', label: 'Overview', icon: LayoutDashboard },
        {
          key: 'notifications',
          label: 'Notifications',
          icon: Bell,
          badge: unreadNotifications,
        },
      ],
    },
    {
      label: 'Run',
      items: [
        { key: 'operations', label: 'Operations', icon: KanbanSquare, badge: activeOrders.length || pendingPayments.length },
      ],
    },
    {
      label: 'Grow',
      items: [
        { key: 'customers', label: 'Customers', icon: UsersIcon },
        {
          key: 'memberships',
          label: 'Memberships',
          icon: Crown,
          adminOnly: true,
          badge: pendingMemberships.length,
        },
        { key: 'growth', label: 'Growth', icon: Megaphone, adminOnly: true },
      ],
    },
    {
      label: 'Scale',
      items: [
        {
          key: 'partners',
          label: 'Partners',
          icon: Handshake,
          adminOnly: true,
          badge: pendingPartners.length,
        },
        { key: 'team', label: 'Team', icon: UserCog, adminOnly: true },
      ],
    },
    {
      label: 'Manage',
      items: [
        { key: 'finance', label: 'Finance', icon: Wallet, adminOnly: true },
        { key: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
      ],
    },
  ]
  const nav = navGroups
    .map((g) => ({ ...g, items: g.items.filter((n) => isAdmin || !n.adminOnly) }))
    .filter((g) => g.items.length > 0)

  // ----- The branch switcher (shared component, rendered in both headers) -----
  const switcher =
    activeBranches.length <= 1 ? null : (
      <BranchSwitcher branches={activeBranches} value={branchFilter} onChange={setBranchFilter} />
    )

  return (
    <div className="flex min-h-screen bg-linen-200">
      {/* Sidebar — Kozy midnight navy.
       * Phase 32 layout fix: no header above the sidebar — it pins to the very
       * top and spans the full viewport height at every scroll position.
       * Phase 62: grouped rows (Run / Grow / Scale / Manage) replace the old
       * 13-item flat list; group labels make the structure legible at a
       * glance instead of overwhelming. */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-navy text-navy-100 lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-navy-500 px-4 py-4">
            <div className="mb-3">
              <Logo size="sm" subtitle="Atelier Console" variant="dark" />
            </div>
            <p className="font-serif font-semibold text-white">{admin.name}</p>
            <p className="truncate text-xs text-navy-300">{admin.email}</p>
            {!isAdmin && (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-gold-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-300">
                <UserCog className="h-3 w-3" /> Staff access
              </p>
            )}
          </div>
          {/* Phase 58 fix: min-h-0 + overflow-y-auto lets the tab list scroll
           * internally so the account section stays pinned at the bottom at
           * every height. */}
          <nav className="min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-width:thin] [scrollbar-color:#1B3A5F_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-navy-500 [&::-webkit-scrollbar-track]:bg-transparent">
            {nav.map((group, gi) => (
              <div key={group.label ?? 'top'} className={gi > 0 ? 'mt-3' : ''}>
                {group.label && (
                  <p className="px-3 pb-1 pt-2 text-[9px] font-bold uppercase tracking-[0.22em] text-navy-400">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((n) => {
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
                              n.key === 'notifications' || n.key === 'memberships' || n.key === 'partners'
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
                </div>
              </div>
            ))}
          </nav>
          {/* Live indicator — makes the auto-refresh visible instead of
           *  something the admin has to trust. */}
          <div className="border-t border-navy-500 px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] text-navy-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>Live — lists update automatically. No refresh needed.</span>
            </div>
          </div>
          <div className="border-t border-navy-500 p-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTab('help')}
              className="w-full justify-start text-xs text-navy-300 hover:bg-navy-500 hover:text-white"
            >
              <LifeBuoy className="mr-2 h-3 w-3" /> Operator guide
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setChangePasswordOpen(true)}
              className="mt-1 w-full justify-start text-xs text-navy-300 hover:bg-navy-500 hover:text-white"
            >
              <KeyRound className="mr-2 h-3 w-3" /> Change password
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="mt-1 w-full justify-start text-xs text-navy-300 hover:bg-rose-600 hover:text-white"
            >
              <LogOut className="mr-2 h-3 w-3" /> Sign out
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile console header + tab row (lg:hidden).
         * Phase-33 fix: sticky header + scrollable tab row with fades.
         * Phase 62: the branch switcher rides along (scrollable, compact). */}
        <div className="sticky top-0 z-40 border-b bg-white lg:hidden">
          <div
            className="flex items-center justify-between gap-2 px-3 pb-1.5 pt-2"
            style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))' }}
          >
            <Logo size="sm" subtitle="Atelier Console" />
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="hidden items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 sm:inline-flex"
                title="Lists update automatically. No refresh needed."
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
              <button
                onClick={() => setChangePasswordOpen(true)}
                aria-label="Change password"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-navy-300 transition hover:bg-linen-200 hover:text-navy"
              >
                <KeyRound className="h-4 w-4" />
              </button>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                aria-label="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-navy-300 transition hover:bg-rose-50 hover:text-rose-600"
              >
                <LogOut className="h-4 w-4" />
              </button>
              <div className="flex min-w-0 items-center gap-1.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-[10px] font-semibold text-gold-400">
                  {admin.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                </div>
                <div className="hidden leading-tight min-[360px]:block">
                  <p className="max-w-[90px] truncate text-[11px] font-medium text-navy">{admin.name}</p>
                  <p className="text-[9px] text-navy-300">{isAdmin ? 'Administrator' : 'Staff'}</p>
                </div>
              </div>
            </div>
          </div>
          {/* Branch switcher (mobile) */}
          <div className="nav-scroll flex gap-1.5 overflow-x-auto px-3 pb-1.5">{switcher}</div>
          <div className="relative">
            <div
              ref={tabRowRef}
              onScroll={updateTabFades}
              className="nav-scroll flex gap-1.5 overflow-x-auto px-3 pb-2.5 pt-1"
            >
              {nav.flatMap((g) => g.items).map((n) => {
                const Icon = n.icon
                const active = tab === n.key
                return (
                  <button
                    key={n.key}
                    ref={active ? activeTabRef : undefined}
                    onClick={() => setTab(n.key)}
                    className={cn(
                      'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition',
                      active
                        ? 'bg-navy text-white shadow-sm'
                        : 'bg-linen-200 text-navy-300'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {n.label}
                    {n.badge ? (
                      <span className="ml-1 rounded-full bg-white/25 px-1.5 text-[10px] leading-4">
                        {n.badge}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
            {/* Scroll affordance — iOS shows no scrollbar on this row. */}
            <div
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-y-0 right-0 flex w-9 items-center justify-end bg-gradient-to-l from-white via-white/85 to-transparent pr-0.5 transition-opacity',
                tabCanScrollRight ? 'opacity-100' : 'opacity-0'
              )}
            >
              <ChevronRight className="h-4 w-4 text-navy-300" />
            </div>
            <div
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent transition-opacity',
                tabScrolled ? 'opacity-100' : 'opacity-0'
              )}
            />
          </div>
        </div>

        {/* Top bar (desktop) — branch switcher + signed-in identity. */}
        <header className="hidden items-center justify-between border-b bg-white px-6 py-3 lg:flex">
          <div className="flex items-center gap-3">
            {switcher}
            <span className="text-xs text-navy-300">
              {branchId
                ? `Scoped to ${activeBranches.find((b) => b.id === branchId)?.name ?? 'branch'} — orders, payments & finance`
                : 'Use the groups on the left to move between operations'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-semibold text-gold-400">
              {admin.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
            </div>
            <div className="leading-tight">
              <p className="text-xs font-medium text-navy">{admin.name}</p>
              <p className="text-[10px] text-navy-300">{isAdmin ? 'Administrator' : 'Staff'}</p>
            </div>
          </div>
        </header>

        {/* Body — admin-only tabs are doubly gated (nav is filtered above,
            and this render check keeps a stale tab state from ever mounting
            a restricted view for a staff session). */}
        <main className="flex-1 overflow-x-hidden">
          {tab === 'overview' && <Overview onGoto={onDeepGoto} isAdmin={isAdmin} branchId={branchId} />}
          {tab === 'notifications' && <NotificationsView onGoto={onDeepGoto} />}
          {tab === 'operations' && (
            <OperationsView
              isAdmin={isAdmin}
              initialTab={(deepSub.operations as any) ?? undefined}
              paymentsPending={pendingPayments.length}
              activeOrders={activeOrders.length}
            />
          )}
          {tab === 'customers' && (
            <CustomersPage
              isAdmin={isAdmin}
              initialTab={(deepSub.customers as any) ?? undefined}
              feedbackNew={0}
            />
          )}
          {isAdmin && tab === 'memberships' && <MembershipsView />}
          {isAdmin && tab === 'growth' && <MarketingView />}
          {isAdmin && tab === 'partners' && <PartnersView />}
          {isAdmin && tab === 'team' && (
            <TeamView initialTab={(deepSub.team as any) ?? undefined} />
          )}
          {isAdmin && tab === 'finance' && <FinanceView branchId={branchId} />}
          {isAdmin && tab === 'settings' && <SettingsView />}
          {tab === 'help' && <HelpView />}
        </main>
      </div>

      {/* Phase 32 — the account still runs on its emailed initial password:
          non-dismissible dialog until the user picks their own. */}
      <ChangePasswordDialog
        open={mustChangePassword || changePasswordOpen}
        forced={mustChangePassword}
        onOpenChange={setChangePasswordOpen}
        onDone={() => setMustChangePassword(false)}
      />
    </div>
  )
}

function Overview({
  onGoto,
  isAdmin,
  branchId,
}: {
  onGoto: (t: string) => void
  isAdmin: boolean
  branchId: string | null
}) {
  // fetchAll: overview aggregates (revenue, active orders, customer counts)
  // must see every record — shared cache with the sidebar badges above.
  // Live mode: same polling as the sidebar so KPIs tick over on their own.
  // Phase 62: the branch switcher filters the operational KPIs (revenue
  // follows payments on the branch's orders; customer count stays global —
  // customers belong to the business, not a branch).
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
  const { data: allUsers } = useUsers({
    fetchAll: true,
    refetchInterval: ADMIN_POLL.slow,
    refetchOnWindowFocus: true,
  })
  const customers = useMemo(
    () => (allUsers ?? []).filter((u) => u.role === 'B2C' || u.role === 'B2B'),
    [allUsers]
  )
  const { data: memberships } = useAdminMemberships({ refetchInterval: 60_000 })

  const scopedOrders = (orders ?? []).filter((o: any) => !branchId || o.branchId === branchId)
  const scopedOrderIds = useMemo(() => new Set(scopedOrders.map((o: any) => o.id)), [scopedOrders])
  const scopedPayments = (payments ?? []).filter(
    (p: any) => !branchId || scopedOrderIds.has(p.orderId)
  )

  const pendingPayments = scopedPayments.filter((p) => p.status === 'PENDING')
  const activeOrders = scopedOrders.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status))
  // Collected revenue = VERIFIED payments (money actually in the bank);
  // pipeline = value of orders still in flight.
  const collectedRevenue = scopedPayments
    .filter((p) => p.status === 'VERIFIED')
    .reduce((s, p) => s + (p.amount ?? 0), 0)
  const pipelineValue = activeOrders.reduce((s, o) => s + (o.totalPrice ?? 0), 0)
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const newToday = scopedOrders.filter((o) => new Date(o.createdAt) >= startOfToday).length
  const activeMembers = (memberships ?? []).filter(
    (m) => m.status === 'ACTIVE' || m.status === 'PENDING_ACTIVATION'
  )
  const mrr = activeMembers
    .filter((m) => m.status === 'ACTIVE')
    .reduce((s, m) => s + (m.plan?.priceMonthly ?? m.pricePaid ?? 0), 0)

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-navy">
          Atelier Console
        </h1>
        <p className="mt-1 text-sm text-navy-300">
          Operations overview · {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
          {branchId && ' · scoped to branch'}
        </p>
      </div>

      {/* KPI tiles — staff get the operational KPIs only; revenue is
          financial reporting, which the client keeps admin-only. */}
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
        {isAdmin && (
          <>
            <KpiCard
              label="Revenue (verified payments)"
              value={`₦${collectedRevenue.toLocaleString('en-NG')}`}
              delta={`₦${pipelineValue.toLocaleString('en-NG')} in pipeline`}
              icon={TrendingUp}
              tone="emerald"
              onClick={() => onGoto('finance')}
            />
            <KpiCard
              label="Circle MRR (memberships)"
              value={`₦${mrr.toLocaleString('en-NG')}`}
              delta={`${activeMembers.length} member${activeMembers.length === 1 ? '' : 's'} · ${activeMembers.filter((m) => m.status === 'PENDING_ACTIVATION').length} awaiting payment`}
              icon={Crown}
              tone="emerald"
              onClick={() => onGoto('memberships')}
            />
          </>
        )}
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
          title="Order pipeline"
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
        <RecentOrdersCard orders={scopedOrders} />
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

function RecentOrdersCard({ orders }: { orders: any[] }) {
  // Only the 5 newest orders are shown; the caller passes the (possibly
  // branch-scoped) list so this card needs no data hooks of its own.
  const recent = orders.slice(0, 5)
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-navy">Recent orders</h3>
        <Truck className="h-4 w-4 text-navy-300" />
      </div>
      <ul className="space-y-2 text-sm">
        {recent.length === 0 && (
          <li className="py-2 text-xs text-navy-300">No orders in this scope yet.</li>
        )}
        {recent.map((o) => (
          <li
            key={o.id}
            className="flex items-center justify-between gap-2 border-b last:border-0"
          >
            <div className="py-1.5">
              <p className="font-mono text-xs font-semibold text-navy">
                #{o.orderNumber}
              </p>
              <p className="text-xs text-navy-300">{o.user?.name}</p>
            </div>
            <Badge variant="outline" className="rounded-full text-[10px]">
              {o.status.replace(/_/g, ' ').toLowerCase()}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Newest signups — real CRM signal: who just joined, with the unverified
 * flag the team may need to chase. */
function RecentCustomersCard({ onGoto }: { onGoto: (t: string) => void }) {
  const { data: allUsers } = useUsers({
    fetchAll: true,
    refetchInterval: ADMIN_POLL.slow,
  })
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

// =====================================================
// BRANCH SWITCHER (phase 62) — the global location scope
// =====================================================
// All / Ogombo / Chevron Drive. Filters Overview, Operations and Finance.
// Declared OUTSIDE the dashboard component (stable identity, no remounts).
function BranchSwitcher({
  branches,
  value,
  onChange,
}: {
  branches: { id: string; name: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-full border border-navy-100 bg-linen-100 p-0.5"
      role="group"
      aria-label="Branch filter"
    >
      <button
        onClick={() => onChange('ALL')}
        className={cn(
          'rounded-full px-2.5 py-1 text-[11px] font-medium transition',
          value === 'ALL' ? 'bg-navy text-white shadow-sm' : 'text-navy-300 hover:text-navy'
        )}
      >
        All
      </button>
      {branches.map((b) => (
        <button
          key={b.id}
          onClick={() => onChange(b.id)}
          className={cn(
            'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition',
            value === b.id ? 'bg-navy text-white shadow-sm' : 'text-navy-300 hover:text-navy'
          )}
        >
          <MapPin className="h-3 w-3" />
          {b.name}
        </button>
      ))}
    </div>
  )
}
