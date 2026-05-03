// ================================================================
//  Zod validation schemas — used in API route handlers
// ================================================================
import { z } from 'zod';

export const uuidSchema = z.string().uuid();

const drinkCustomizationSchema = z.object({
  sugar: z.enum(['none', 'less', 'regular', 'extra']),
  strength: z.enum(['mild', 'regular', 'strong']),
  size: z.enum(['small', 'regular', 'large']),
});

export const createOrderSchema = z.object({
  machine_id: uuidSchema,
  drink_type: z.enum(['coffee', 'tea']),
  customization: drinkCustomizationSchema,
});

export const verifyPaymentSchema = z.object({
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_signature: z.string().min(1).max(256),
  order_id: uuidSchema,
});

export const adminLoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

export const addMachineSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().max(200).optional(),
});

export const updateMachineSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  location: z.string().max(200).optional(),
  status: z.enum(['active', 'inactive', 'maintenance']).optional(),
});

export const dispenseSchema = z.object({
  machine_id: uuidSchema,
  order_id: uuidSchema,
  drink_type: z.enum(['coffee', 'tea']),
  customization: drinkCustomizationSchema,
  payment_id: z.string().min(1).max(100),
});
