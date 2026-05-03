// ================================================================
//  Database types — auto-derive from schema for type safety
//  These mirror the Supabase schema exactly.
// ================================================================

export type MachineStatus = 'active' | 'inactive' | 'maintenance';
export type OrderStatus   = 'pending' | 'paid' | 'dispensing' | 'dispensed' | 'failed' | 'refunded';
export type PaymentStatus = 'captured' | 'refunded' | 'failed';
export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet' | string;
export type DispenseStatus = 'queued' | 'sent' | 'ack' | 'failed';

export interface DrinkCustomization {
  sugar:    'none' | 'low' | 'medium' | 'high';
  strength: 'light' | 'medium' | 'strong';  // decoction:milk ratio (20:80, 30:70, 40:60)
  milk:     boolean;                         // false = black (100% decoction)
}

// ── Table row types ──────────────────────────────────────────────

export interface CoffeeMachine {
  id:           string;
  name:         string;
  location:     string | null;
  status:       MachineStatus;
  api_key_hash: string;
  customer_id:  string | null;
  price_coffee_paise: number | null;   // null → platform default
  price_tea_paise:    number | null;   // null → platform default
  is_free:            boolean;          // true → no payment, dispense for free
  mac_id:       string | null;          // hardware MAC / serial of the ESP32
  created_at:   string;
  updated_at:   string;
}

export interface CoffeeOrder {
  id:                string;
  machine_id:        string;
  drink_type:        'coffee' | 'tea';
  customization:     DrinkCustomization;
  amount_paise:      number;
  status:            OrderStatus;
  razorpay_order_id: string | null;
  idempotency_key:   string;
  created_at:        string;
  updated_at:        string;
}

export interface CoffeePayment {
  id:                   string;
  order_id:             string;
  razorpay_payment_id:  string;
  razorpay_order_id:    string;
  razorpay_signature:   string;
  amount_paise:         number;
  status:               PaymentStatus;
  method:               PaymentMethod | null;
  vpa:                  string | null;
  created_at:           string;
}

export interface CoffeeDispenseLog {
  id:            string;
  order_id:      string;
  machine_id:    string;
  status:        DispenseStatus;
  attempt:       number;
  error_message: string | null;
  created_at:    string;
}

export interface CoffeeAdmin {
  id:            string;
  email:         string;
  name:          string;
  is_active:     boolean;
  last_login_at: string | null;
  created_at:    string;
  // password_hash is never returned to the application layer
}

export interface CoffeeCustomer {
  id:            string;
  email:         string;
  name:          string;
  company:       string | null;
  is_active:     boolean;
  last_login_at: string | null;
  created_at:    string;
  // password_hash is never returned to the application layer
}

// ── Supabase Database type map ───────────────────────────────────
export type Database = {
  public: {
    Tables: {
      coffee_machines: {
        Row:           CoffeeMachine;
        Insert:        Omit<CoffeeMachine, 'id' | 'created_at' | 'updated_at'>;
        Update:        Partial<Omit<CoffeeMachine, 'id' | 'created_at'>>;
        Relationships: [];
      };
      coffee_orders: {
        Row:           CoffeeOrder;
        Insert:        Omit<CoffeeOrder, 'id' | 'created_at' | 'updated_at' | 'idempotency_key'>;
        Update:        Partial<Omit<CoffeeOrder, 'id' | 'created_at'>>;
        Relationships: [];
      };
      coffee_payments: {
        Row:           CoffeePayment;
        Insert:        Omit<CoffeePayment, 'id' | 'created_at'>;
        Update:        Partial<Omit<CoffeePayment, 'id' | 'created_at'>>;
        Relationships: [];
      };
      coffee_dispense_log: {
        Row:           CoffeeDispenseLog;
        Insert:        Omit<CoffeeDispenseLog, 'id' | 'created_at'>;
        Update:        Partial<Omit<CoffeeDispenseLog, 'id' | 'created_at'>>;
        Relationships: [];
      };
      coffee_admins: {
        Row:           CoffeeAdmin & { password_hash: string };
        Insert:        Omit<CoffeeAdmin, 'id' | 'created_at' | 'last_login_at'> & { password_hash: string };
        Update:        Partial<Omit<CoffeeAdmin, 'id' | 'created_at'>>;
        Relationships: [];
      };
    };
    Views:          { [_ in never]: never };
    Functions:      { [_ in never]: never };
    Enums:          { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
