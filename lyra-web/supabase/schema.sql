-- ================================================================
--  Lyra Coffee — Supabase PostgreSQL Schema
--  All tables prefixed with coffee_
--  Run this in the Supabase SQL editor
-- ================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── coffee_machines ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coffee_machines (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  location   TEXT,
  status     TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'inactive', 'maintenance')),
  api_key    TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  api_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  last_ping  TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coffee_machines_status ON coffee_machines(status);

-- ── coffee_orders ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coffee_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id        UUID NOT NULL REFERENCES coffee_machines(id) ON DELETE RESTRICT,
  drink_type        TEXT NOT NULL CHECK (drink_type IN ('coffee', 'tea')),
  customization     JSONB NOT NULL DEFAULT '{}',
  amount_paise      INTEGER NOT NULL CHECK (amount_paise > 0),
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'paid', 'dispensing', 'dispensed', 'failed', 'refunded')),
  razorpay_order_id TEXT UNIQUE,
  dispense_attempts INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coffee_orders_machine_id  ON coffee_orders(machine_id);
CREATE INDEX idx_coffee_orders_status      ON coffee_orders(status);
CREATE INDEX idx_coffee_orders_created_at  ON coffee_orders(created_at DESC);
CREATE INDEX idx_coffee_orders_razorpay    ON coffee_orders(razorpay_order_id);

-- ── coffee_payments ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coffee_payments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID NOT NULL REFERENCES coffee_orders(id) ON DELETE RESTRICT,
  razorpay_payment_id  TEXT UNIQUE,
  razorpay_order_id    TEXT NOT NULL,
  razorpay_signature   TEXT,
  status               TEXT NOT NULL DEFAULT 'created'
                         CHECK (status IN ('created', 'captured', 'failed', 'refunded')),
  method               TEXT,
  bank                 TEXT,
  wallet               TEXT,
  vpa                  TEXT,   -- UPI VPA
  error_code           TEXT,
  error_description    TEXT,
  raw_webhook          JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coffee_payments_order_id          ON coffee_payments(order_id);
CREATE INDEX idx_coffee_payments_razorpay_order_id ON coffee_payments(razorpay_order_id);
CREATE INDEX idx_coffee_payments_status            ON coffee_payments(status);

-- ── coffee_dispense_log ───────────────────────────────────────────
-- Idempotency: each (order_id) can only have one successful dispatch
CREATE TABLE IF NOT EXISTS coffee_dispense_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES coffee_orders(id) ON DELETE RESTRICT,
  machine_id   UUID NOT NULL REFERENCES coffee_machines(id) ON DELETE RESTRICT,
  attempt      INTEGER NOT NULL DEFAULT 1,
  status       TEXT NOT NULL DEFAULT 'sent'
                 CHECK (status IN ('sent', 'ack', 'failed')),
  response     JSONB,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, attempt)
);

CREATE INDEX idx_coffee_dispense_log_order_id ON coffee_dispense_log(order_id);

-- ── coffee_admins ─────────────────────────────────────────────────
-- Only needed if NOT using Supabase Auth — if you use Supabase Auth
-- just use auth.users and store role in a profile table.
CREATE TABLE IF NOT EXISTS coffee_admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,  -- bcrypt, cost 12+
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'superadmin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);

-- ── updated_at triggers ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_machines_updated_at
  BEFORE UPDATE ON coffee_machines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON coffee_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON coffee_payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────
-- Machines — public read of active machines (needed for QR flow)
ALTER TABLE coffee_machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read active machines"
  ON coffee_machines FOR SELECT
  USING (status = 'active');

-- Orders — service role only (all writes go through API routes with service key)
ALTER TABLE coffee_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on orders"
  ON coffee_orders FOR ALL
  USING (auth.role() = 'service_role');

-- Payments — service role only
ALTER TABLE coffee_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on payments"
  ON coffee_payments FOR ALL
  USING (auth.role() = 'service_role');

-- Dispense log — service role only
ALTER TABLE coffee_dispense_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on dispense log"
  ON coffee_dispense_log FOR ALL
  USING (auth.role() = 'service_role');

-- Admins — service role only
ALTER TABLE coffee_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on admins"
  ON coffee_admins FOR ALL
  USING (auth.role() = 'service_role');

-- ── Seed: sample machine (remove before production) ───────────────
-- INSERT INTO coffee_machines (name, location) VALUES ('Machine #1', 'Lobby Floor 1');
