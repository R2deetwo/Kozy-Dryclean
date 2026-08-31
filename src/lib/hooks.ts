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
  user?: { id: string; name: string; email: string; phone: string; role: string }
  driver?: { id: string; name: string; phone: string } | null
  payments?: ApiPayment[]
  media?: any[]
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
  order?: { id: string; orderNumber: string; userId: string }
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
        deleted: { orders: number; reviews: number; payments: number }
      }
    },
    onSuccess: () => {
      // The CRM list, the orders board and any open customer stats all need
      // to forget this person immediately.
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
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
