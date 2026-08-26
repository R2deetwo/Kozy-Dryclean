// Zustand store for Kozy Drycleaning and Laundry Services.
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
  Review,
  Testimonial,
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
    email: 'concierge@kozy.ng',
    name: 'Adaeze Okonkwo',
    phone: '+234 802 111 2233',
    role: 'ADMIN',
    address: 'Kozy Atelier, 12 Gerard Rd, Ikoyi, Lagos',
    createdAt: '2025-01-15T08:00:00.000Z',
  },
  {
    id: 'u-driver-1',
    email: 'tunde@kozy.ng',
    name: 'Tunde Balogun',
    phone: '+234 803 222 4455',
    role: 'DRIVER',
    address: 'Allen Avenue, Ikeja, Lagos',
    createdAt: '2025-02-01T08:00:00.000Z',
  },
  {
    id: 'u-driver-2',
    email: 'bisi@kozy.ng',
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
    body: 'Delivered! Order #KZ-1001 is complete. Rate your experience: /rate/KZ-1001',
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
// Seed reviews — public testimonials for the landing carousel.
// All approved + rating >= 4.5 so they show on the public site.
// (Admin can add more via the moderation view, or customers can submit
// reviews via /review/[orderId] after their order is delivered.)
// =====================================================
const SEED_REVIEWS: Review[] = [
  {
    id: 'r-1',
    orderId: 'seed-1',
    userId: 'seed-user-1',
    rating: 5,
    comment: "Kozy picked up my agbada and iro set from Lekki, returned it the next morning pressed to perfection. The driver was polite and the fabric came back in better condition than I expected. This is how dry cleaning should work in Lagos.",
    displayName: 'Chioma E.',
    displayLocation: 'Lekki Phase 1, Lagos',
    isApproved: true,
    approvedAt: '2026-08-21T08:00:00.000Z',
    approvedById: 'admin',
    isHidden: false,
    createdAt: '2026-08-20T18:00:00.000Z',
    updatedAt: '2026-08-21T08:00:00.000Z',
  },
  {
    id: 'r-2',
    orderId: 'seed-2',
    userId: 'seed-user-2',
    rating: 5,
    comment: "I've used three dry cleaners in Lagos before Kozy and always had issues — lost buttons, late returns, no pickup. Kozy collected my shirts at 8am and had them back by 6pm. The condition-capture photos gave me real peace of mind. Worth every naira.",
    displayName: 'Tunde A.',
    displayLocation: 'Ikoyi, Lagos',
    isApproved: true,
    approvedAt: '2026-08-22T10:00:00.000Z',
    approvedById: 'admin',
    isHidden: false,
    createdAt: '2026-08-22T07:30:00.000Z',
    updatedAt: '2026-08-22T10:00:00.000Z',
  },
  {
    id: 'r-3',
    orderId: 'seed-3',
    userId: 'seed-user-3',
    rating: 4.5,
    comment: "Booked a corporate pickup for our office linens — 28kg of shirts and towels. Bisi the driver showed up exactly on the scheduled slot and weighed everything transparently at our office. Invoice was clean and itemised. Will be using them monthly.",
    displayName: 'Adaeze M.',
    displayLocation: 'Victoria Island, Lagos',
    isApproved: true,
    approvedAt: '2026-08-23T14:00:00.000Z',
    approvedById: 'admin',
    isHidden: false,
    createdAt: '2026-08-23T09:00:00.000Z',
    updatedAt: '2026-08-23T14:00:00.000Z',
  },
  {
    id: 'r-4',
    orderId: 'seed-4',
    userId: 'seed-user-4',
    rating: 5,
    comment: "My suede shoes came back looking new. I was nervous about trusting anyone with suede in Lagos but Kozy handled them properly — no water marks, no shrinkage. The pickup confirmation was instant and I could track the order through every stage.",
    displayName: 'Emeka O.',
    displayLocation: 'Ikeja, Lagos',
    isApproved: true,
    approvedAt: '2026-08-24T11:00:00.000Z',
    approvedById: 'admin',
    isHidden: false,
    createdAt: '2026-08-24T08:15:00.000Z',
    updatedAt: '2026-08-24T11:00:00.000Z',
  },
  {
    id: 'r-5',
    orderId: 'seed-5',
    userId: 'seed-user-5',
    rating: 5,
    comment: "Three-piece suit, white sneakers, and my wife's Ankara gown — all in one pickup, all back the next day. The Return-as-Received guarantee with photos is a real differentiator. This is the most professional laundry service I've used in Nigeria.",
    displayName: 'Babajide K.',
    displayLocation: 'Yaba, Lagos',
    isApproved: true,
    approvedAt: '2026-08-25T09:00:00.000Z',
    approvedById: 'admin',
    isHidden: false,
    createdAt: '2026-08-25T07:00:00.000Z',
    updatedAt: '2026-08-25T09:00:00.000Z',
  },
  {
    id: 'r-6',
    orderId: 'seed-6',
    userId: 'seed-user-6',
    rating: 4.5,
    comment: "Used Kozy for our hotel's weekly linen service for two months now. Consistent quality, predictable per-kilogram pricing, and the rider always picks up on the same day. The dashboard makes our accounts team's job easier.",
    displayName: 'Hotel Operations',
    displayLocation: 'Ikoyi, Lagos',
    isApproved: true,
    approvedAt: '2026-08-26T10:00:00.000Z',
    approvedById: 'admin',
    isHidden: false,
    createdAt: '2026-08-26T08:00:00.000Z',
    updatedAt: '2026-08-26T10:00:00.000Z',
  },
]

// =====================================================
// Default admin-managed settings
// =====================================================
const DEFAULT_SETTINGS: KozySettings = {
  bankName: COMPANY_BANK.bankName,
  accountName: COMPANY_BANK.accountName,
  accountNumber: COMPANY_BANK.accountNumber,
  contactPhone: '+234 800 569 3789',
  contactEmail: 'concierge@kozy.ng',
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
  reviews: Review[]
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

  // reviews / testimonials
  createReview: (input: {
    orderId: string
    userId: string
    driverId?: string
    rating: number
    comment: string
    displayName?: string
    displayLocation?: string
  }) => Review | { error: string }
  approveReview: (reviewId: string, adminId: string) => void
  rejectReview: (reviewId: string) => void
  hideReview: (reviewId: string) => void
  // Returns only approved + rating >= 4.5 reviews (the public testimonials)
  getPublicTestimonials: () => Testimonial[]

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
      reviews: SEED_REVIEWS,
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

      // ===== Reviews / Testimonials =====
      createReview: (input) => {
        const { orders, reviews } = get()
        // Validate order exists and is delivered
        const order = orders.find((o) => o.id === input.orderId || o.orderNumber === input.orderId)
        if (!order) return { error: 'Order not found' }
        if (order.status !== 'DELIVERED') return { error: 'You can only review delivered orders' }
        // One review per order
        if (reviews.some((r) => r.orderId === order.id)) {
          return { error: 'This order has already been reviewed' }
        }
        // Validate rating range
        if (input.rating < 1 || input.rating > 5) return { error: 'Rating must be between 1 and 5' }
        const now = new Date().toISOString()
        const review: Review = {
          id: genId('r_'),
          orderId: order.id,
          userId: input.userId,
          driverId: input.driverId ?? order.driverId,
          rating: Math.round(input.rating * 2) / 2, // snap to nearest 0.5
          comment: input.comment.trim(),
          displayName: input.displayName?.trim() || undefined,
          displayLocation: input.displayLocation?.trim() || undefined,
          // Auto-approve if rating >= 4.5 (still subject to admin moderation via hide toggle)
          // — this lets happy customers' reviews show immediately, while lower ratings
          // stay pending for admin review.
          isApproved: input.rating >= 4.5,
          approvedAt: input.rating >= 4.5 ? now : undefined,
          approvedById: input.rating >= 4.5 ? 'auto' : undefined,
          isHidden: false,
          createdAt: now,
          updatedAt: now,
        }
        set((s) => ({ reviews: [review, ...s.reviews] }))
        return review
      },

      approveReview: (reviewId, adminId) => {
        const now = new Date().toISOString()
        set((s) => ({
          reviews: s.reviews.map((r) =>
            r.id === reviewId
              ? { ...r, isApproved: true, approvedAt: now, approvedById: adminId, updatedAt: now }
              : r
          ),
        }))
      },

      rejectReview: (reviewId) => {
        // "Reject" = unapprove (review stays in DB for admin records but won't show publicly)
        const now = new Date().toISOString()
        set((s) => ({
          reviews: s.reviews.map((r) =>
            r.id === reviewId
              ? { ...r, isApproved: false, approvedAt: undefined, approvedById: undefined, updatedAt: now }
              : r
          ),
        }))
      },

      hideReview: (reviewId) => {
        const now = new Date().toISOString()
        set((s) => ({
          reviews: s.reviews.map((r) =>
            r.id === reviewId ? { ...r, isHidden: !r.isHidden, updatedAt: now } : r
          ),
        }))
      },

      getPublicTestimonials: () => {
        const { reviews, users } = get()
        return reviews
          .filter((r) => r.isApproved && !r.isHidden && r.rating >= 4.5)
          .map((r) => ({
            id: r.id,
            displayName: r.displayName || users.find((u) => u.id === r.userId)?.name || 'Verified Customer',
            displayLocation: r.displayLocation,
            rating: r.rating,
            comment: r.comment,
            createdAt: r.createdAt,
          }))
          .slice(0, 12) // cap at 12 for the carousel
      },

      resetDemo: () =>
        set({
          users: SEED_USERS,
          orders: SEED_ORDERS,
          payments: SEED_PAYMENTS,
          media: SEED_MEDIA,
          notifications: SEED_NOTIFICATIONS,
          reviews: SEED_REVIEWS,
          currentUserId: '',
          settings: DEFAULT_SETTINGS,
        }),
    }),
    {
      name: 'lagos-laundry-store',
      version: 2,
      // Don't persist currentUserId so it resets to a sensible default
      partialize: (s) => ({
        users: s.users,
        orders: s.orders,
        payments: s.payments,
        media: s.media,
        notifications: s.notifications,
        reviews: s.reviews,
        settings: s.settings,
      }),
      // v2 migration: add reviews array if loading from v1 localStorage
      migrate: (persisted: any, version: number) => {
        if (version < 2 && persisted && !persisted.reviews) {
          persisted.reviews = SEED_REVIEWS
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
