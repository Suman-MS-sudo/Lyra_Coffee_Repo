import { z } from 'zod';

// ── Shared ───────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid();

export const drinkTypeSchema = z.enum(['coffee', 'tea', 'milk']);

export const customizationSchema = z.object({
  sugar:    z.enum(['none', 'low', 'medium', 'high']).default('medium'),
  strength: z.enum(['light', 'medium', 'strong']).default('medium'),
  milk:     z.boolean().default(true),
});

// ── Customer: create order ────────────────────────────────────────
export const createOrderSchema = z.object({
  machine_id:    uuidSchema,
  drink_type:    drinkTypeSchema,
  customization: customizationSchema,
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ── Customer: verify payment ──────────────────────────────────────
// Note: we look the order up server-side by razorpay_order_id, so we
// deliberately do NOT require the internal order_id from the client.
export const verifyPaymentSchema = z.object({
  razorpay_order_id:   z.string().min(1).max(256),
  razorpay_payment_id: z.string().min(1).max(256),
  razorpay_signature:  z.string().min(1).max(512),
});
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

// ── Machine dispense ─────────────────────────────────────────────
export const dispenseSchema = z.object({
  machine_id:    uuidSchema,
  order_id:      uuidSchema,
  drink_type:    drinkTypeSchema,
  customization: customizationSchema,
  payment_id:    z.string().min(1).max(256),
});
export type DispenseInput = z.infer<typeof dispenseSchema>;

// ── Admin / Customer: login ─────────────────────────────────────
export const adminLoginSchema = z.object({
  email:    z.string().email().max(255),
  password: z.string().min(8).max(128),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const customerLoginSchema = z.object({
  email:    z.string().email().max(255),
  password: z.string().min(8).max(128),
});
export type CustomerLoginInput = z.infer<typeof customerLoginSchema>;

// ── Admin: create customer ────────────────────────────────────────
export const createCustomerSchema = z.object({
  name:     z.string().min(1).max(120).trim(),
  email:    z.string().email().max(255),
  password: z.string().min(8).max(128),
  company:  z.string().max(120).trim().optional(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

// ── Admin: update customer ───────────────────────────────────────
export const updateCustomerSchema = z.object({
  name:      z.string().min(1).max(120).trim().optional(),
  email:     z.string().email().max(255).optional(),
  company:   z.string().max(120).trim().nullable().optional(),
  is_active: z.boolean().optional(),
  password:  z.string().min(8).max(128).optional(),
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

// ── Admin: create machine ────────────────────────────────────────
const pricePaise = z.number().int().min(0).max(100_000).nullable();
const macIdSchema = z
  .string()
  .trim()
  .max(64)
  .regex(/^[A-Za-z0-9:_\-]+$/, 'MAC ID may only contain letters, digits, : _ -')
  .nullable();

export const createMachineSchema = z.object({
  name:               z.string().min(1).max(120).trim(),
  location:           z.string().max(255).trim().optional().nullable(),
  status:             z.enum(['active', 'inactive', 'maintenance']).default('inactive'),
  customer_id:        z.union([uuidSchema, z.null()]).optional(),
  is_free:            z.boolean().optional().default(false),
  price_coffee_paise: pricePaise.optional(),
  price_tea_paise:    pricePaise.optional(),
  mac_id:             macIdSchema.optional(),
});
export type CreateMachineInput = z.infer<typeof createMachineSchema>;

// ── Admin: update machine ────────────────────────────────────────
export const updateMachineSchema = z.object({
  id:                 uuidSchema,
  name:               z.string().min(1).max(120).trim().optional(),
  location:           z.string().max(255).trim().optional().nullable(),
  status:             z.enum(['active', 'inactive', 'maintenance']).optional(),
  customer_id:        z.union([uuidSchema, z.null()]).optional(),
  is_free:            z.boolean().optional(),
  price_coffee_paise: pricePaise.optional(),
  price_tea_paise:    pricePaise.optional(),
  mac_id:             macIdSchema.optional(),
});
export type UpdateMachineInput = z.infer<typeof updateMachineSchema>;

// ── Pagination ───────────────────────────────────────────────────
export const paginationSchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});
