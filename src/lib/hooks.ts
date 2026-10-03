// =============================================================================
// React Query hooks for API data fetching
// =============================================================================
// These replace Zustand selectors. Zustand remains for ephemeral UI state only
// (form drafts, modal open/close, wizard step, theme).
// =============================================================================

import { useEffect } from 'react'
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  type InfiniteData,
} from '@tanstack/react-query'

// -----------------------------------------------------------------------------
// ADMIN LIVE MODE (phase 25) — the admin console auto-refreshes instead of
// waiting for a manual refresh. These intervals drive TanStack Query polling
// across the admin views; queries share cache keys, so one poll serves every
// mounted view. TanStack pauses interval refetches while the tab is hidden
// (refetchIntervalInBackground defaults to false) and refetchOnWindowFocus
// is enabled per-hook below, so switching back to the tab is always instant.
// -----------------------------------------------------------------------------
export const ADMIN_POLL = {
  /** Actively-watched surfaces: kanban board, payment queue. */
  fast: 8_000,
  /** Aggregates & secondary lists: dashboard badges, finance, orders maps. */
  medium: 15_000,
  /** Slow-moving data: CRM users list. */
  slow: 30_000,
} as const


// ----- Types (match API responses) -----
export interface ApiOrder {
  id: string
  orderNumber: string
  userId: string
  driverId: string | null
  status: string
  type: string
  finalWeight: number | null
  totalPrice: number | null
  guaranteeActive: boolean
  serviceSpeed?: string | null
  modeOfWash?: string | null
  promoCode?: string | null
  deliveryFee?: number | null
  itemsManifest: string | null
  pickupAddress: string
  pickupDate: string
  pickupTimeSlot: string
  deliveryAddress: string | null
  deliveryDate: string | null
  pickedUpAt: string | null
  atStationAt: string | null
  processingAt: string | null
  finishingAt: string | null
  outForDeliveryAt: string | null
  deliveredAt: string | null
  createdAt: string
  updatedAt: string
  // Phase 62: routing + fulfillment (plain scalars, resolved client-side).
  branchId?: string | null
  subscriptionId?: string | null
  fulfilledByPartnerId?: string | null
  user?: { id: string; name: string; email: string; phone: string; role: string }
  driver?: { id: string; name: string; phone: string } | null
  payments?: ApiPayment[]
  media?: any[]
  mediaCount?: number
}

export interface ApiPayment {
  id: string
  orderId: string
  amount: number
  method: string
  status: string
  receiptUrl: string | null
  paystackRef: string | null
  verifiedAt: string | null
  verifiedById: string | null
  createdAt: string
  updatedAt: string
  order?: { id: string; orderNumber: string; userId: string; branchId?: string | null }
}

export interface ApiUser {
  id: string
  email: string
  name: string
  phone: string
  role: string
  company: string | null
  address: string | null
  emailVerified: string | null
  createdAt: string
}

// ----- Paginated list hook plumbing -----
// GET /api/{orders,payments,users} are cursor-paginated ({ items, nextCursor }).
// These hooks expose:
//   data       — the ACCUMULATED items across all loaded pages (so existing
//                consumers keep receiving a plain array, exactly as before)
//   hasMore    — true when nextCursor is non-null
//   loadMore() — fetch the next page (wired to "Load more" controls)
//   isFetchingMore — fetch-next-page in flight
//   fetchAll   — auto-load every page up front (bounded, see MAX_PAGES) for
//                views that MUST see the complete collection to be correct:
//                dashboard aggregates, finance totals, lookup maps (e.g.
//                driver-assignment dropdowns, payment→order joins).
// Primary list surfaces (admin kanban, driver route, customer portal, CRM
// table) use plain incremental loading instead.
const PAGE_SIZE = 25
const MAX_PAGES = 50 // hard bound for fetchAll (50 × 100... practically 50 × 25)

interface Page<T> {
  items: T[]
  nextCursor: string | null
}

function usePaginatedList<T>(
  queryKeyBase: string,
  endpoint: string,
  options?: {
    fetchAll?: boolean
    enabled?: boolean
    refetchInterval?: number | false
    staleTime?: number
    refetchOnWindowFocus?: boolean
  }
) {
  const fetchAll = options?.fetchAll ?? false

  const query = useInfiniteQuery<Page<T>>({
    queryKey: [queryKeyBase, fetchAll ? 'all' : 'paged'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
      // pageParam is string | undefined at runtime (initialPageParam and
      // getNextPageParam only ever produce strings) — the single-generic
      // useInfiniteQuery signature just widens it to unknown.
      if (pageParam) params.set('cursor', pageParam as string)
      const res = await fetch(`${endpoint}?${params.toString()}`)
      if (!res.ok) throw new Error(`Failed to fetch ${queryKeyBase}`)
      return (await res.json()) as Page<T>
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: options?.staleTime ?? 10 * 1000,
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval ?? false,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
  })

  // Auto-advance: fetchAll mode pages through everything; in paged mode we
  // also auto-advance past a page that came back EMPTY but has a cursor —
  // this happens for drivers when the whole page was hidden by the geofence.
  const pages = query.data?.pages ?? []
  const lastPage = pages[pages.length - 1]
  const shouldAutoAdvance =
    !!query.data &&
    pages.length < MAX_PAGES &&
    !!lastPage?.nextCursor &&
    (fetchAll || lastPage.items.length === 0)

  useEffect(() => {
    if (shouldAutoAdvance && !query.isFetchingNextPage && !query.isLoading) {
      query.fetchNextPage()
    }
  }, [shouldAutoAdvance, query.isFetchingNextPage, query.isLoading])

  const data = query.data ? query.data.pages.flatMap((p) => p.items) : undefined

  return {
    ...query,
    data,
    hasMore: !!lastPage?.nextCursor && pages.length < MAX_PAGES,
    loadMore: query.fetchNextPage,
    isFetchingMore: query.isFetchingNextPage,
  }
}

// ----- Orders -----
export function useOrders(options?: {
  /** Set false to pause polling (e.g. driver outside the geofence) */
  enabled?: boolean
  /** Live-refresh interval in ms (e.g. 8000 for the admin console) */
  refetchInterval?: number | false
  /** Refetch as soon as the tab regains focus (admin live mode) */
  refetchOnWindowFocus?: boolean
  /** Auto-load every page (aggregates/lookups) instead of incremental */
  fetchAll?: boolean
}) {
  return usePaginatedList<ApiOrder>('orders', '/api/orders', options)
}

export function useOrder(id?: string) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${id}`)
      if (!res.ok) throw new Error('Failed to fetch order')
      const data = await res.json()
      return data.order as ApiOrder
    },
    enabled: !!id,
  })
}

export function useDispatchSuggest(orderId?: string, enabled?: boolean) {
  return useQuery({
    queryKey: ['dispatch-suggest', orderId],
    queryFn: async () => {
      const res = await fetch(`/api/dispatch/suggest?orderId=${orderId}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to build dispatch suggestions')
      }
      return res.json() as Promise<{
        order: { leg: 'PICKUP' | 'DELIVERY'; zone: string | null; slotStart: string; hoursUntilSlot: number }
        context: { zonePickupsToday: number; unassignedInZoneToday: number }
        suggestions: Array<{
          rider: { id: string; name: string; phone: string }
          score: number
          factors: Array<{ kind: string; label: string; text: string; tone: 'good' | 'neutral' | 'warn'; points: number; max: number }>
          flags: string[]
        }>
      }>
    },
    enabled: !!orderId && enabled !== false,
    staleTime: 20_000,
    refetchInterval: ADMIN_POLL.slow,
  })
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: any) => {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create order')
      }
      const data = await res.json()
      return data.order as ApiOrder
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export function useUpdateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Record<string, any>) => {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        // Prefer the human-readable message (e.g. the geofence explanation)
        throw new Error(err.message || err.error || 'Failed to update order')
      }
      const data = await res.json()
      return data.order as ApiOrder
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['orders', data.id] })
    },
  })
}

// ----- Rider dispatch (phase 69) -----
/** The claim pool: unclaimed pickups this rider can take (broadcast lane). */
export function useAvailableOrders(options?: {
  enabled?: boolean
  refetchInterval?: number | false
}) {
  return useQuery({
    queryKey: ['orders', 'available'],
    queryFn: async () => {
      const res = await fetch('/api/orders?available=1')
      if (!res.ok) throw new Error('Failed to fetch available pickups')
      const data = await res.json()
      return (data.items ?? []) as ApiOrder[]
    },
    staleTime: 5 * 1000,
    ...options,
  })
}

/** Claim an available pickup (race-safe server-side; 409 = someone was faster). */
export function useClaimOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim' }),
      })
      const err = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(err.message || err.error || 'Claim failed')
      return err.order as ApiOrder
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

/** Acknowledge an auto-assigned stop — the response-time tap. */
export function useAcknowledgeOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acknowledge' }),
      })
      const err = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(err.message || err.error || 'Failed')
      return err.order as ApiOrder
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

/** The response-time leaderboard (rider app + Team → Riders). */
export interface DriverStatsRow {
  id: string
  name: string
  employmentType: 'FULL_TIME' | 'PART_TIME'
  active: boolean
  assignments: number
  accepted: number
  pendingAck: number
  avgResponseMin: number | null
  claims: number
  rank: number
}
export function useDriverStats(options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ['driver-stats'],
    queryFn: async () => {
      const res = await fetch('/api/driver-stats')
      if (!res.ok) throw new Error('Failed to fetch rider stats')
      const data = await res.json()
      return data as {
        windowDays: number
        board: DriverStatsRow[]
        myIndex: number
        myId: string | null
        teamAvgResponseMin: number | null
      }
    },
    staleTime: 30 * 1000,
    retry: 1,
    ...options,
  })
}

// ----- Payments -----
export function usePayments(options?: {
  fetchAll?: boolean
  enabled?: boolean
  /** Live-refresh interval in ms (e.g. 8000 for the payment queue) */
  refetchInterval?: number | false
  refetchOnWindowFocus?: boolean
}) {
  return usePaginatedList<ApiPayment>('payments', '/api/payments', options)
}

export function useCreatePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: any) => {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create payment')
      }
      const data = await res.json()
      return data.payment as ApiPayment
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

/** Patch a fresh order object straight into every cached orders list so the
 *  Kanban card, its indicators and any open detail modal update in the same
 *  tick as the admin action — the invalidation that follows reconciles
 *  against the server. Shared by payment verify/reject AND payment removal. */
function patchOrderIntoCache(qc: ReturnType<typeof useQueryClient>, order: ApiOrder) {
  for (const key of ['paged', 'all']) {
    qc.setQueryData<InfiniteData<Page<ApiOrder>>>(['orders', key], (existing) => {
      if (!existing) return existing
      return {
        ...existing,
        pages: existing.pages.map((page) => ({
          ...page,
          items: page.items.map((o) => (o.id === order.id ? order : o)),
        })),
      }
    })
  }
}

export function useVerifyPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: 'VERIFIED' | 'REJECTED'
    }) => {
      const res = await fetch(`/api/payments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update payment')
      }
      const data = await res.json()
      // The API returns { payment, order } — the fresh order lets the caller
      // update the board/modal instantly instead of waiting for a refetch.
      return data as { payment: ApiPayment; order?: ApiOrder; noOp?: boolean }
    },
    onSuccess: (data) => {
      // Patch the fresh order straight into every cached orders list so the
      // Kanban card, its indicators and any open detail modal update in the
      // same tick as the click — the invalidation below then reconciles
      // against the server.
      if (data.order) patchOrderIntoCache(qc, data.order)
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

// ----- Payment removal (phase 25) -----
// Removes a REJECTED (or still-PENDING) bank-transfer claim from the
// verification queue entirely. The API also returns the fresh order (it may
// have reverted to REQUESTED when its last open claim was removed) so the
// board updates in the same tick.
export function useDeletePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to remove payment')
      }
      return (await res.json()) as { ok: true; order?: ApiOrder }
    },
    onSuccess: (data) => {
      if (data.order) patchOrderIntoCache(qc, data.order)
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

// ----- Users (admin-only) -----
export function useUsers(options?: {
  fetchAll?: boolean
  refetchInterval?: number | false
  refetchOnWindowFocus?: boolean
}) {
  return usePaginatedList<ApiUser>('users', '/api/users', {
    staleTime: 30 * 1000,
    ...options,
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      confirm,
    }: {
      id: string
      confirm: string // must be 'DELETE' — the API double-checks it
    }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || err.message || 'Failed to delete customer')
      }
      return (await res.json()) as {
        ok: true
        deleted: { orders: number; reviews: number; payments: number; memberships: number }
      }
    },
    onSuccess: () => {
      // The CRM list, the orders board and any open customer stats all need
      // to forget this person immediately.
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      // Task 82: a deleted member's roster row must vanish too.
      qc.invalidateQueries({ queryKey: ['admin-memberships'] })
    },
  })
}

// ----- Staff management (phase 31, ADMIN only) -----
export interface ApiStaff {
  id: string
  email: string
  name: string
  phone: string
  role: 'STAFF'
  accessStatus: 'ACTIVE' | 'PAUSED' | 'REVOKED'
  emailVerified: string | null
  createdAt: string
  updatedAt: string
}

export function useStaff(options?: {
  refetchInterval?: number | false
  refetchOnWindowFocus?: boolean
}) {
  return useQuery<ApiStaff[]>({
    queryKey: ['staff'],
    queryFn: async () => {
      const res = await fetch('/api/staff')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to load staff list')
      }
      const data = await res.json()
      return data.items as ApiStaff[]
    },
    staleTime: 30 * 1000,
    ...options,
  })
}

export function useCreateStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      // Phase 32: the SERVER generates the password — the admin never
      // types, sees or transmits one.
      name: string
      email: string
      phone: string
      note?: string
    }) => {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to create staff account')
      }
      return data as {
        staff: ApiStaff
        invite: { ok: boolean; error: string | null }
        hint?: string
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] })
      // The invite logs a STAFF_INVITE event into the operations feed.
      qc.invalidateQueries({ queryKey: ['admin-notifications'] })
    },
  })
}

export function useUpdateStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      name?: string
      phone?: string
      accessStatus?: 'ACTIVE' | 'PAUSED' | 'REVOKED'
      // Phase 32: ask the server to generate + email a new password
      // (admin-typed passwords are gone by client directive).
      resetPassword?: boolean
    }) => {
      const { id, ...patch } = input
      const res = await fetch(`/api/staff/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to update staff account')
      }
      return data as {
        staff: ApiStaff
        email: { ok: boolean; error: string | null } | null
        hint?: string
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] })
      qc.invalidateQueries({ queryKey: ['admin-notifications'] })
    },
  })
}


// ----- Rider onboarding (phase 54) -----
export interface ApiRiderApplication {
  id: string
  refCode: string | null
  fullName: string
  email: string | null
  phone: string
  altPhone: string | null
  address: string
  lga: string
  bikeModel: string
  bikeYear: string
  licenseNumber: string
  availability: string
  experience: string | null
  consent: boolean
  status: 'PENDING' | 'REVIEWED' | 'APPROVED' | 'REJECTED'
  user: { id: string; name: string; email: string; phone: string; accessStatus: string } | null
  reviewedBy: { id: string; name: string } | null
  reviewedAt: string | null
  decisionNote: string | null
  createdAt: string
}

export interface ApiRiderRosterEntry {
  id: string
  name: string
  email: string
  phone: string
  accessStatus: 'ACTIVE' | 'PAUSED' | 'REVOKED'
  joinedAt: string
  lastPingAt: string | null
  lastZone: string | null
  openAssignments: number
  deliveriesCompleted: number
  /** Stops completed today (Lagos day): pickups made + deliveries made. */
  todayCompleted: number
  /** Unresolved rider-reported incidents — the owner's watch list. */
  unresolvedIncidents: number
  /** Phase 72 — the payout desk columns. */
  ratesPublished: boolean
  earnedTotal: number
  paidTotal: number
  pendingPayout: number
  lastPayoutAt: string | null
  bankOnFile: boolean
  bank: { bankName: string; bankAccountNumber: string; bankAccountName: string } | null
}

/** A rider-reported incident on an order (phase 55). */
export interface ApiRiderIncident {
  id: string
  kind: 'DAMAGE' | 'LOSS' | 'THEFT' | 'ACCIDENT' | 'OTHER' | string
  description: string
  atStop: string | null
  createdAt: string
  resolvedAt: string | null
  resolution: string | null
  orderNumber: string
  orderId: string
  riderId: string
  riderName: string
  riderPhone: string
}

export function useRiderApplications(options?: {
  refetchInterval?: number | false
  refetchOnWindowFocus?: boolean
}) {
  return useQuery<{
    applications: ApiRiderApplication[]
    roster: ApiRiderRosterEntry[]
    incidents: ApiRiderIncident[]
  }>({
    queryKey: ['rider-applications'],
    queryFn: async () => {
      const res = await fetch('/api/rider-applications')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to load rider applications')
      }
      return res.json()
    },
    staleTime: 30 * 1000,
    ...options,
  })
}

export function useRiderDecision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      action: 'approve' | 'reject'
      email?: string
      note?: string
    }) => {
      const { id, ...payload } = input
      const res = await fetch(`/api/rider-applications/${id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to record the decision')
      }
      return data as {
        application: ApiRiderApplication
        rider?: { id: string; email: string }
        welcome?: { ok: boolean; error: string | null }
        hint?: string
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rider-applications'] })
      // Approvals create a DRIVER account — the order modal's driver
      // dropdown (built from the users list) must see it.
      qc.invalidateQueries({ queryKey: ['users'] })
      // Decisions log RIDER_DECISION events into the operations feed.
      qc.invalidateQueries({ queryKey: ['admin-notifications'] })
    },
  })
}

// ----- Current user -----
export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/users/me')
      if (!res.ok) return null
      const data = await res.json()
      return data.user
    },
    retry: false,
  })
}

// ----- Reviews -----

// Full review shape returned by the admin API (with joined relations).
export interface ApiReview {
  id: string
  orderId: string
  userId: string
  driverId: string | null
  rating: number
  comment: string
  displayName: string | null
  displayLocation: string | null
  isApproved: boolean
  approvedAt: string | null
  approvedById: string | null
  isHidden: boolean
  createdAt: string
  updatedAt: string
  user?: { id: string; name: string; email: string }
  order?: { id: string; orderNumber: string }
  driver?: { id: string; name: string } | null
}

// Public testimonial shape returned by GET /api/reviews.
export interface ApiTestimonial {
  id: string
  displayName: string
  displayLocation?: string
  rating: number
  comment: string
  // Masked order reference for order-verified reviews (e.g. KZ-••3846)
  orderNumberMasked?: string
  createdAt: string
}

// Public testimonials for the landing page carousel (no auth required).
export function usePublicTestimonials() {
  return useQuery({
    queryKey: ['reviews', 'public'],
    queryFn: async () => {
      const res = await fetch('/api/reviews')
      if (!res.ok) throw new Error('Failed to fetch testimonials')
      const data = await res.json()
      return data.testimonials as ApiTestimonial[]
    },
    staleTime: 60 * 1000, // 1 minute
  })
}

// All reviews for the admin moderation view (ADMIN only).
export function useAdminReviews(options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ['reviews', 'admin'],
    queryFn: async () => {
      const res = await fetch('/api/reviews/admin')
      if (!res.ok) throw new Error('Failed to fetch reviews')
      const data = await res.json()
      return data.reviews as ApiReview[]
    },
    staleTime: 10 * 1000,
    refetchInterval: options?.refetchInterval ?? false,
  })
}

// Moderate a review: approve / unapprove / hide / unhide.
export function useModerateReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'unapprove' | 'hide' | 'unhide' }) => {
      const res = await fetch(`/api/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update review')
      }
      const data = await res.json()
      return data.review as ApiReview
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] })
    },
  })
}

// -----------------------------------------------------------------------------
// LIVE GARMENT PRICES — PriceCatalog is the single source of truth
// -----------------------------------------------------------------------------
// The landing page and booking wizard use this so customers always see the
// price the server will actually charge (server-side pricing reads the same
// table). Falls back silently to the bundled catalog defaults when the API
// is unreachable, so the storefront never breaks.
export function useServerPrices() {
  const { data } = useQuery({
    queryKey: ['server-prices'],
    queryFn: async () => {
      const res = await fetch('/api/settings/prices')
      if (!res.ok) throw new Error('Failed to fetch prices')
      const data = await res.json()
      return (data.garmentPrices ?? {}) as Record<string, number>
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  return data
}

// -----------------------------------------------------------------------------
// APP SETTINGS — server-managed commercial settings (AppSetting table)
// -----------------------------------------------------------------------------
// Bank details at checkout, delivery fee, handwash surcharge, guarantee
// thresholds and offer percentages come from the SERVER so an admin edit
// reaches every visitor (the old localStorage copy was per-browser — that
// was the client-reported bug). Falls back to the bundled code defaults
// when the API is unreachable.
import { defaultAppSettings, type KozyAppSettings, type NotificationEvent } from '@/lib/types'

export function useAppSettings() {
  const { data } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings/app')
      if (!res.ok) throw new Error('Failed to fetch app settings')
      const data = await res.json()
      return (data.settings ?? defaultAppSettings()) as KozyAppSettings
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  return data ?? defaultAppSettings()
}

// =============================================================================
// Notification events — the admins' in-app operations feed (phase 24).
// Written by the admin-alert pipeline alongside the alert emails; the feed
// shows every signup / order / payment confirmation / feedback / rider
// application, WITH the per-recipient email delivery outcome.
// ==============================================================================
export function useNotificationEvents(options?: {
  refetchInterval?: number | false
  enabled?: boolean
  refetchOnWindowFocus?: boolean
}) {
  return useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const res = await fetch('/api/admin/notifications?take=100')
      if (!res.ok) throw new Error('Failed to fetch notifications')
      const data = await res.json()
      return data as {
        events: NotificationEvent[]
        unread: number
      }
    },
    refetchInterval: options?.refetchInterval ?? 60_000,
    enabled: options?.enabled ?? true,
    staleTime: 20_000,
    retry: 1,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
  })
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { ids?: string[]; all?: boolean }) => {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input.all ? { action: 'readAll' } : { action: 'read', ids: input.ids }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to mark notifications read')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notifications'] })
    },
  })
}

// =============================================================================
// Marketing (phase 36) — campaigns, coupons, subscribers, analytics
// =============================================================================
// The admin Marketing tab is ADMIN-only; these hooks hit the corresponding
// guarded endpoints. The lazy scheduler call (processDue) is fired by the
// Marketing view on mount so scheduled campaigns go out even when the daily
// cron is delayed.

export interface MarketingCampaign {
  id: string
  name: string
  subject: string
  htmlContent: string
  segment: string
  status: string
  scheduledAt: string | null
  source?: string
  slotDate?: string | null
  bannerSlug?: string | null
  testSentAt: string | null
  sentAt: string | null
  sentCount: number
  openCount: number
  clickCount: number
  createdAt: string
  deliveredCount?: number
}

export interface MarketingCoupon {
  id: string
  name: string
  code: string | null
  description: string | null
  type: string
  value: number
  active: boolean
  appliesTo: string
  minOrderValue: number | null
  maxDiscount: number | null
  maxUsesTotal: number | null
  maxUsesPerUser: number | null
  currentUses: number
  startDate: string | null
  endDate: string | null
  createdAt: string
  usageCount?: number
}

export interface MarketingSubscriber {
  id: string
  email: string
  name: string | null
  source: string
  optIn: boolean
  unsubscribedAt: string | null
  createdAt: string
}

export function useMarketingCampaigns() {
  return useQuery({
    queryKey: ['marketing-campaigns'],
    queryFn: async () => {
      const res = await fetch('/api/marketing/campaigns')
      if (!res.ok) throw new Error('Failed to fetch campaigns')
      const data = await res.json()
      return data.campaigns as MarketingCampaign[]
    },
    staleTime: 15_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useMarketingCoupons() {
  return useQuery({
    queryKey: ['marketing-coupons'],
    queryFn: async () => {
      const res = await fetch('/api/settings/discounts')
      if (!res.ok) throw new Error('Failed to fetch coupons')
      const data = await res.json()
      return data.discounts as MarketingCoupon[]
    },
    staleTime: 15_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useMarketingSubscribers(search: string) {
  return useQuery({
    queryKey: ['marketing-subscribers', search],
    queryFn: async () => {
      const res = await fetch(
        `/api/marketing/subscribers?q=${encodeURIComponent(search)}`
      )
      if (!res.ok) throw new Error('Failed to fetch subscribers')
      const data = await res.json()
      return data as {
        subscribers: MarketingSubscriber[]
        total: number
        optedInCustomers: number
        unsubscribed: number
      }
    },
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export interface MarketingStats {
  totalCampaigns: number
  sentCampaigns: number
  totalEmailsSent: number
  totalOpens: number
  totalClicks: number
  openRate: number
  clickRate: number
  subscribers: number
  optedInCustomers: number
  totalCouponUsages: number
  totalDiscountGiven: number
  topCoupons: {
    id: string
    name: string
    code: string | null
    type: string | null
    value: number | null
    active: boolean
    redemptions: number
    totalDiscount: number
  }[]
  recentCampaigns: {
    id: string
    name: string
    subject: string
    segment: string
    status: string
    sentCount: number
    openCount: number
    clickCount: number
    sentAt: string | null
    createdAt: string
  }[]
}

export function useMarketingStats() {
  return useQuery({
    queryKey: ['marketing-stats'],
    queryFn: async () => {
      const res = await fetch('/api/marketing/analytics')
      if (!res.ok) throw new Error('Failed to fetch marketing stats')
      return (await res.json()) as MarketingStats
    },
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

/** Lazy scheduler: processes any SCHEDULED campaigns that are due. Called on
 *  Marketing tab mount — the daily cron is the other trigger. */
export function useProcessDueCampaigns() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/marketing/campaigns/process-due', {
        method: 'POST',
      })
      if (!res.ok) return null
      return res.json()
    },
    onSuccess: (data) => {
      if (data && (data as any).processed > 0) {
        qc.invalidateQueries({ queryKey: ['marketing-campaigns'] })
        qc.invalidateQueries({ queryKey: ['marketing-stats'] })
      }
    },
  })
}

// =============================================================================
// Newsletter automation (phase 40) — the engine that drafts campaigns from
// the 52-week content library on the owner's cadence. It drafts; the owner
// previews, edits and approves. Nothing is ever auto-sent.
// =============================================================================

export interface MarketingAutomationState {
  schedule: {
    enabled: boolean
    cadenceWeeks: number
    dayOfWeek: number
    sendTime: string
    currentWeekIndex: number
    nextSlotDate: string | null
    slotPinned: boolean
  }
  pending: {
    id: string
    name: string
    subject: string
    status: string
    slotDate: string | null
    scheduledAt: string | null
    testSentAt: string | null
    bannerSlug: string | null
  } | null
  lastSent: {
    id: string
    name: string
    subject: string
    sentAt: string | null
    sentCount: number
  } | null
  nextUp: {
    week: number
    title: string
    subject: string
    season: string
    category: string
  }
  libraryTotal: number
}

export interface NewsletterLibraryEntry {
  week: number
  season: string
  category: string
  title: string
  subject: string
  banner: string
  bodyText: string
}

export interface NewsletterBannerInfo {
  slug: string
  label: string
}

export function useMarketingAutomation() {
  return useQuery({
    queryKey: ['marketing-automation'],
    queryFn: async () => {
      const res = await fetch('/api/marketing/automation')
      if (!res.ok) throw new Error('Failed to fetch the newsletter engine state')
      return (await res.json()) as MarketingAutomationState
    },
    staleTime: 10_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useUpdateMarketingAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (settings: {
      enabled?: boolean
      cadenceWeeks?: 1 | 2 | 4
      dayOfWeek?: number
      sendTime?: string
      currentWeekIndex?: number
      // 'YYYY-MM-DD' — pin the EXACT first-send day (calendar picker)
      startDate?: string
    }) => {
      const res = await fetch('/api/marketing/automation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save the engine settings')
      return data as MarketingAutomationState
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-automation'] })
      qc.invalidateQueries({ queryKey: ['marketing-campaigns'] })
    },
  })
}

export function usePrepareAutomationDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/marketing/automation/prepare', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not prepare the next newsletter')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-automation'] })
      qc.invalidateQueries({ queryKey: ['marketing-campaigns'] })
    },
  })
}

export function useSkipAutomationDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await fetch('/api/marketing/automation/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not skip this draft')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-automation'] })
      qc.invalidateQueries({ queryKey: ['marketing-campaigns'] })
    },
  })
}

export function useNewsletterLibrary() {
  return useQuery({
    queryKey: ['newsletter-library'],
    queryFn: async () => {
      const res = await fetch('/api/marketing/content-library')
      if (!res.ok) throw new Error('Failed to fetch the content plan')
      return (await res.json()) as {
        entries: NewsletterLibraryEntry[]
        banners: NewsletterBannerInfo[]
        total: number
      }
    },
    staleTime: 5 * 60_000,
    retry: 1,
  })
}

export function useApproveAutomationCampaign() {
  const qc = useQueryClient()
  return useMutation({
    // Approve = schedule the draft for its slot date (the engine already
    // pre-filled it). The daily cron / lazy scheduler delivers it on the day.
    // Slot already passed (owner approved late)? Schedule a minute out —
    // "approve" must never fail, and the server now rejects past dates.
    mutationFn: async (campaign: { id: string; slotDate: string | null }) => {
      const sendAt =
        campaign.slotDate && new Date(campaign.slotDate).getTime() > Date.now()
          ? campaign.slotDate
          : new Date(Date.now() + 60_000).toISOString()
      const res = await fetch(`/api/marketing/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: sendAt }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not approve this newsletter')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-automation'] })
      qc.invalidateQueries({ queryKey: ['marketing-campaigns'] })
    },
  })
}


// =============================================================================
// Memberships — The Kozy Circle (phase 62)
// =============================================================================

export interface ApiMembershipPlan {
  id: string
  code: string
  name: string
  tagline: string
  // KIT (laundry tier) | SHOES (standalone Shoe Club) — phase 70.
  family?: 'KIT' | 'SHOES'
  priceMonthly: number
  sortOrder: number
  isActive: boolean
  includedUnits: number
  unitKind: string
  unitName: string
  extraUnitPrice: number
  maxExtraUnits: number
  replacementFee: number
  duvetsPerQuarter: number
  curtainsPerQuarter: number
  springCleanPerYear: number
  shoesPerMonth: number
  // Oct 2026 — the monthly sheet allowance (Household 4 / Whole Home 6).
  bedsheetsPerMonth: number
  concierge: boolean
  memberDiscountPct: number
  prioritySlots: boolean
  paystackPlanCode?: string | null
}

export interface ApiMembershipUsage {
  unitsUsed: number
  unitsRemaining: number
  extraUnitsUsed: number
  extraRemaining: number
  shoesUsed: number
  shoesRemaining: number
  duvetsUsed: number
  duvetsRemaining: number
  curtainsUsed: number
  curtainsRemaining: number
  springCleanUsed: number
  springCleanRemaining: number
  bedsheetsUsed: number
  bedsheetsRemaining: number
}

/** Task 82 — a member's open "I've made payment" transfer claim: the
 *  RENEWAL_INTENT the office has not confirmed yet (months, amount,
 *  reference). Present on both the admin roster rows and the member's own
 *  membership payload; null once a CYCLE_START (confirmation) lands. */
export interface ApiRenewalClaim {
  months: number
  amount: number
  reference: string
  isInitial: boolean
  receipt: boolean
  planCode: string | null
  claimedAt: string
  stale: boolean
}

export interface ApiMembership {
  id: string
  userId: string
  status: string
  effectiveStatus?: string
  pricePaid: number
  paymentMethod: string | null
  periodStart: string | null
  periodEnd: string | null
  cancelAtPeriodEnd: boolean
  unitsUsed: number
  extraUnitsUsed: number
  shoesUsed: number
  duvetsUsed: number
  curtainsUsed: number
  springCleanUsed: number
  bedsheetsUsed: number
  kitState: string
  kitDeliveredAt: string | null
  plan?: ApiMembershipPlan
  // Phase 81: the member-scheduled tier switch (plan of the NEXT paid cycle).
  pendingPlan?: ApiMembershipPlan | null
  usage?: ApiMembershipUsage | null
  transferReceipt?: string | null
  user?: { id: string; name: string; email: string; phone: string } | null
  createdAt: string
  // ----- Phase 75: the retention radar + kit tag -----
  health?: {
    state: string
    label: string
    missedPickups: number
    pickupsThisCycle: number
    usageRatio: number | null
    cycleElapsed: number | null
  }
  kitTag?: string | null
  lastPickupAt?: string | null
  nextPickupAt?: string | null
  nextPickupSlot?: string | null
  // Task 82: the member's open "I've made payment" claim (admin roster +
  // member portal render it; settled by the office's confirmation).
  openClaim?: ApiRenewalClaim | null
}

/** Phase 75: one row of the member's in-cycle activity (a booking with its
 * live order status — the portal's "Your pickups this month" list). */
export interface ApiMembershipActivityRow {
  id: string
  orderNumber: string
  kind: string
  count: number
  label: string
  status: string
  missed: boolean
  pickupDate: string
  pickupTimeSlot: string
  pickedUpAt: string | null
  deliveredAt: string | null
  extraCharge: number
  createdAt: string
}

/** Phase 75: a ledger row (the WHY behind the counters). */
export interface ApiSubscriptionEventRow {
  id: string
  kind: string
  delta: number
  count: number
  note: string | null
  orderId: string | null
  createdAt: string
}

/** Public plan list — the marketing page and the portal both read this. */
export function useMembershipPlans(activeOnly = false) {
  return useQuery<ApiMembershipPlan[]>({
    queryKey: ['membership-plans', activeOnly ? 'active' : 'all'],
    queryFn: async () => {
      const res = await fetch(`/api/subscriptions/plans${activeOnly ? '?active=1' : ''}`)
      if (!res.ok) throw new Error('Failed to load plans')
      const data = await res.json()
      return data.plans as ApiMembershipPlan[]
    },
    staleTime: 60 * 1000,
  })
}

/** ADMIN: save edited plans (prices, perks, caps). */
export function useSaveMembershipPlans() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (plans: Array<Partial<ApiMembershipPlan> & { id: string }>) => {
      const res = await fetch('/api/subscriptions/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save the plans')
      return data as { plans: ApiMembershipPlan[]; paystack?: Array<{ code: string; planCode: string | null }> }
    },
    onSuccess: (data) => {
      qc.setQueryData(['membership-plans', 'all'], data.plans)
      qc.invalidateQueries({ queryKey: ['membership-plans'] })
    },
  })
}

/** The signed-in member's own memberships (null when not a member). The
 * laundry tier keeps the legacy `membership` shape; the standalone Shoe
 * Club rides on `shoeClub` (phase 70) — one account may hold both.
 * Phase 75 adds `activity` — the in-cycle bookings with live statuses. */
export function useMyMembership() {
  return useQuery<{
    membership: ApiMembership | null
    effectiveStatus?: string | null
    usage?: ApiMembershipUsage | null
    activity?: {
      subscriptionId: string
      activity: ApiMembershipActivityRow[]
      events: ApiSubscriptionEventRow[]
    } | null
    // Task 82: the member's open transfer claim on the laundry tier.
    openClaim?: ApiRenewalClaim | null
    shoeClub?: {
      membership: ApiMembership
      effectiveStatus: string
      usage: ApiMembershipUsage | null
      openClaim?: ApiRenewalClaim | null
      activity?: {
        subscriptionId: string
        activity: ApiMembershipActivityRow[]
        events: ApiSubscriptionEventRow[]
      } | null
    } | null
  }>({
    queryKey: ['my-membership'],
    queryFn: async () => {
      const res = await fetch('/api/subscriptions/me')
      if (!res.ok) throw new Error('Failed to load membership')
      return res.json()
    },
    staleTime: 15 * 1000,
  })
}

/** Join the Circle — returns the payment next-step (paystack | transfer). */
export function useSubscribe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      planCode: string
      paymentMethod: 'PAYSTACK' | 'BANK_TRANSFER'
      transferReceipt?: string
    }) => {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err = new Error(data.message || data.error || 'Could not start the membership')
        ;(err as any).code = data.error
        ;(err as any).subscription = data.subscription
        throw err
      }
      return data as { subscription: ApiMembership; next: 'paystack' | 'transfer' }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-membership'] }),
  })
}

/** Start the Paystack charge for a pending membership → authorization URL. */
export function useMembershipPaystackInit() {
  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const res = await fetch('/api/paystack/subscription-initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err = new Error(data.message || data.error || 'Could not start the payment')
        ;(err as any).code = data.error
        throw err
      }
      return data as { authorizationUrl: string; reference: string; amount: number; recurring: boolean }
    },
  })
}

/** Cancel at period end / undo. Pass a family to target the Shoe Club
 * instead of the laundry tier (phase 70); default stays KIT for every
 * existing caller. */
export function useMembershipCancel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      input:
        | 'cancel'
        | 'cancel-undo'
        | 'withdraw-request'
        | { action: 'cancel' | 'cancel-undo' | 'withdraw-request'; family?: 'KIT' | 'SHOES' }
    ) => {
      const body =
        typeof input === 'string' ? { action: input } : { action: input.action, family: input.family }
      const res = await fetch('/api/subscriptions/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || data.error || 'Could not update the membership')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-membership'] }),
  })
}

/** Phase 81 — the quiet tier switch. A pending request swaps the plan
 * immediately (no money has moved); a live membership schedules the switch
 * for the next paid cycle. `plan-change-undo` clears a scheduled switch. */
export function useMembershipPlanChange() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      action: 'plan-change' | 'plan-change-undo'
      planCode?: string
      family?: 'KIT' | 'SHOES'
    }) => {
      const res = await fetch('/api/subscriptions/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err = new Error(data.message || data.error || 'Could not change the plan')
        ;(err as any).code = data.error
        throw err
      }
      return data as { membership: ApiMembership; effectiveStatus: string; applied?: string }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-membership'] })
      qc.invalidateQueries({ queryKey: ['admin-memberships'] })
    },
  })
}

/** Book a member pickup / perk service — creates a real order. */
export function useMembershipPickup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      kind: 'unit' | 'duvet' | 'curtain' | 'spring-clean' | 'shoes' | 'bedsheet'
      count?: number
      pickupAddress: string
      pickupDate: string
      pickupTimeSlot: string
      deliveryAddress?: string
      note?: string
    }) => {
      const res = await fetch('/api/subscriptions/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || data.error || 'Could not book the pickup')
      return data as { order: ApiOrder; duplicate?: boolean; extraUnits?: number; extraCharge?: number }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-membership'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

/** ADMIN: every membership, with usage + the member's contact. */
export function useAdminMemberships(options?: { refetchInterval?: number | false }) {
  return useQuery<ApiMembership[]>({
    queryKey: ['admin-memberships'],
    queryFn: async () => {
      const res = await fetch('/api/subscriptions')
      if (!res.ok) throw new Error('Failed to load memberships')
      const data = await res.json()
      return data.items as ApiMembership[]
    },
    staleTime: 10 * 1000,
    refetchInterval: options?.refetchInterval ?? 30_000,
    refetchOnWindowFocus: true,
  })
}

/** ADMIN: verify / renew / cancel / kit lifecycle / reset usage / adjust
 * usage / nudges / kit tag (phase 75 additions ride the same mutation). */
export function useMembershipAdminAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      action: string
      pricePaid?: number
      reason?: string
      method?: string
      counter?: string
      delta?: number
      note?: string
      reMint?: boolean
    }) => {
      const res = await fetch(`/api/subscriptions/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Action failed')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-memberships'] })
      qc.invalidateQueries({ queryKey: ['my-membership'] })
      qc.invalidateQueries({ queryKey: ['membership-drilldown'] })
    },
  })
}

/** ADMIN (phase 75): the member drill-down — ledger, activity, kit tag. */
export function useMembershipDrilldown(id: string | null) {
  return useQuery<{
    membership: ApiMembership
    user: { id: string; name: string; email: string; phone: string } | null
    kitTag: string | null
    activity: {
      subscriptionId: string
      activity: ApiMembershipActivityRow[]
      events: ApiSubscriptionEventRow[]
    } | null
  } | null>({
    queryKey: ['membership-drilldown', id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null
      const res = await fetch(`/api/subscriptions/${id}`)
      if (!res.ok) throw new Error('Failed to load the member ledger')
      return res.json()
    },
    staleTime: 10 * 1000,
  })
}

// =============================================================================
// Branches (phase 62) — Ogombo / Chevron Drive
// =============================================================================

export interface ApiBranch {
  id: string
  name: string
  slug: string
  address: string
  phone: string | null
  zoneNames: string[]
  lat: number
  lng: number
  isActive: boolean
  isDefault: boolean
  /** Phase 69: COMPANY | FRANCHISE — franchise sites render gold with a
   *  partner chip in the console. */
  ownershipType?: 'COMPANY' | 'FRANCHISE'
  /** Phase 70: all-time numbers epoch (COMPANY branches only). null = count
   *  everything; a date = count only rows at/after it. */
  statsResetAt?: string | null
  sortOrder: number
}

export function useBranches(options?: { refetchInterval?: number | false }) {
  return useQuery<ApiBranch[]>({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await fetch('/api/branches')
      if (!res.ok) throw new Error('Failed to load branches')
      const data = await res.json()
      return data.branches as ApiBranch[]
    },
    staleTime: 60 * 1000,
    refetchInterval: options?.refetchInterval ?? false,
  })
}

/** ADMIN: save branch edits (zones, default, active). */
export function useSaveBranches() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (branches: Array<Partial<ApiBranch> & { id: string }>) => {
      const res = await fetch('/api/branches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branches }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save branches')
      return data as { branches: ApiBranch[] }
    },
    onSuccess: (data) => qc.setQueryData(['branches'], data.branches),
  })
}

/** ADMIN: restart a COMPANY branch's all-time numbers (phase 70). Sets the
 * reporting epoch — orders/payments are never deleted. Franchise branches
 * are refused server-side (their ledger is contractual). */
export function useResetBranchStats() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (branchId: string) => {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-stats', branchId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || data.error || 'Could not reset the numbers')
      return data as { branch: { id: string; name: string; statsResetAt: string | null }; message: string }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  })
}

// =============================================================================
// Kozy Network partners (phase 62)
// =============================================================================

export interface ApiPartner {
  id: string
  businessName: string
  contactName: string
  email: string
  phone: string
  address: string
  capacityNotes: string | null
  branchId: string | null
  status: string
  revenueSharePartnerPct: number
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string
  /** Phase 72 — application reference + portal login created at approval. */
  refCode: string | null
  lga: string | null
  servicesOffered: string | null
  userId: string | null
  account: { id: string; name: string; email: string; accessStatus: string } | null
}

export interface ApiPartnerLedger {
  partnerId: string
  ordersLifetime: number
  ordersThisMonth: number
  revenueLifetime: number
  revenueThisMonth: number
  partnerShareThisMonth: number
  kozyShareThisMonth: number
  /** Phase 72 — the settlement money side. */
  shareEarned: number
  settledTotal: number
  pendingSettlement: number
  lastSettlementAt: string | null
  settlements: {
    id: string
    amount: number
    method: string
    reference: string | null
    note: string | null
    createdAt: string
  }[]
}

export function usePartners(options?: { refetchInterval?: number | false }) {
  return useQuery<{ partners: ApiPartner[]; ledger: ApiPartnerLedger[] }>({
    queryKey: ['partners'],
    queryFn: async () => {
      const res = await fetch('/api/partners')
      if (!res.ok) throw new Error('Failed to load partners')
      return res.json()
    },
    staleTime: 15 * 1000,
    refetchInterval: options?.refetchInterval ?? 30_000,
    refetchOnWindowFocus: true,
  })
}

export function usePartnerDecision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      action: 'approve' | 'reject' | 'suspend' | 'reactivate' | 'update'
      branchId?: string | null
      revenueSharePartnerPct?: number
      note?: string
    }) => {
      const res = await fetch(`/api/partners/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Decision failed')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partners'] }),
  })
}

/** ADMIN: assign a rider to their home branch. */
export function useRiderBranchAssign() {
  return useMutation({
    mutationFn: async (input: {
      userId: string
      branchId?: string | null
      employmentType?: 'FULL_TIME' | 'PART_TIME' | null
    }) => {
      const res = await fetch(`/api/users/${input.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          input.employmentType !== undefined
            ? { employmentType: input.employmentType }
            : { branchId: input.branchId ?? null }
        ),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save the rider setting')
      return data
    },
  })
}

// =============================================================================
// RIDER PAYOUTS (phase 72) — the money side of the roster
// =============================================================================

export interface ApiRiderPayoutRow {
  id: string
  amount: number
  method: string
  reference: string | null
  note: string | null
  createdAt: string
  riderId: string
  riderName: string
  recordedByName: string | null
}

/** ADMIN: recent rider payouts (the desk's history strip). */
export function useRiderPayouts(options?: { refetchInterval?: number | false }) {
  return useQuery<{ payouts: ApiRiderPayoutRow[] }>({
    queryKey: ['rider-payouts'],
    queryFn: async () => {
      const res = await fetch('/api/rider-payouts')
      if (!res.ok) throw new Error('Failed to load payouts')
      return res.json()
    },
    staleTime: 15 * 1000,
    refetchInterval: options?.refetchInterval ?? 30_000,
    refetchOnWindowFocus: true,
  })
}

/** ADMIN: record a payout (money actually settled to a rider). */
export function useRecordRiderPayout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      riderId: string
      amount: number
      method: 'BANK_TRANSFER' | 'CASH'
      reference?: string
      note?: string
    }) => {
      const res = await fetch('/api/rider-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not record the payout')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rider-payouts'] })
      qc.invalidateQueries({ queryKey: ['rider-applications'] })
    },
  })
}

/** ADMIN: recent partner settlements (the Partners desk's history strip). */
export function usePartnerSettlements(options?: { refetchInterval?: number | false }) {
  return useQuery<{
    settlements: {
      id: string
      amount: number
      method: string
      reference: string | null
      note: string | null
      createdAt: string
      partnerId: string
      partnerName: string
      recordedByName: string | null
    }[]
  }>({
    queryKey: ['partner-settlements'],
    queryFn: async () => {
      const res = await fetch('/api/partner-settlements')
      if (!res.ok) throw new Error('Failed to load settlements')
      return res.json()
    },
    staleTime: 15 * 1000,
    refetchInterval: options?.refetchInterval ?? 30_000,
    refetchOnWindowFocus: true,
  })
}

/** ADMIN: record a partner settlement. */
export function useRecordPartnerSettlement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      partnerId: string
      amount: number
      method: 'BANK_TRANSFER' | 'CASH'
      reference?: string
      note?: string
    }) => {
      const res = await fetch('/api/partner-settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not record the settlement')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-settlements'] })
      qc.invalidateQueries({ queryKey: ['partners'] })
    },
  })
}

// =============================================================================
// PARTNER PORTAL (phase 72) — the laundrette's own working screen
// =============================================================================

export interface ApiPartnerPortalOrder {
  id: string
  orderNumber: string
  status: string
  type: string
  serviceSpeed: string
  modeOfWash: string | null
  itemCount: number
  items: { name: string; quantity: number }[]
  finalWeight: number | null
  alterationNotes: string | null
  pickupDate: string | null
  pickedUpAt: string | null
  atStationAt: string | null
  processingAt: string | null
  finishingAt: string | null
  outForDeliveryAt: string | null
  deliveredAt: string | null
  customerName: string
}

export interface ApiPartnerPortalData {
  partner: {
    id: string
    businessName: string
    contactName: string
    email: string
    phone: string
    address: string
    lga: string | null
    servicesOffered: string | null
    branchId: string | null
    status: string
    revenueSharePartnerPct: number
  }
  stats: { active: number; awaitingReceipt: number; finishedThisMonth: number }
  active: ApiPartnerPortalOrder[]
  recentDone: ApiPartnerPortalOrder[]
}

export interface ApiPartnerEarnings {
  sharePct: number
  ledger: {
    ordersThisMonth: number
    ordersLifetime: number
    revenueThisMonth: number
    revenueLifetime: number
    shareEarned: number
    shareThisMonth: number
  }
  settlements: {
    settledTotal: number
    pending: number
    lastSettlementAt: string | null
    history: { id: string; amount: number; method: string; reference: string | null; note: string | null; createdAt: string }[]
  }
  deliveredOrders: {
    orderNumber: string
    customerName: string
    orderValue: number
    yourShare: number
    deliveredAt: string | null
    serviceSpeed: string
  }[]
}

/** PARTNER: the portal working screen (orders routed to this laundrette). */
export function usePartnerOverview(options?: { refetchInterval?: number | false }) {
  return useQuery<ApiPartnerPortalData>({
    queryKey: ['partner-portal-overview'],
    queryFn: async () => {
      const res = await fetch('/api/partner/overview')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to load your overview')
      }
      return res.json()
    },
    staleTime: 10 * 1000,
    refetchInterval: options?.refetchInterval ?? 30_000,
    refetchOnWindowFocus: true,
  })
}

/** PARTNER: advance an order one step (received → washing → finishing). */
export function useUpdatePartnerOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { orderId: string }) => {
      const res = await fetch(`/api/partner/orders/${input.orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not update the order')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-portal-overview'] })
    },
  })
}

/** PARTNER: the share ledger + settlements. */
export function usePartnerEarnings(options?: { refetchInterval?: number | false }) {
  return useQuery<ApiPartnerEarnings>({
    queryKey: ['partner-portal-earnings'],
    queryFn: async () => {
      const res = await fetch('/api/partner/earnings')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to load your earnings')
      }
      return res.json()
    },
    staleTime: 30 * 1000,
    refetchInterval: options?.refetchInterval ?? 60_000,
    refetchOnWindowFocus: true,
  })
}
