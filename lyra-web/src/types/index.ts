// ================================================================
//  Shared TypeScript types
// ================================================================

export type MachineStatus = 'active' | 'inactive' | 'maintenance';
export type OrderStatus = 'pending' | 'paid' | 'dispensing' | 'dispensed' | 'failed' | 'refunded';
export type PaymentStatus = 'created' | 'captured' | 'failed' | 'refunded';
export type DrinkType = 'coffee' | 'tea';

export interface CoffeeMachine {
  id: string;
  name: string;
  location: string | null;
  status: MachineStatus;
  last_ping: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoffeeMachineAdmin extends CoffeeMachine {
  api_key: string;
  api_secret: string;
}

export interface DrinkCustomization {
  sugar: 'none' | 'less' | 'regular' | 'extra';
  strength: 'mild' | 'regular' | 'strong';
  size: 'small' | 'regular' | 'large';
}

export interface CoffeeOrder {
  id: string;
  machine_id: string;
  drink_type: DrinkType;
  customization: DrinkCustomization;
  amount_paise: number;
  status: OrderStatus;
  razorpay_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoffeePayment {
  id: string;
  order_id: string;
  razorpay_payment_id: string | null;
  razorpay_order_id: string;
  razorpay_signature: string | null;
  status: PaymentStatus;
  method: string | null;
  vpa: string | null;
  created_at: string;
}

// ── API Request / Response shapes ─────────────────────────────────

export interface CreateOrderRequest {
  machine_id: string;
  drink_type: DrinkType;
  customization: DrinkCustomization;
}

export interface CreateOrderResponse {
  order_id: string;           // our internal UUID
  razorpay_order_id: string;
  amount_paise: number;
  currency: string;
  razorpay_key_id: string;
}

export interface VerifyPaymentRequest {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  order_id: string;           // our internal UUID
}

export interface DispenseRequest {
  machine_id: string;
  order_id: string;
  drink_type: DrinkType;
  customization: DrinkCustomization;
  payment_id: string;
}

// Admin
export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminTokenPayload {
  sub: string;       // admin UUID
  email: string;
  role: string;
  iat: number;
  exp: number;
}
