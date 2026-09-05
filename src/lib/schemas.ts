// =============================================================================
// Zod schemas for API request/response validation
// =============================================================================
// These match the Prisma enums EXACTLY. If you change a Prisma enum, update
// the corresponding Zod enum here too.
// =============================================================================

import { z } from 'zod'
import { EMAIL_REGEX, EMAIL_HELP } from '@/lib/email-validation'

// ----- Enums (must match prisma/schema.prisma) -----
export const RoleSchema = z.enum(['ADMIN', 'STAFF', 'DRIVER', 'B2C', 'B2B'])
// Staff-access lifecycle (phase 31) — mirrors User.accessStatus in
// prisma/schema.prisma (a String column, not an enum, so adding future
// states needs no migration).
export const AccessStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'REVOKED'])
export const OrderStatusSchema = z.enum([
  'REQUESTED',
  'PAYMENT_PENDING_VERIFICATION',
  'PAYMENT_VERIFIED',
  'PICKED_UP',
  'AT_STATION',
  'PROCESSING',
  'FINISHING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
])
export const OrderTypeSchema = z.enum(['ITEM', 'KG'])
export const ServiceSpeedSchema = z.enum(['STANDARD', 'EXPRESS_48', 'EXPRESS_24'])
export const PaymentMethodSchema = z.enum(['BANK_TRANSFER', 'PAYSTACK'])
export const PaymentStatusSchema = z.enum(['PENDING', 'VERIFIED', 'REJECTED'])

// ----- Order schemas -----
export const OrderItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(), // server computes from PriceCatalog — client value is ignored
})

// ----- Guest checkout -----
// Lets a visitor place an order without signing up first. The server
// find-or-creates a customer record from these details.
export const GuestInfoSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  // Strict shape (dotted domain + TLD) — the same rule the signup form now
  // enforces. Zod's default .email() still accepts "name@gmail", which once
  // created an unreachable guest account.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(255)
    .regex(EMAIL_REGEX, EMAIL_HELP),
  phone: z.string().min(7, 'Phone number is required').max(20),
})

export const CreateOrderSchema = z.object({
  type: OrderTypeSchema,
  items: z.array(OrderItemSchema).optional().default([]),
  guaranteeActive: z.boolean().optional().default(false),
  // Turnaround tier (retail only — KG orders are always STANDARD; the server
  // enforces this and prices the surcharge itself, never trusting the client)
  serviceSpeed: ServiceSpeedSchema.optional().default('STANDARD'),
  // Mode of wash (retail orders) — required by the order form. Machine wash
  // is standard; handwash carries a per-item surcharge priced server-side.
  modeOfWash: z.enum(['MACHINE', 'HANDWASH']).optional(),
  // Optional offer code (e.g. HOTEL15 for the hotel & corporate first-order
  // deal). Validated and priced server-side — an unknown/inactive code is
  // ignored with a warning instead of failing the booking.
  promoCode: z.string().trim().max(24).optional(),
  // Alterations (Phase 17): the customer's description of the alteration work
  // (what changes on which garment). REQUIRED by the server whenever the
  // manifest contains an alterations item — the seamstress works from this
  // note; riders never measure at the door.
  alterationNotes: z.string().trim().max(1500, 'Alteration notes are too long (max 1500 characters)').optional(),
  pickupAddress: z.string().min(1, 'Pickup address is required'),
  pickupDate: z.string().min(1, 'Pickup date is required'), // ISO string
  pickupTimeSlot: z.string().min(1, 'Pickup time slot is required'),
  deliveryAddress: z.string().optional(),
  // Guest contact details — required when there is no session
  guest: GuestInfoSchema.optional(),
  // When provided, the payment record is created server-side as part of the
  // order (single atomic request — also works for guests, who cannot call
  // POST /api/payments). PAYSTACK payments are initialized separately.
  paymentMethod: PaymentMethodSchema.optional(),
  // Optional transfer-receipt screenshot (bank-transfer checkout). The client
  // downscales it before sending; stored as a data URL on the payment record
  // so the admin verification queue shows the real thing. Size-capped to keep
  // the request body and DB row sane.
  transferReceipt: z
    .string()
    .startsWith('data:image/', 'Receipt must be an image')
    .max(1_500_000, 'Receipt image is too large (max ~1.1MB)')
    .optional(),
  // Condition photos (Return-as-Received Guarantee evidence). The client
  // downscales each to a compact JPEG data URL; the server stores one
  // GarmentMedia row per photo so the pre-pickup condition is on file for
  // damage claims. Without this field the photos used to silently die in
  // the customer's browser (audit finding).
  conditionPhotos: z
    .array(
      z
        .string()
        .startsWith('data:image/', 'Condition photos must be images')
        .max(900_000, 'A condition photo is too large')
    )
    .max(6, 'At most 6 condition photos')
    .optional(),
})

export const UpdateOrderSchema = z.object({
  status: OrderStatusSchema.optional(),
  driverId: z.string().nullable().optional(),
  finalWeight: z.number().nullable().optional(),
  totalPrice: z.number().nullable().optional(),
})

// ----- Payment schemas -----
export const CreatePaymentSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().nonnegative(),
  method: PaymentMethodSchema,
  receiptUrl: z.string().optional(),
})

export const UpdatePaymentSchema = z.object({
  status: PaymentStatusSchema,
})

// ----- Staff schemas (phase 31) -----
// Super-admin invites: the admin sets the staff member's name, contact and
// their INITIAL password; the invite email carries the credentials. Staff
// are trusted at creation (emailVerified = now) — no verification loop —
// because a real admin vouched for them. Password floor is slightly above
// the public signup's 8: staff accounts open the operations console.
export const CreateStaffSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(255)
    .regex(EMAIL_REGEX, EMAIL_HELP),
  phone: z.string().trim().min(7, 'Phone is required').max(20),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(128)
    // Must contain at least two of: lowercase, uppercase, digit, symbol —
    // the "generate password" button in the UI always satisfies all four.
    .refine(
      (p) =>
        [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(p)).length >= 2,
      'Password needs a mix of letters, numbers or symbols'
    ),
  // Optional personal line the manager can add to the invite email
  // ("You'll be handling the Lekki pickups").
  note: z.string().trim().max(300).optional(),
})

export const UpdateStaffSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  accessStatus: AccessStatusSchema.optional(),
  // New password — re-sends the invite email with the new credentials.
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(128)
    .optional(),
})

// ----- Review schemas -----
// Two accepted references to the order being reviewed:
//   • orderId — the full order id (cuid) from the customer's private review
//     link (/review/[orderId]). The cuid is an unguessable capability token.
//   • orderNumber + contact — the public path (Phase 17, client directive:
//     non-registered customers can review, but ONLY with an order number).
//     The contact (email or phone used at booking) must match the order's
//     customer record, so a guessed KZ-number alone is never enough.
// Exactly one of the two paths must be provided.
export const CreateReviewSchema = z
  .object({
    // Full order id (cuid) from the review link — not the human-readable
    // orderNumber (which is guessable on its own).
    orderId: z.string().min(10, 'Invalid order reference').optional(),
    // Human-readable order number (KZ-XXXXXXXX) for the public feedback page.
    orderNumber: z
      .string()
      .trim()
      .regex(/^KZ-?\d{6,10}$/i, 'Enter your order number as KZ-12345678')
      .optional(),
    // Email or phone used at booking — required to verify the public
    // orderNumber path (skipped when the caller is signed in as the owner).
    contact: z.string().trim().max(120).optional(),
    rating: z.number().min(1, 'Rating must be at least 1 star').max(5, 'Rating can be at most 5 stars'),
    comment: z.string().min(10, 'Please write at least a sentence').max(2000, 'Comment is too long'),
    displayName: z.string().max(100).optional().nullable(),
    displayLocation: z.string().max(100).optional().nullable(),
  })
  .refine((d) => Boolean(d.orderId) !== Boolean(d.orderNumber), {
    message: 'Provide either the review link reference or your order number — not both.',
  })

export const ModerateReviewSchema = z.object({
  action: z.enum(['approve', 'unapprove', 'hide', 'unhide']),
})

// ----- Type exports -----
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>
export type GuestInfoInput = z.infer<typeof GuestInfoSchema>
export type UpdateOrderInput = z.infer<typeof UpdateOrderSchema>
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>
export type UpdatePaymentInput = z.infer<typeof UpdatePaymentSchema>
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>
export type CreateStaffInput = z.infer<typeof CreateStaffSchema>
export type UpdateStaffInput = z.infer<typeof UpdateStaffSchema>
