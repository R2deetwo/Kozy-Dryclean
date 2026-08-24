// Type system for Kozy Drycleaning and Laundry Services
// Mirrors the Prisma schema but as plain TS types for client-side state.

export type Role = 'ADMIN' | 'DRIVER' | 'B2C' | 'B2B'

export type OrderStatus =
  | 'REQUESTED'
  | 'PAYMENT_PENDING_VERIFICATION'
  | 'PAYMENT_VERIFIED'
  | 'PICKED_UP'
  | 'AT_STATION'
  | 'PROCESSING'
  | 'FINISHING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'

export type OrderType = 'ITEM' | 'KG'

export type PaymentMethod = 'BANK_TRANSFER' | 'PAYSTACK'
export type PaymentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'

export interface User {
  id: string
  email: string
  name: string
  phone: string
  address?: string
  role: Role
  // Company name for corporate clients
  company?: string
  createdAt: string
}

export interface GarmentMedia {
  id: string
  orderId: string
  imageUrl: string // data URL or remote URL
  notes?: string
  createdAt: string
}

export interface Payment {
  id: string
  orderId: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  receiptUrl?: string
  paystackRef?: string
  verifiedAt?: string
  verifiedById?: string
  createdAt: string
}

export interface StatusEvent {
  id: string
  orderId: string
  status: OrderStatus
  note?: string
  actorId?: string
  createdAt: string
}

export interface OrderItem {
  id: string
  name: string
  quantity: number
  unitPrice: number // naira
}

export interface Order {
  id: string
  orderNumber: string // human-readable like KZ-1024
  userId: string
  driverId?: string
  status: OrderStatus
  type: OrderType
  finalWeight?: number // kg, for B2B
  totalPrice?: number
  guaranteeActive: boolean
  items: OrderItem[] // for B2C
  pickupAddress: string
  pickupDate: string
  pickupTimeSlot: string
  deliveryAddress?: string
  deliveryDate?: string
  pickedUpAt?: string
  atStationAt?: string
  processingAt?: string
  finishingAt?: string
  outForDeliveryAt?: string
  deliveredAt?: string
  createdAt: string
  updatedAt: string
}

// =====================================================
// Catalog — B2C per-item pricing (in naira)
// =====================================================
export interface GarmentCatalogItem {
  id: string
  name: string
  price: number
  icon: string // path to Kozy SVG service icon
  category: 'Shirts' | 'Trousers' | 'Suits' | 'Traditional' | 'Household' | 'Extras'
}

export const GARMENT_CATALOG: GarmentCatalogItem[] = [
  { id: 'shirt', name: 'Shirt', price: 500, icon: '/icons/services/shirt.svg', category: 'Shirts' },
  { id: 'longsleeve', name: 'Long-Sleeve Shirt', price: 600, icon: '/icons/services/longsleeve.svg', category: 'Shirts' },
  { id: 'trouser', name: 'Trousers', price: 700, icon: '/icons/services/trouser.svg', category: 'Trousers' },
  { id: 'jeans', name: 'Jeans', price: 800, icon: '/icons/services/jeans.svg', category: 'Trousers' },
  { id: 'suit-2pc', name: 'Suit (2-Piece)', price: 4500, icon: '/icons/services/suit.svg', category: 'Suits' },
  { id: 'suit-3pc', name: 'Suit (3-Piece)', price: 5500, icon: '/icons/services/suit-3pc.svg', category: 'Suits' },
  { id: 'blazer', name: 'Blazer', price: 2500, icon: '/icons/services/blazer.svg', category: 'Suits' },
  { id: 'agbada', name: 'Agbada', price: 3500, icon: '/icons/services/agbada.svg', category: 'Traditional' },
  { id: 'iro-buba', name: 'Iro & Buba', price: 2000, icon: '/icons/services/iro-buba.svg', category: 'Traditional' },
  { id: 'kaftan', name: 'Kaftan', price: 1500, icon: '/icons/services/kaftan.svg', category: 'Traditional' },
  { id: 'ankara-gown', name: 'Ankara Gown', price: 1800, icon: '/icons/services/ankara-gown.svg', category: 'Traditional' },
  { id: 'bedsheet', name: 'Bedsheet', price: 1200, icon: '/icons/services/bedsheet.svg', category: 'Household' },
  { id: 'duvet', name: 'Duvet', price: 2500, icon: '/icons/services/duvet.svg', category: 'Household' },
  { id: 'curtain', name: 'Curtain (per panel)', price: 1800, icon: '/icons/services/curtain.svg', category: 'Household' },
  { id: 'native-cap', name: 'Native Cap', price: 200, icon: '/icons/services/native-cap.svg', category: 'Extras' },
  { id: 'tie', name: 'Tie', price: 300, icon: '/icons/services/tie.svg', category: 'Extras' },
]

// =====================================================
// B2B pricing — per-KG tiered structure
// =====================================================
export const B2B_PRICING = {
  pricePerKg: 800, // naira per kg
  minimumKg: 10, // minimum billable weight
  minimumCharge: 8000, // 10kg * 800
}

// B2C condition-capture incentive
export const GUARANTEE_DISCOUNT = 0.05 // 5% off when photos uploaded

// Bank account details for manual transfers (demo)
export const COMPANY_BANK = {
  bankName: 'Guaranty Trust Bank (GTB)',
  accountName: 'Kozy Premium Dry Cleaning Ltd',
  accountNumber: '0123456789',
  routingNumber: '058152069',
}

// =====================================================
// ADMIN SETTINGS — bank account, pricing, etc. (managed by admin)
// =====================================================
export interface KozySettings {
  // Bank account details shown to customers during checkout
  bankName: string
  accountName: string
  accountNumber: string
  // Contact info shown across the app
  contactPhone: string
  contactEmail: string
  atelierAddress: string
  // B2B pricing
  pricePerKg: number
  minimumKg: number
  // Guarantee
  guaranteeDiscountPercent: number // e.g. 5 for 5%
  // Garment prices (keyed by garment id from GARMENT_CATALOG)
  garmentPrices: Record<string, number>
}

// Order pipeline stages for visual tracking
export interface PipelineStage {
  key: OrderStatus
  label: string
  short: string
  description: string
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { key: 'REQUESTED', label: 'Requested', short: '1', description: 'Pickup booked' },
  { key: 'PAYMENT_VERIFIED', label: 'Payment Confirmed', short: '2', description: 'Payment received & verified' },
  { key: 'PICKED_UP', label: 'Picked Up', short: '3', description: 'Goods received by rider' },
  { key: 'AT_STATION', label: 'At Station', short: '4', description: 'Items logged at our facility' },
  { key: 'PROCESSING', label: 'Processing', short: '5', description: 'Washing & treatment underway' },
  { key: 'FINISHING', label: 'Finishing', short: '6', description: 'Ironing & packaging' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', short: '7', description: 'Rider en route to you' },
  { key: 'DELIVERED', label: 'Delivered', short: '8', description: 'Order complete' },
]

// Kanban columns for admin board (subset of pipeline that is operationally relevant)
export const KANBAN_COLUMNS: OrderStatus[] = [
  'PAYMENT_PENDING_VERIFICATION',
  'PAYMENT_VERIFIED',
  'PICKED_UP',
  'AT_STATION',
  'PROCESSING',
  'FINISHING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]

export function formatNaira(amount: number): string {
  return '₦' + Math.round(amount).toLocaleString('en-NG')
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// =====================================================
// Notification templates (master prompt section 5)
// =====================================================
export interface NotificationTemplate {
  id: string
  channel: 'SMS' | 'EMAIL' | 'IN_APP'
  to: string // recipient name
  orderId: string
  body: string
  sentAt: string
}

export function buildNotification(
  trigger:
    | 'BOOKING_PLACED'
    | 'PICKED_UP'
    | 'B2B_INVOICE_READY'
    | 'PROCESSING'
    | 'FINISHING'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'PAYMENT_VERIFIED',
  order: Order,
  user: User,
  driver?: User,
  extra?: { weight?: number; amount?: number; url?: string }
): string {
  switch (trigger) {
    case 'BOOKING_PLACED':
      return `Hi ${user.name.split(' ')[0]}, your pickup (#${order.orderNumber}) is booked for ${formatDate(order.pickupDate)}.`
    case 'PICKED_UP':
      return `Goods Received! Items collected by ${driver?.name ?? 'our rider'}. Track: ${extra?.url ?? '/track/' + order.orderNumber}`
    case 'B2B_INVOICE_READY':
      return `Order #${order.orderNumber} weighed ${extra?.weight}kg. Total: ₦${extra?.amount?.toLocaleString('en-NG')}. Pay here: ${extra?.url ?? '/pay/' + order.orderNumber}`
    case 'PROCESSING':
      return `Your garments are now being washed and treated. Order #${order.orderNumber}.`
    case 'FINISHING':
      return `Almost done! Order #${order.orderNumber} is undergoing ironing and packaging.`
    case 'OUT_FOR_DELIVERY':
      return `On the way! ${driver?.name ?? 'Our rider'} is delivering your laundry. Call: ${driver?.phone ?? ''}`
    case 'DELIVERED':
      return `Delivered! Order #${order.orderNumber} is complete. Rate your experience: ${extra?.url ?? '/rate/' + order.orderNumber}`
    case 'PAYMENT_VERIFIED':
      return `Payment Confirmed! ₦${(extra?.amount ?? 0).toLocaleString('en-NG')} received for Order #${order.orderNumber}. Thank you!`
  }
}
