// Zustand store for Kozy Care — Premium Drycleaning & Laundry Services.
// Holds Users, Orders, Payments, GarmentMedia, and Notifications in client state.
// Persisted to localStorage so the demo survives reloads.

import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Order,
  User,
  Payment,
  GarmentMedia,
  OrderItem,
  OrderStatus,
  OrderType,
  PaymentMethod,
  NotificationTemplate,
  KozySettings,
} from './types'
import {
  GARMENT_CATALOG,
  B2B_PRICING,
  GUARANTEE_DISCOUNT,
  COMPANY_BANK,
  buildNotification,
  PIPELINE_STAGES,
  type PipelineStage,
} from './types'

// =====================================================
// ID helpers
// =====================================================
function genId(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

let orderCounter = 1024
function nextOrderNumber(): string {
  orderCounter += 1
  return `KZ-${orderCounter}`
}

// =====================================================
// Seed data — representative Lagos sample
// =====================================================
const SEED_USERS: User[] = [
  {
    id: 'u-admin',
    email: 'kozygarmentcare@gmail.com',
    name: 'Adaeze Okonkwo',
    phone: '+234 802 111 2233',
    role: 'ADMIN',
    address: 'Kozy Atelier, 12 Gerard Rd, Ikoyi, Lagos',
    createdAt: '2025-01-15T08:00:00.000Z',
  },
  {
    id: 'u-driver-1',
    email: 'tunde.balogun@example.com',
    name: 'Tunde Balogun',
    phone: '+234 803 222 4455',
    role: 'DRIVER',
    address: 'Allen Avenue, Ikeja, Lagos',
    createdAt: '2025-02-01T08:00:00.000Z',
  },
  {
    id: 'u-driver-2',
    email: 'bisi.adebayo@example.com',
    name: 'Bisi Adebayo',
    phone: '+234 805 333 6677',
    role: 'DRIVER',
    address: 'Lekki Phase 1, Lagos',
    createdAt: '2025-02-15T08:00:00.000Z',
  },
  {
    id: 'u-b2c-1',
    email: 'chioma.eze@gmail.com',
    name: 'Chioma Eze',
    phone: '+234 807 444 1122',
    role: 'B2C',
    address: '5 Adeniyi Jones Ave, Ikeja, Lagos',
    createdAt: '2025-03-10T08:00:00.000Z',
  },
  {
    id: 'u-b2c-2',
    email: 'femi.adeyemi@yahoo.com',
    name: 'Femi Adeyemi',
    phone: '+234 809 555 3344',
    role: 'B2C',
    address: '23 Bourdillon Rd, Ikoyi, Lagos',
    createdAt: '2025-03-15T08:00:00.000Z',
  },
  {
    id: 'u-b2b-1',
    email: 'procurement@meridianhotels.com',
    name: 'Meridian Hotel Group',
    phone: '+234 811 666 7788',
    role: 'B2B',
    company: 'Meridian Hotel Group',
    address: 'Marina Rd, Lagos Island, Lagos',
    createdAt: '2025-02-20T08:00:00.000Z',
  },
  {
    id: 'u-b2b-2',
    email: 'facilities@lekkiheights.com',
    name: 'Lekki Heights Estates',
    phone: '+234 813 777 9900',
    role: 'B2B',
    company: 'Lekki Heights Estates',
    address: 'Lekki-Epe Expressway, Lagos',
    createdAt: '2025-04-05T08:00:00.000Z',
  },
]

function pickGarment(id: string, qty: number): OrderItem {
  const g = GARMENT_CATALOG.find((c) => c.id === id) ?? GARMENT_CATALOG[0]
  return { id: genId('item_'), name: g.name, quantity: qty, unitPrice: g.price }
}

const SEED_ORDERS: Order[] = [
  // B2C order — delivered (history)
  {
    id: 'o-1001',
    orderNumber: 'KZ-1001',
    userId: 'u-b2c-1',
    driverId: 'u-driver-1',
    status: 'DELIVERED',
    type: 'ITEM',
    guaranteeActive: true,
    items: [pickGarment('shirt', 5), pickGarment('trouser', 2), pickGarment('agbada', 1)],
    totalPrice: 5 * 500 + 2 * 700 + 3500, // 6900
    pickupAddress: '5 Adeniyi Jones Ave, Ikeja, Lagos',
    pickupDate: '2026-08-18T09:00:00.000Z',
    pickupTimeSlot: '09:00 - 10:00',
    deliveryAddress: '5 Adeniyi Jones Ave, Ikeja, Lagos',
    deliveryDate: '2026-08-20T16:00:00.000Z',
    pickedUpAt: '2026-08-18T09:15:00.000Z',
    atStationAt: '2026-08-18T10:30:00.000Z',
    processingAt: '2026-08-19T08:00:00.000Z',
    finishingAt: '2026-08-19T15:00:00.000Z',
    outForDeliveryAt: '2026-08-20T14:00:00.000Z',
    deliveredAt: '2026-08-20T16:30:00.000Z',
    createdAt: '2026-08-17T20:00:00.000Z',
    updatedAt: '2026-08-20T16:30:00.000Z',
  },
  // B2C order — out for delivery
  {
    id: 'o-1002',
    orderNumber: 'KZ-1002',
    userId: 'u-b2c-2',
    driverId: 'u-driver-2',
    status: 'OUT_FOR_DELIVERY',
    type: 'ITEM',
    guaranteeActive: false,
    items: [pickGarment('suit-2pc', 2), pickGarment('shirt', 4)],
    totalPrice: 2 * 4500 + 4 * 500, // 11000
    pickupAddress: '23 Bourdillon Rd, Ikoyi, Lagos',
    pickupDate: '2026-08-22T10:00:00.000Z',
    pickupTimeSlot: '10:00 - 11:00',
    deliveryAddress: '23 Bourdillon Rd, Ikoyi, Lagos',
    deliveryDate: '2026-08-24T15:00:00.000Z',
    pickedUpAt: '2026-08-22T10:20:00.000Z',
    atStationAt: '2026-08-22T11:30:00.000Z',
    processingAt: '2026-08-23T08:00:00.000Z',
    finishingAt: '2026-08-23T18:00:00.000Z',
    outForDeliveryAt: '2026-08-24T13:00:00.000Z',
    createdAt: '2026-08-21T19:00:00.000Z',
    updatedAt: '2026-08-24T13:00:00.000Z',
  },
  // B2B order — picked up, awaiting weight input from admin
  {
    id: 'o-1003',
    orderNumber: 'KZ-1003',
    userId: 'u-b2b-1',
    driverId: 'u-driver-1',
    status: 'PICKED_UP',
    type: 'KG',
    guaranteeActive: false,
    items: [],
    totalPrice: undefined, // pending weight
    pickupAddress: 'Marina Rd, Lagos Island, Lagos',
    pickupDate: '2026-08-23T08:00:00.000Z',
    pickupTimeSlot: '08:00 - 09:00',
    deliveryAddress: 'Marina Rd, Lagos Island, Lagos',
    pickedUpAt: '2026-08-23T08:30:00.000Z',
    createdAt: '2026-08-22T15:00:00.000Z',
    updatedAt: '2026-08-23T08:30:00.000Z',
  },
  // B2C order — payment pending verification (uploaded receipt)
  {
    id: 'o-1004',
    orderNumber: 'KZ-1004',
    userId: 'u-b2c-1',
    status: 'PAYMENT_PENDING_VERIFICATION',
    type: 'ITEM',
    guaranteeActive: true,
    items: [pickGarment('ankara-gown', 3), pickGarment('iro-buba', 2)],
    totalPrice: (3 * 1800 + 2 * 2000) * (1 - GUARANTEE_DISCOUNT), // 9400 - 5% = 8930
    pickupAddress: '5 Adeniyi Jones Ave, Ikeja, Lagos',
    pickupDate: '2026-08-25T09:00:00.000Z',
    pickupTimeSlot: '09:00 - 10:00',
    deliveryAddress: '5 Adeniyi Jones Ave, Ikeja, Lagos',
    createdAt: '2026-08-24T07:00:00.000Z',
    updatedAt: '2026-08-24T07:30:00.000Z',
  },
  // B2B order — payment verified, in processing
  {
    id: 'o-1005',
    orderNumber: 'KZ-1005',
    userId: 'u-b2b-2',
    driverId: 'u-driver-2',
    status: 'PROCESSING',
    type: 'KG',
    guaranteeActive: false,
    items: [],
    finalWeight: 45,
    totalPrice: 45 * B2B_PRICING.pricePerKg, // 36000
    pickupAddress: 'Lekki-Epe Expressway, Lagos',
    pickupDate: '2026-08-21T07:00:00.000Z',
    pickupTimeSlot: '07:00 - 08:00',
    deliveryAddress: 'Lekki-Epe Expressway, Lagos',
    pickedUpAt: '2026-08-21T07:30:00.000Z',
    atStationAt: '2026-08-21T09:00:00.000Z',
    processingAt: '2026-08-22T08:00:00.000Z',
    createdAt: '2026-08-20T11:00:00.000Z',
    updatedAt: '2026-08-22T08:00:00.000Z',
  },
]

const SEED_PAYMENTS: Payment[] = [
  {
    id: 'p-1001',
    orderId: 'o-1001',
    amount: 6900,
    method: 'BANK_TRANSFER',
    status: 'VERIFIED',
    receiptUrl: undefined,
    verifiedAt: '2026-08-17T22:00:00.000Z',
    verifiedById: 'u-admin',
    createdAt: '2026-08-17T21:30:00.000Z',
    updatedAt: '2026-08-17T22:00:00.000Z',
  },
  {
    id: 'p-1002',
    orderId: 'o-1002',
    amount: 11000,
    method: 'PAYSTACK',
    status: 'VERIFIED',
    paystackRef: 'PSK_DEMO_KZ1002',
    verifiedAt: '2026-08-21T20:00:00.000Z',
    createdAt: '2026-08-21T19:30:00.000Z',
    updatedAt: '2026-08-21T20:00:00.000Z',
  },
  {
    id: 'p-1003',
    orderId: 'o-1003',
    amount: 0,
    method: 'BANK_TRANSFER',
    status: 'PENDING',
    createdAt: '2026-08-22T15:30:00.000Z',
    updatedAt: '2026-08-22T15:30:00.000Z',
  },
  {
    id: 'p-1004',
    orderId: 'o-1004',
    amount: 8930,
    method: 'BANK_TRANSFER',
    status: 'PENDING',
    // A mock receipt URL — we'll show a placeholder image when rendered
    receiptUrl: 'mock-receipt-1004',
    createdAt: '2026-08-24T07:30:00.000Z',
    updatedAt: '2026-08-24T07:30:00.000Z',
  },
  {
    id: 'p-1005',
    orderId: 'o-1005',
    amount: 36000,
    method: 'BANK_TRANSFER',
    status: 'VERIFIED',
    verifiedAt: '2026-08-21T18:00:00.000Z',
    verifiedById: 'u-admin',
    createdAt: '2026-08-21T17:00:00.000Z',
    updatedAt: '2026-08-21T18:00:00.000Z',
  },
]

const SEED_MEDIA: GarmentMedia[] = [
  // For demo, leave empty — actual photos will be data URLs uploaded at runtime.
]

const SEED_NOTIFICATIONS: NotificationTemplate[] = [
  {
    id: 'n-1',
    channel: 'SMS',
    to: 'Chioma Eze',
    orderId: 'KZ-1001',
    body: 'Delivered! Order #KZ-1001 is complete. Rate your experience: /review/KZ-1001',
    sentAt: '2026-08-20T16:31:00.000Z',
  },
  {
    id: 'n-2',
    channel: 'SMS',
    to: 'Femi Adeyemi',
    orderId: 'KZ-1002',
    body: 'On the way! Bisi is delivering your Kozy order. Call: +234 805 333 6677',
    sentAt: '2026-08-24T13:00:00.000Z',
  },
]

// =====================================================

// =====================================================
// Default admin-managed settings
// =====================================================
const DEFAULT_SETTINGS: KozySettings = {
  bankName: COMPANY_BANK.bankName,
  accountName: COMPANY_BANK.accountName,
  accountNumber: COMPANY_BANK.accountNumber,
  contactPhone: '+234 803 175 5230',
  contactEmail: 'kozygarmentcare@gmail.com',
  atelierAddress: 'Kozy Atelier, 12 Gerard Rd, Ikoyi, Lagos',
  pricePerKg: B2B_PRICING.pricePerKg,
  minimumKg: B2B_PRICING.minimumKg,
  guaranteeDiscountPercent: Math.round(GUARANTEE_DISCOUNT * 100),
  garmentPrices: Object.fromEntries(GARMENT_CATALOG.map((g) => [g.id, g.price])),
}

// =====================================================
// Store shape
// =====================================================
interface StoreState {
  users: User[]
  orders: Order[]
  payments: Payment[]
  media: GarmentMedia[]
  notifications: NotificationTemplate[]
  // current session user
  currentUserId: string
  // admin-managed settings (bank account, pricing, etc.)
  settings: KozySettings

  // selectors / actions
  setCurrentUser: (id: string) => void
  getCurrentUser: () => User
  updateSettings: (partial: Partial<KozySettings>) => void
  setGarmentPrice: (id: string, price: number) => void

  // orders
  createOrder: (input: {
    userId: string
    type: OrderType
    items: OrderItem[]
    guaranteeActive: boolean
    pickupAddress: string
    pickupDate: string
    pickupTimeSlot: string
    deliveryAddress?: string
  }) => Order
  updateOrderStatus: (orderId: string, status: OrderStatus, actorId?: string) => void
  assignDriver: (orderId: string, driverId: string) => void
  setB2BWeight: (orderId: string, kg: number, actorId: string) => void

  // payments
  createPayment: (input: {
    orderId: string
    amount: number
    method: PaymentMethod
    receiptUrl?: string
  }) => Payment
  verifyPayment: (paymentId: string, actorId: string) => void
  rejectPayment: (paymentId: string, actorId: string) => void

  // media
  addMedia: (orderId: string, imageUrl: string, notes?: string) => GarmentMedia

  // notifications helper (writes a row but doesn't actually send)
  notify: (n: Omit<NotificationTemplate, 'id' | 'sentAt'>) => void

  // NOTE: reviews/testimonials now live in the database and are served by
  // /api/reviews — see src/lib/hooks.ts (usePublicTestimonials,
  // useAdminReviews, useModerateReview). They were removed from this store
  // because localStorage is per-browser and never reached the server.

  // utility
  resetDemo: () => void
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      users: SEED_USERS,
      orders: SEED_ORDERS,
      payments: SEED_PAYMENTS,
      media: SEED_MEDIA,
      notifications: SEED_NOTIFICATIONS,
      currentUserId: '', // empty by default — auth gate appears until user signs in
      settings: DEFAULT_SETTINGS,

      updateSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),

      setGarmentPrice: (id, price) =>
        set((s) => ({
          settings: {
            ...s.settings,
            garmentPrices: { ...s.settings.garmentPrices, [id]: price },
          },
        })),

      setCurrentUser: (id) => set({ currentUserId: id }),
      getCurrentUser: () => {
        const { users, currentUserId } = get()
        return users.find((u) => u.id === currentUserId) ?? users[0]
      },

      createOrder: (input) => {
        const now = new Date().toISOString()
        const orderNumber = nextOrderNumber()
        let totalPrice: number | undefined
        if (input.type === 'ITEM') {
          const subtotal = input.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
          totalPrice = input.guaranteeActive ? subtotal * (1 - (get().settings.guaranteeDiscountPercent / 100)) : subtotal
        } else {
          // B2B: pending weight
          totalPrice = undefined
        }
        const order: Order = {
          id: genId('o_'),
          orderNumber,
          userId: input.userId,
          status: 'REQUESTED',
          type: input.type,
          items: input.items,
          guaranteeActive: input.guaranteeActive,
          totalPrice,
          pickupAddress: input.pickupAddress,
          pickupDate: input.pickupDate,
          pickupTimeSlot: input.pickupTimeSlot,
          deliveryAddress: input.deliveryAddress,
          createdAt: now,
          updatedAt: now,
        }
        set((s) => ({ orders: [order, ...s.orders] }))

        const customer = get().users.find((u) => u.id === input.userId)
        if (customer) {
          get().notify({
            channel: 'SMS',
            to: customer.name,
            orderId: orderNumber,
            body: buildNotification('BOOKING_PLACED', order, customer),
          })
        }
        return order
      },

      updateOrderStatus: (orderId, status, actorId) => {
        const now = new Date().toISOString()
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o
            const next: Order = { ...o, status, updatedAt: now }
            if (status === 'PICKED_UP' && !next.pickedUpAt) next.pickedUpAt = now
            if (status === 'AT_STATION' && !next.atStationAt) next.atStationAt = now
            if (status === 'PROCESSING' && !next.processingAt) next.processingAt = now
            if (status === 'FINISHING' && !next.finishingAt) next.finishingAt = now
            if (status === 'OUT_FOR_DELIVERY' && !next.outForDeliveryAt) next.outForDeliveryAt = now
            if (status === 'DELIVERED' && !next.deliveredAt) {
              next.deliveredAt = now
              if (next.deliveryDate) {
                // keep as is
              } else {
                next.deliveryDate = now
              }
            }
            return next
          }),
        }))

        const order = get().orders.find((o) => o.id === orderId)
        const customer = order ? get().users.find((u) => u.id === order.userId) : undefined
        const driver = order?.driverId ? get().users.find((u) => u.id === order.driverId) : undefined
        if (order && customer) {
          const triggerMap: Record<OrderStatus, Parameters<typeof buildNotification>[0] | null> = {
            REQUESTED: null,
            PAYMENT_PENDING_VERIFICATION: null,
            PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',
            PICKED_UP: 'PICKED_UP',
            AT_STATION: null,
            PROCESSING: 'PROCESSING',
            FINISHING: 'FINISHING',
            OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
            DELIVERED: 'DELIVERED',
            CANCELLED: null,
          }
          const trigger = triggerMap[status]
          if (trigger) {
            get().notify({
              channel: trigger === 'PAYMENT_VERIFIED' || trigger === 'DELIVERED' ? 'SMS' : 'IN_APP',
              to: customer.name,
              orderId: order.orderNumber,
              body: buildNotification(trigger, order, customer, driver, {
                url: '/track/' + order.orderNumber,
              }),
            })
          }
        }
      },

      assignDriver: (orderId, driverId) => {
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId ? { ...o, driverId, updatedAt: new Date().toISOString() } : o
          ),
        }))
      },

      setB2BWeight: (orderId, kg, actorId) => {
        const weight = Math.max(kg, 0)
        const billableKg = Math.max(weight, B2B_PRICING.minimumKg)
        const total = billableKg * B2B_PRICING.pricePerKg
        const now = new Date().toISOString()
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, finalWeight: weight, totalPrice: total, updatedAt: now }
              : o
          ),
        }))
        const order = get().orders.find((o) => o.id === orderId)
        const customer = order ? get().users.find((u) => u.id === order.userId) : undefined
        if (order && customer) {
          get().notify({
            channel: 'SMS',
            to: customer.name,
            orderId: order.orderNumber,
            body: buildNotification('B2B_INVOICE_READY', order, customer, undefined, {
              weight,
              amount: total,
              url: '/pay/' + order.orderNumber,
            }),
          })
        }
      },

      createPayment: (input) => {
        const now = new Date().toISOString()
        const payment: Payment = {
          id: genId('p_'),
          orderId: input.orderId,
          amount: input.amount,
          method: input.method,
          status: 'PENDING',
          receiptUrl: input.receiptUrl,
          createdAt: now,
          updatedAt: now,
        }
        set((s) => ({ payments: [payment, ...s.payments] }))
        // Move the order into payment-pending-verification state (if not already)
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === input.orderId && o.status === 'REQUESTED'
              ? { ...o, status: 'PAYMENT_PENDING_VERIFICATION', updatedAt: now }
              : o
          ),
        }))
        return payment
      },

      verifyPayment: (paymentId, actorId) => {
        const now = new Date().toISOString()
        const payment = get().payments.find((p) => p.id === paymentId)
        if (!payment) return
        set((s) => ({
          payments: s.payments.map((p) =>
            p.id === paymentId
              ? { ...p, status: 'VERIFIED', verifiedAt: now, verifiedById: actorId, updatedAt: now }
              : p
          ),
        }))
        // Move the order to PAYMENT_VERIFIED
        get().updateOrderStatus(payment.orderId, 'PAYMENT_VERIFIED', actorId)
        // Push payment-confirmed notification
        const order = get().orders.find((o) => o.id === payment.orderId)
        const customer = order ? get().users.find((u) => u.id === order.userId) : undefined
        if (order && customer) {
          get().notify({
            channel: 'SMS',
            to: customer.name,
            orderId: order.orderNumber,
            body: buildNotification('PAYMENT_VERIFIED', order, customer, undefined, {
              amount: payment.amount,
            }),
          })
        }
      },

      rejectPayment: (paymentId, _actorId) => {
        set((s) => ({
          payments: s.payments.map((p) =>
            p.id === paymentId
              ? { ...p, status: 'REJECTED', updatedAt: new Date().toISOString() }
              : p
          ),
        }))
      },

      addMedia: (orderId, imageUrl, notes) => {
        const m: GarmentMedia = {
          id: genId('m_'),
          orderId,
          imageUrl,
          notes,
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ media: [m, ...s.media] }))
        return m
      },

      notify: (n) => {
        const note: NotificationTemplate = {
          ...n,
          id: genId('n_'),
          sentAt: new Date().toISOString(),
        }
        set((s) => ({ notifications: [note, ...s.notifications].slice(0, 100) }))
      },

      resetDemo: () =>
        set({
          users: SEED_USERS,
          orders: SEED_ORDERS,
          payments: SEED_PAYMENTS,
          media: SEED_MEDIA,
          notifications: SEED_NOTIFICATIONS,
          currentUserId: '',
          settings: DEFAULT_SETTINGS,
        }),
    }),
    {
      name: 'lagos-laundry-store',
      version: 3,
      // Don't persist currentUserId so it resets to a sensible default
      partialize: (s) => ({
        users: s.users,
        orders: s.orders,
        payments: s.payments,
        media: s.media,
        notifications: s.notifications,
        settings: s.settings,
      }),
      // v2: reviews moved to the database (served via /api/reviews) — any
      // reviews left over in old localStorage are simply dropped.
      // v3: garment prices now come from the server (PriceCatalog via
      // /api/settings/prices). The persisted per-browser copy is reset to
      // the current catalog defaults so stale prices from a previous visit
      // can never override what the server actually charges.
      migrate: (persisted: any, version: number) => {
        if (persisted && persisted.reviews) {
          delete persisted.reviews
        }
        if (persisted && persisted.settings) {
          persisted.settings = {
            ...persisted.settings,
            garmentPrices: Object.fromEntries(
              GARMENT_CATALOG.map((g) => [g.id, g.price])
            ),
          }
        }
        return persisted
      },
    }
  )
)

// Convenience hook for derived selectors — use plain selectors + useMemo for filtering
// to avoid Zustand v5's getSnapshot infinite loop warning.

export function useOrderById(id?: string) {
  return useStore((s) => (id ? s.orders.find((o) => o.id === id) : undefined))
}

export function useUserById(id?: string) {
  return useStore((s) => (id ? s.users.find((u) => u.id === id) : undefined))
}

export function useOrdersForUser(userId: string) {
  const orders = useStore((s) => s.orders)
  return useMemo(() => orders.filter((o) => o.userId === userId), [orders, userId])
}

export function useOrdersForDriver(driverId: string) {
  const orders = useStore((s) => s.orders)
  return useMemo(
    () =>
      orders.filter(
        (o) =>
          o.driverId === driverId &&
          ['PICKED_UP', 'OUT_FOR_DELIVERY'].includes(o.status)
      ),
    [orders, driverId]
  )
}

export function usePaymentsForOrder(orderId: string) {
  const payments = useStore((s) => s.payments)
  return useMemo(() => payments.filter((p) => p.orderId === orderId), [payments, orderId])
}

export function useMediaForOrder(orderId: string) {
  const media = useStore((s) => s.media)
  return useMemo(() => media.filter((m) => m.orderId === orderId), [media, orderId])
}

// Pipeline helper — given an order status, return the active stage index
export function pipelineIndex(status: OrderStatus): number {
  const idx = PIPELINE_STAGES.findIndex((s) => s.key === status)
  return idx === -1 ? 0 : idx
}

export type { PipelineStage }
