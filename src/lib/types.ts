// Type system for Kozy Care — Premium Drycleaning & Laundry Services
// Mirrors the Prisma schema but as plain TS types for client-side state.

export type Role = 'ADMIN' | 'STAFF' | 'DRIVER' | 'B2C' | 'B2B'

// Staff-access lifecycle (phase 31). Console roles are policed against this
// at login and on every console API call; customer roles ignore it.
export type AccessStatus = 'ACTIVE' | 'PAUSED' | 'REVOKED'

// Roles that share the Atelier Console (src/app/admin). ADMIN sees
// everything; STAFF is restricted to the operational tabs.
export const CONSOLE_ROLES: Role[] = ['ADMIN', 'STAFF']

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

// Mode of wash — customer-selected on the order form (retail orders).
// Handwash is labour-intensive per-garment care and carries a surcharge
// (percentage of the item subtotal, admin-tunable in AppSetting).
export type ModeOfWash = 'MACHINE' | 'HANDWASH'

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

// Staff member as returned by GET /api/staff (ADMIN only)
export interface StaffMember {
  id: string
  email: string
  name: string
  phone: string
  role: 'STAFF'
  accessStatus: AccessStatus
  createdAt: string
  updatedAt: string
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
  updatedAt: string
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
  // Mode of wash chosen at booking (retail orders): MACHINE | HANDWASH
  modeOfWash?: string
  // Offer code redeemed at checkout (e.g. HOTEL15), if any
  promoCode?: string
  // Delivery fee charged: 0 when the free-first-delivery applied
  deliveryFee?: number
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
  // ----- Relations (present when the API includes them; the admin modal,
  // Kanban cards and payment queue all rely on these nested objects) -----
  itemsManifest?: string // JSON string — items[] above is the parsed form
  alterationNotes?: string
  user?: {
    id?: string
    name: string
    email: string
    phone: string
    role?: string
    address?: string
  }
  driver?: { id: string; name: string; phone: string } | null
  payments?: Array<{
    id: string
    orderId: string
    amount: number
    method: string
    status: string
    receiptUrl?: string | null
    verifiedAt?: string | null
    createdAt: string
    updatedAt: string
  }>
  media?: Array<{ id: string; imageUrl: string; notes?: string | null }>
}

// =====================================================
// REVIEW — customer feedback on completed orders
// =====================================================
export interface Review {
  id: string
  orderId: string
  userId: string
  driverId?: string
  // 1-5 stars, allows halves (4.5, 5.0, etc.)
  rating: number
  comment: string
  // Public display name (defaults to user.name, admin can edit)
  displayName?: string
  // Location shown next to testimonial (e.g., "Lekki Phase 1")
  displayLocation?: string
  // Moderation: only approved reviews with rating >= 4.5 show publicly
  isApproved: boolean
  approvedAt?: string
  approvedById?: string
  // Soft-hide: even if approved, admin can hide without deleting
  isHidden: boolean
  createdAt: string
  updatedAt: string
}

// Public-facing testimonial (subset of Review shown on landing page carousel)
export interface Testimonial {
  id: string
  // Name + location to display publicly
  displayName: string
  displayLocation?: string
  rating: number
  comment: string
  // Masked order reference for order-verified reviews, e.g. "KZ-••3846".
  // Absent on starter marketing testimonials.
  orderNumberMasked?: string
  // ISO date — used to show "2 weeks ago" etc.
  createdAt: string
}

// =====================================================
// Catalog — B2C per-item pricing (in naira)
// =====================================================
export interface GarmentCatalogItem {
  id: string
  name: string
  price: number
  icon: string // path to Kozy SVG service icon
  category:
    | 'Shirts'
    | 'Trousers'
    | 'Suits'
    | 'Traditional'
    | "Women's Wear"
    | 'Outerwear'
    | 'Household'
    | 'Extras'
    | 'Shoes'
    | 'Other'
    | 'Alterations'
  // Optional one-line description shown under the item name in the booking
  // wizard — used where a bare name would be ambiguous (e.g. Lace / Aso-Ebi
  // Gown vs the general Dress vs the existing Ankara Gown).
  description?: string
  // Pricing display mode for items without a flat per-unit price:
  //  • 'from'  — price is a FLOOR ("Restoration from ₦5,000"). The item is
  //              charged at this base and the final amount is confirmed after
  //              assessment, before any work begins (admin can adjust).
  //  • 'quote' — NO fixed price (wedding dress, couture). The item is booked,
  //              assessed free of charge, then quoted for customer approval.
  //              It contributes ₦0 to the order total until the quote is set.
  pricingMode?: 'from' | 'quote'
}

export const GARMENT_CATALOG: GarmentCatalogItem[] = [
  { id: 'shirt', name: 'Shirt', price: 500, icon: '/icons/services/shirt.svg', category: 'Shirts' },
  { id: 'longsleeve', name: 'Long-Sleeve Shirt', price: 600, icon: '/icons/services/longsleeve.svg', category: 'Shirts' },
  { id: 'trouser', name: 'Trousers', price: 700, icon: '/icons/services/trouser.svg', category: 'Trousers' },
  { id: 'jeans', name: 'Jeans', price: 800, icon: '/icons/services/jeans.svg', category: 'Trousers' },
  { id: 'suit-2pc', name: 'Suit (2-Piece)', price: 4500, icon: '/icons/services/suit.svg', category: 'Suits' },
  { id: 'suit-3pc', name: 'Suit (3-Piece)', price: 5500, icon: '/icons/services/suit-3pc.svg', category: 'Suits' },
  { id: 'blazer', name: 'Blazer', price: 2500, icon: '/icons/services/blazer.svg', category: 'Suits' },
  // ── Outerwear (Phase 14 — client menu additions) ─────────
  // Going rates researched Aug 2026: Lagos lists price leather jackets at
  // ₦4,000 (specialist leather care); jean jackets sit between jeans (₦800)
  // and blazers; sweatshirt/cardigan knitwear sits between long-sleeve
  // shirts and blouses. All three are unisex → shared Outerwear group.
  {
    id: 'leather-jacket',
    name: 'Leather Jacket',
    price: 4000,
    icon: '/icons/services/leather-jacket.svg',
    category: 'Outerwear',
    description:
      'Specialist leather care — cleaned, conditioned and re-nourished to prevent cracking.',
  },
  { id: 'jean-jacket', name: 'Jean Jacket', price: 1200, icon: '/icons/services/jean-jacket.svg', category: 'Outerwear' },
  {
    id: 'sweatshirt-cardigan',
    name: 'Sweatshirt / Cardigan',
    price: 1000,
    icon: '/icons/services/sweatshirt.svg',
    category: 'Outerwear',
    description: 'Knitwear washed flat and dried to shape — no stretching, no bobbling.',
  },
  { id: 'agbada', name: 'Agbada', price: 3500, icon: '/icons/services/agbada.svg', category: 'Traditional' },
  { id: 'iro-buba', name: 'Iro & Buba', price: 2000, icon: '/icons/services/iro-buba.svg', category: 'Traditional' },
  { id: 'kaftan', name: 'Kaftan', price: 1500, icon: '/icons/services/kaftan.svg', category: 'Traditional' },
  { id: 'ankara-gown', name: 'Ankara Gown', price: 1800, icon: '/icons/services/ankara-gown.svg', category: 'Traditional' },
  // ── Women's Wear (Phase 10) ─────────────────────────────
  // Lace / Aso-Ebi Gown is the flagship item: priced well above the Ankara
  // Gown for the delicate hand-wash handling premium event fabrics need.
  { id: 'blouse', name: 'Blouse', price: 1800, icon: '/icons/services/blouse.svg', category: "Women's Wear" },
  { id: 'skirt', name: 'Skirt', price: 1800, icon: '/icons/services/skirt.svg', category: "Women's Wear" },
  { id: 'womens-dress', name: 'Dress', price: 2500, icon: '/icons/services/womens-dress.svg', category: "Women's Wear" },
  {
    id: 'lace-gown',
    name: 'Lace / Aso-Ebi Gown',
    price: 5000,
    icon: '/icons/services/lace-gown.svg',
    category: "Women's Wear",
    description:
      'Delicate lace & aso-ebi event wear, hand-washed with extra care — not for everyday ankara or cotton dresses.',
  },
  { id: 'jumpsuit', name: 'Jumpsuit', price: 2200, icon: '/icons/services/jumpsuit.svg', category: "Women's Wear" },
  { id: 'gele', name: 'Gele (Headwrap)', price: 1500, icon: '/icons/services/gele.svg', category: "Women's Wear" },
  { id: 'bedsheet', name: 'Bedsheet', price: 1200, icon: '/icons/services/bedsheet.svg', category: 'Household' },
  { id: 'duvet', name: 'Duvet', price: 2500, icon: '/icons/services/duvet.svg', category: 'Household' },
  { id: 'curtain', name: 'Curtain (per panel)', price: 1800, icon: '/icons/services/curtain.svg', category: 'Household' },
  { id: 'native-cap', name: 'Native Cap', price: 200, icon: '/icons/services/native-cap.svg', category: 'Extras' },
  { id: 'tie', name: 'Tie', price: 300, icon: '/icons/services/tie.svg', category: 'Extras' },
  { id: 'towel', name: 'Towel', price: 400, icon: '/icons/services/towel.svg', category: 'Household' },
  { id: 'singlet', name: 'Singlet', price: 300, icon: '/icons/services/singlet.svg', category: 'Shirts' },
  { id: 'mens-underwear', name: 'Men\u2019s Underwear', price: 250, icon: '/icons/services/underwear.svg', category: 'Extras' },
  { id: 'womens-underwear', name: 'Women\u2019s Underwear', price: 500, icon: '/icons/services/womens-underwear.svg', category: 'Extras' },
  { id: 'socks', name: 'Socks (per pair)', price: 200, icon: '/icons/services/socks.svg', category: 'Extras' },
  { id: 'hats', name: 'Hat', price: 500, icon: '/icons/services/hats.svg', category: 'Extras' },
  // White sneakers carry the premium (owner directive): every scuff, stain
  // and yellowing shows on white, so they take the most careful cleaning.
  // White ₦1,500 / coloured ₦1,000.
  { id: 'sneakers-white', name: 'Sneakers (White)', price: 1500, icon: '/icons/services/sneakers-white.svg', category: 'Shoes' },
  { id: 'sneakers-coloured', name: 'Sneakers (Coloured)', price: 1000, icon: '/icons/services/sneakers-coloured.svg', category: 'Shoes' },
  { id: 'leather-shoes', name: 'Leather Shoes', price: 1000, icon: '/icons/services/leather-shoes.svg', category: 'Shoes' },
  { id: 'suede-shoes', name: 'Suede Shoes', price: 2000, icon: '/icons/services/suede-shoes.svg', category: 'Shoes' },
  // ── Restoration & quoted work (Phase 13) ─────────────────
  // Restoration is assessment-first: ₦5,000 is a floor, not a flat rate —
  // the specialist inspects the pair and confirms the final quote (extent of
  // sole whitening, repaint area, repairs) before any work begins. A pair
  // that is beyond restoration is turned down at the free assessment, not
  // discovered after pickup (owner directive — no wasted trips).
  {
    id: 'sneaker-restoration',
    name: 'Sneaker Restoration',
    price: 5000,
    icon: '/icons/services/sneaker-restoration.svg',
    category: 'Shoes',
    pricingMode: 'from',
    description:
      'From ₦5,000 — sole whitening, repaints, repairs. Free assessment first; we quote before any work begins.',
  },
  // Wedding dresses & couture are never flat-priced: beading, train length
  // and fabric all change the work. The customer books the pickup, we assess
  // free of charge, and send a quote for approval before touching the piece.
  // price: 0 keeps it out of the subtotal; displays read "By quote".
  {
    id: 'other-couture',
    name: 'Other — Wedding Dress & Couture',
    price: 0,
    icon: '/icons/services/other-couture.svg',
    category: 'Other',
    pricingMode: 'quote',
    description:
      'Wedding dresses, couture & bespoke pieces. Quoted after a free assessment — you approve before we start.',
  },
  // ── Alterations (Phase 17 — client directive) ────────────
  // One bookable quote item per garment. The CUSTOMER describes the issue at
  // booking (wizard collects a guided note — riders never measure at the
  // door); the in-house seamstress assesses each piece at the studio, calls
  // to confirm detail if needed, and sends the quote for approval before
  // anything is sewn. price: 0 + pricingMode 'quote' keeps it out of the
  // subtotal until the quote is set.
  {
    id: 'alteration',
    name: 'Alteration / Repair (per garment)',
    price: 0,
    icon: '/icons/services/alteration.svg',
    category: 'Alterations',
    pricingMode: 'quote',
    description:
      'Hems, waist, sleeves, zips, buttons, traditional wear — describe the work when booking; the seamstress quotes before she sews.',
  },
]

// =====================================================
// SERVICE SPEED — turnaround tiers for retail (ITEM) orders
// =====================================================
// Market research (2026): express dry cleaning typically runs
//   • next-day / 48h express: +25–50% over standard rates
//   • same-day / 24h express: +50–100% over standard rates
// Kozy's client survey puts the Lagos standard at 3–5 days, so speed is
// sold as a premium rather than given away free. Surcharges sit in the
// upper half of the industry band because Kozy is a premium brand that
// also fronts pickup + delivery logistics on every express order.
export type ServiceSpeed = 'STANDARD' | 'EXPRESS_48' | 'EXPRESS_24'

export interface ServiceSpeedOption {
  id: ServiceSpeed
  label: string
  /** Customer-facing turnaround promise */
  window: string
  /** Surcharge as a fraction of the item subtotal (0 / 0.5 / 1.0) */
  surcharge: number
  description: string
  /** Master switch — flip to false to pull a tier off the market instantly */
  enabled: boolean
}

export const SERVICE_SPEEDS: ServiceSpeedOption[] = [
  {
    id: 'STANDARD',
    label: 'Standard',
    window: '3–5 days',
    surcharge: 0,
    description: 'Careful cleaning, pressing and packaging. Our usual thorough window.',
    enabled: true,
  },
  {
    id: 'EXPRESS_48',
    label: 'Express 48',
    window: '48 hours',
    surcharge: 0.5,
    description: 'Your items jump the queue — cleaned, pressed and back within 2 days of pickup.',
    enabled: true,
  },
  {
    id: 'EXPRESS_24',
    label: 'Express 24',
    window: '24 hours',
    surcharge: 1.0,
    description: 'Next-day return from pickup. Not available for bulky home items (duvets, curtains).',
    enabled: true,
  },
]

export function getServiceSpeed(id: string | null | undefined): ServiceSpeedOption {
  return SERVICE_SPEEDS.find((s) => s.id === id) ?? SERVICE_SPEEDS[0]
}

/** True when an order with these garment ids may use the 24-hour tier.
 *  Bulky household items (duvets, curtains, bedsheets) physically cannot be
 *  washed, dried and finished in 24 hours — the promise would be dishonest. */
export function allowsExpress24(itemIds: string[]): boolean {
  return !itemIds.some((id) => GARMENT_CATALOG.find((g) => g.id === id)?.category === 'Household')
}

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

// =====================================================
// PHASE 14 — server-managed commercial settings (AppSetting table)
// =====================================================
// These defaults ship in code; the admin can override every one of them in
// Settings (they live in the DB so an edit reaches ALL visitors instantly —
// the previous localStorage copy was per-browser and never propagated).

/** Flat delivery fee for every delivery AFTER the free first one.
 *  Research (Aug 2026): Lagos dispatch platforms default to ₦800/order and
 *  island routes (Ikoyi→Lekki) typically run ₦1,000–₦2,500 — ₦1,500 sits
 *  mid-market for a premium brand that fronts the logistics. */
export const DEFAULT_DELIVERY_FEE = 1500

/** Handwash surcharge as a share of the item subtotal. Lagos delicate-care
 *  lists (e.g. "Caftan (Delicate) ₦2,500" vs ₦1,500–2,000 regular) price
 *  hand-finished pieces ~25–60% above standard — 50% is the mid-band and
 *  simple to communicate. Admin-tunable. */
export const DEFAULT_HANDWASH_SURCHARGE_PERCENT = 50

/** First-order discount for every new customer (10% — client directive
 *  Aug 2026: "make it 10% off first order because you already give 5% for
 *  uploading pic"). The picture-upload guarantee discount (5%) is separate
 *  and stacks with it. */
export const FIRST_ORDER_DISCOUNT_PERCENT = 10

/** Permanent online-order discount (phase-30, client directive Sep 2026:
 *  "5% discount on all orders made online, always — to ensure people get
 *  registered"). Applied to every order placed by a SIGNED-IN customer —
 *  guests deliberately don't get it (the wizard shows them the sign-in
 *  offer instead, which is the whole registration incentive). Stacks with
 *  the guarantee 5% and the first-order/hotel offers; the combined
 *  percentage discount stays capped server-side at 95%. Admin-tunable in
 *  Settings → Discounts & Offers (0 switches it off). */
export const ONLINE_ORDER_DISCOUNT_PERCENT = 5

/** Hotel & corporate first-order offer: 15% + the 5% picture discount.
 *  Hotels (corporate clients) are already high-value customers who bring
 *  volume, so they earn the better deal. Redeemed with the offer code
 *  HOTEL15 at checkout. */
export const HOTEL_GUEST_DISCOUNT_PERCENT = 15
export const HOTEL_GUEST_PROMO_CODE = 'HOTEL15'

/** Guarantee eligibility (client directive: "be more transparent on what's
 *  considered eligible — a certain number of garments or amount of total
 *  order"). An order qualifies when EITHER threshold is met. Admin-tunable. */
export const DEFAULT_GUARANTEE_MIN_GARMENTS = 2
export const DEFAULT_GUARANTEE_MIN_ORDER_VALUE = 2500

/** The typed shape returned by GET /api/settings/app. */
export interface KozyAppSettings {
  // Bank account shown at checkout (bank transfer)
  bankName: string
  accountName: string
  accountNumber: string
  // Contact
  contactPhone: string
  contactEmail: string
  // Admin alert emails — where the business owner gets pinged when a new
  // customer signs up, a new order arrives, or a customer says they've paid
  // (bank-transfer verification requests). All three types can be toggled.
  adminAlertsEmail: string
  adminAlertsNewSignup: boolean
  adminAlertsNewOrder: boolean
  adminAlertsPaymentPending: boolean
  // Commercial terms
  deliveryFee: number
  handwashSurchargePercent: number
  guaranteeMinGarments: number
  guaranteeMinOrderValue: number
  firstOrderDiscountPercent: number
  hotelGuestDiscountPercent: number
  hotelGuestPromoCode: string
  // Permanent online-order discount for registered customers (phase-30).
  // 0 disables it. Applied server-side at checkout (ITEM orders) and on the
  // bulk invoice (KG orders) — never a client-supplied number.
  onlineOrderDiscountPercent: number
  // Alterations — "Exclusive to Kozy Care"; pricing confirmed with the
  // tailor, so the site says "quoted after assessment" until set (> 0).
  alterationsFromPrice: number
  // Corporate / bulk (per-kg) pricing — charged when the admin records an
  // order's final weight. Server-managed so the invoice the customer
  // receives is computed from the SAME number the admin edited in Settings
  // (previously the API hardcoded ₦800/kg while the admin UI edits only
  // reached this browser's localStorage).
  pricePerKg: number
  minimumKg: number
  // Card payments (Paystack) — NOT stored in the DB: derived server-side
  // from the presence of PAYSTACK_SECRET_KEY on each /api/settings/app
  // read. When false, checkout greys the card option out and transfer is
  // the only payment path.
  paystackAvailable: boolean
}

/** Code defaults for every app setting — CLIENT-SAFE (no server imports).
 *  Used as the fallback whenever /api/settings/app is unreachable, and
 *  self-seeded into the AppSetting table on first server read. */
export function defaultAppSettings(): KozyAppSettings {
  return {
    bankName: COMPANY_BANK.bankName,
    accountName: COMPANY_BANK.accountName,
    accountNumber: COMPANY_BANK.accountNumber,
    contactPhone: '+234 803 175 5230',
    contactEmail: 'kozygarmentcare@gmail.com',
    // The owners' inboxes (client-requested) — the setting accepts a
    // comma-separated LIST so alerts can reach every stakeholder. Changeable
    // in admin Settings → Notifications without a redeploy.
    adminAlertsEmail: 'kozygarmentcare@gmail.com,practiceprosystems@gmail.com',
    adminAlertsNewSignup: true,
    adminAlertsNewOrder: true,
    adminAlertsPaymentPending: true,
    deliveryFee: DEFAULT_DELIVERY_FEE,
    handwashSurchargePercent: DEFAULT_HANDWASH_SURCHARGE_PERCENT,
    guaranteeMinGarments: DEFAULT_GUARANTEE_MIN_GARMENTS,
    guaranteeMinOrderValue: DEFAULT_GUARANTEE_MIN_ORDER_VALUE,
    firstOrderDiscountPercent: FIRST_ORDER_DISCOUNT_PERCENT,
    hotelGuestDiscountPercent: HOTEL_GUEST_DISCOUNT_PERCENT,
    hotelGuestPromoCode: HOTEL_GUEST_PROMO_CODE,
    onlineOrderDiscountPercent: ONLINE_ORDER_DISCOUNT_PERCENT,
    // 0 = pricing not confirmed with the tailor yet → the storefront shows
    // "quoted after assessment" instead of a from-price.
    alterationsFromPrice: 0,
    // Bulk pricing defaults mirror the live AppSetting values.
    pricePerKg: B2B_PRICING.pricePerKg,
    minimumKg: B2B_PRICING.minimumKg,
    // Pessimistic client default — the server response overrides it with
    // the real env-derived value. Greyed out beats a broken card checkout.
    paystackAvailable: false,
  }
}

// Bank account details for manual transfers.
// Defaults mirror the LIVE AppSetting values (set by the client in admin
// Settings) so a fresh environment never seeds a placeholder account that
// customers could transfer real money to. The AppSetting table is the
// source of truth at runtime — this constant only seeds/fallbacks.
export const COMPANY_BANK = {
  bankName: 'Noel Bank',
  accountName: 'Kozy Cleaning Services Ltd',
  accountNumber: '8123456789',
  routingNumber: '',
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

// Kanban columns for admin board. REQUESTED is included so orders that
// were booked without a payment record yet (e.g. card payments, if
// Paystack is ever re-enabled, or admin-created orders) are still visible
// and can be advanced — previously they were unreachable from the board.
export const KANBAN_COLUMNS: OrderStatus[] = [
  'REQUESTED',
  'PAYMENT_PENDING_VERIFICATION',
  'PAYMENT_VERIFIED',
  'PICKED_UP',
  'AT_STATION',
  'PROCESSING',
  'FINISHING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]

// Linear rank of each pipeline stage (matches PIPELINE_STAGES order).
// Used for stage-email dedup: a customer is emailed about a stage ONLY when
// its rank is strictly higher than any stage they've already been emailed
// about (Order.lastNotifiedStage). Non-pipeline statuses rank -1 — their
// emails (payment-pending, cancelled) are event-driven, not progress, so
// they are exempt from the monotonic rule.
export const STAGE_RANK: Record<string, number> = {
  REQUESTED: 0,
  PAYMENT_VERIFIED: 1,
  PICKED_UP: 2,
  AT_STATION: 3,
  PROCESSING: 4,
  FINISHING: 5,
  OUT_FOR_DELIVERY: 6,
  DELIVERED: 7,
  PAYMENT_PENDING_VERIFICATION: -1,
  CANCELLED: -1,
}

// =====================================================
// Notification events — the admins' in-app operations feed
// =====================================================
export type NotificationEventType =
  | 'NEW_SIGNUP'
  | 'NEW_ORDER'
  | 'TRANSFER_PENDING'
  | 'FEEDBACK'
  | 'RIDER_APPLICATION'
  | 'STAFF_INVITE'
  | 'TEST'

export type NotificationEmailStatus = 'NONE' | 'DISABLED' | 'SENT' | 'PARTIAL' | 'FAILED'

export interface NotificationEvent {
  id: string
  type: NotificationEventType
  title: string
  body: string
  data?: string
  linkTab?: string
  recipients?: string
  emailStatus: NotificationEmailStatus
  emailDetail?: string
  readAt?: string
  createdAt: string
}

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
      return `Goods Received! Items collected by ${driver?.name ?? 'our rider'}. Track: ${extra?.url ?? '/portal'}`
    case 'B2B_INVOICE_READY':
      return `Order #${order.orderNumber} weighed ${extra?.weight}kg. Total: ₦${extra?.amount?.toLocaleString('en-NG')}. Pay here: ${extra?.url ?? '/portal'}`
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
