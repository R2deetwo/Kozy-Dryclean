// =============================================================================
// React Query hooks for API data fetching
// =============================================================================
// These replace Zustand selectors. Zustand remains for ephemeral UI state only
// (form drafts, modal open/close, wizard step, theme).
// =============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

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

// ----- Orders -----
export function useOrders(options?: {
  /** Set false to pause polling (e.g. driver outside the geofence) */
  enabled?: boolean
  /** Live-refresh interval in ms (e.g. 15000 for the driver app) */
  refetchInterval?: number | false
}) {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const res = await fetch('/api/orders')
      if (!res.ok) throw new Error('Failed to fetch orders')
      const data = await res.json()
      return data.orders as ApiOrder[]
    },
    staleTime: 10 * 1000, // 10 seconds
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval ?? false,
  })
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
export function usePayments() {
  return useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const res = await fetch('/api/payments')
      if (!res.ok) throw new Error('Failed to fetch payments')
      const data = await res.json()
      return data.payments as ApiPayment[]
    },
    staleTime: 10 * 1000,
  })
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

export function useVerifyPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'VERIFIED' | 'REJECTED' }) => {
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
      return data.payment as ApiPayment
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

// ----- Users (admin-only) -----
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      return data.users as ApiUser[]
    },
    staleTime: 30 * 1000,
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
export function useAdminReviews() {
  return useQuery({
    queryKey: ['reviews', 'admin'],
    queryFn: async () => {
      const res = await fetch('/api/reviews/admin')
      if (!res.ok) throw new Error('Failed to fetch reviews')
      const data = await res.json()
      return data.reviews as ApiReview[]
    },
    staleTime: 10 * 1000,
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
