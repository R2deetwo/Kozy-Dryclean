// =============================================================================
// Zod schemas for API request/response validation
// =============================================================================
// These match the Prisma enums EXACTLY. If you change a Prisma enum, update
// the corresponding Zod enum here too.
// =============================================================================

import { z } from 'zod'

// ----- Enums (must match prisma/schema.prisma) -----
export const RoleSchema = z.enum(['ADMIN', 'DRIVER', 'B2C', 'B2B'])
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
export const PaymentMethodSchema = z.enum(['BANK_TRANSFER', 'PAYSTACK'])
export const PaymentStatusSchema = z.enum(['PENDING', 'VERIFIED', 'REJECTED'])

// ----- Order schemas -----
export const OrderItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(), // server computes from PriceCatalog — client value is ignored
})

export const CreateOrderSchema = z.object({
  type: OrderTypeSchema,
  items: z.array(OrderItemSchema).optional().default([]),
  guaranteeActive: z.boolean().optional().default(false),
  pickupAddress: z.string().min(1, 'Pickup address is required'),
  pickupDate: z.string().min(1, 'Pickup date is required'), // ISO string
  pickupTimeSlot: z.string().min(1, 'Pickup time slot is required'),
  deliveryAddress: z.string().optional(),
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

// ----- Type exports -----
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>
export type UpdateOrderInput = z.infer<typeof UpdateOrderSchema>
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>
export type UpdatePaymentInput = z.infer<typeof UpdatePaymentSchema>
