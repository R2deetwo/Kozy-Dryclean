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
export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const res = await fetch('/api/orders')
      if (!res.ok) throw new Error('Failed to fetch orders')
      const data = await res.json()
      return data.orders as ApiOrder[]
    },
    staleTime: 10 * 1000, // 10 seconds
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
        throw new Error(err.error || 'Failed to update order')
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
