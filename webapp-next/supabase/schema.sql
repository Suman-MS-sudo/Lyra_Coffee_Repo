-- ================================================================
--  Lyra Coffee Machine — Supabase PostgreSQL Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query
--
--  All tables are prefixed with "coffee_" to avoid conflicts
--  with existing tables in the project.
--
--  Extensions required: pgcrypto (for gen_random_uuid), pg_cron optional
-- ================================================================

-- Enable pgcrypto for UUID generation (already enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
--  1. coffee_machines
--     Represents each physical vending machine.
--     api_key_hash: stores bcrypt/sha256 hash of the machine secret,
--     never the plaintext key.
-- ================================================================
CREATE TABLE IF NOT EXISTS coffee_machines (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
    location      TEXT,
    status        TEXT        NOT NULL DEFAULT 'inactive'
                              CHECK (status IN ('active', 'inactive', 'maintenance')),
    api_key_hash  TEXT        NOT NULL,   -- SHA-256 hex of the machine's API key
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coffee_machines_status ON coffee_machines(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION coffee_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER coffee_machines_updated_at
    BEFORE UPDATE ON coffee_machines
    FOR EACH ROW EXECUTE FUNCTION coffee_set_updated_at();

-- ================================================================
--  2. coffee_orders
--     One row per customer order. Created when a Razorpay order
--     is generated; status updated as payment progresses.
-- ================================================================
CREATE TABLE IF NOT EXISTS coffee_orders (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id      UUID        NOT NULL REFERENCES coffee_machines(id) ON DELETE RESTRICT,
    drink_type      TEXT        NOT NULL CHECK (drink_type IN ('coffee', 'tea')),
    customization   JSONB       NOT NULL DEFAULT '{}'::JSONB,
    -- Expected shape: { "sugar": "medium", "strength": "strong", "size": "regular", "milk_pct": 50 }
    amount_paise    INTEGER     NOT NULL CHECK (amount_paise > 0),
    status          TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'paid', 'dispensing', 'dispensed', 'failed', 'refunded')),
    razorpay_order_id TEXT      UNIQUE,   -- set when order created; used for idempotency
    idempotency_key TEXT        UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coffee_orders_machine_id  ON coffee_orders(machine_id);
CREATE INDEX IF NOT EXISTS idx_coffee_orders_status      ON coffee_orders(status);
CREATE INDEX IF NOT EXISTS idx_coffee_orders_created_at  ON coffee_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coffee_orders_rzp_order   ON coffee_orders(razorpay_order_id)
    WHERE razorpay_order_id IS NOT NULL;

CREATE OR REPLACE TRIGGER coffee_orders_updated_at
    BEFORE UPDATE ON coffee_orders
    FOR EACH ROW EXECUTE FUNCTION coffee_set_updated_at();

-- ================================================================
--  3. coffee_payments
--     Stores Razorpay payment details after successful webhook.
--     Never duplicate a payment (razorpay_payment_id is UNIQUE).
-- ================================================================
CREATE TABLE IF NOT EXISTS coffee_payments (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id              UUID        NOT NULL REFERENCES coffee_orders(id) ON DELETE RESTRICT,
    razorpay_payment_id   TEXT        NOT NULL UNIQUE,
    razorpay_order_id     TEXT        NOT NULL,
    razorpay_signature    TEXT        NOT NULL,
    amount_paise          INTEGER     NOT NULL CHECK (amount_paise > 0),
    status                TEXT        NOT NULL DEFAULT 'captured'
                                      CHECK (status IN ('captured', 'refunded', 'failed')),
    method                TEXT,        -- upi, card, netbanking, etc.
    vpa                   TEXT,        -- UPI VPA if applicable (masked: last 4 chars only)
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coffee_payments_order_id     ON coffee_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_coffee_payments_rzp_order    ON coffee_payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_coffee_payments_created_at   ON coffee_payments(created_at DESC);

-- ================================================================
--  4. coffee_dispense_log
--     Audit trail of every dispense attempt (idempotent retries safe).
-- ================================================================
CREATE TABLE IF NOT EXISTS coffee_dispense_log (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID        NOT NULL REFERENCES coffee_orders(id) ON DELETE RESTRICT,
    machine_id      UUID        NOT NULL REFERENCES coffee_machines(id) ON DELETE RESTRICT,
    status          TEXT        NOT NULL CHECK (status IN ('queued', 'sent', 'ack', 'failed')),
    attempt         SMALLINT    NOT NULL DEFAULT 1,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coffee_dispense_order ON coffee_dispense_log(order_id);

-- ================================================================
--  5. coffee_admins
--     Admin users (separate from Supabase Auth; use Supabase Auth
--     user IDs here if you prefer to delegate auth to Supabase).
-- ================================================================
CREATE TABLE IF NOT EXISTS coffee_admins (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT        NOT NULL UNIQUE CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'),
    password_hash   TEXT        NOT NULL,           -- bcrypt hash, cost ≥ 12
    name            TEXT        NOT NULL,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coffee_admins_email ON coffee_admins(email);

-- ================================================================
--  6. coffee_customers
--     Business customers who own one or more Lyra machines.
--     Managed by admins; each customer can log in to the Customer Portal.
-- ================================================================
CREATE TABLE IF NOT EXISTS coffee_customers (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT        NOT NULL UNIQUE CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'),
    password_hash TEXT        NOT NULL,           -- SHA-256 hex hash
    name          TEXT        NOT NULL,
    company       TEXT,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coffee_customers_email ON coffee_customers(email);

-- Link each machine to an optional customer owner
ALTER TABLE coffee_machines
    ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES coffee_customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coffee_machines_customer_id ON coffee_machines(customer_id);

-- Per-machine pricing (set by the owning customer). NULL → use platform default.
-- is_free overrides any price and skips Razorpay entirely.
ALTER TABLE coffee_machines
    ADD COLUMN IF NOT EXISTS price_coffee_paise INTEGER
        CHECK (price_coffee_paise IS NULL OR price_coffee_paise >= 0),
    ADD COLUMN IF NOT EXISTS price_tea_paise    INTEGER
        CHECK (price_tea_paise    IS NULL OR price_tea_paise    >= 0),
    ADD COLUMN IF NOT EXISTS is_free            BOOLEAN NOT NULL DEFAULT FALSE;

-- Hardware identifier — usually the ESP32 MAC address.
ALTER TABLE coffee_machines
    ADD COLUMN IF NOT EXISTS mac_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_coffee_machines_mac_id ON coffee_machines(mac_id) WHERE mac_id IS NOT NULL;

-- Set when an ESP32 first claims this row via /api/machine/identify
-- (so a replacement board can be detected and admins can rotate keys).
ALTER TABLE coffee_machines
    ADD COLUMN IF NOT EXISTS mac_provisioned_at TIMESTAMPTZ;

-- Updated by /api/machine/poll and /api/machine/heartbeat. Used
-- to derive the live "online" indicator in the admin dashboard.
ALTER TABLE coffee_machines
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_coffee_machines_last_seen_at
    ON coffee_machines(last_seen_at);

-- ================================================================
--  Row Level Security (RLS)
--  All tables are locked down. The Next.js server uses the
--  SERVICE_ROLE key which bypasses RLS. The anon/authenticated
--  roles get zero direct access — all reads/writes go through
--  server-side API routes.
-- ================================================================
ALTER TABLE coffee_machines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE coffee_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE coffee_payments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE coffee_dispense_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE coffee_admins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE coffee_customers     ENABLE ROW LEVEL SECURITY;

-- Deny everything for anon and authenticated roles
CREATE POLICY "no_access_machines"     ON coffee_machines      FOR ALL TO anon, authenticated USING (FALSE);
CREATE POLICY "no_access_orders"       ON coffee_orders        FOR ALL TO anon, authenticated USING (FALSE);
CREATE POLICY "no_access_payments"     ON coffee_payments      FOR ALL TO anon, authenticated USING (FALSE);
CREATE POLICY "no_access_dispense_log" ON coffee_dispense_log  FOR ALL TO anon, authenticated USING (FALSE);
CREATE POLICY "no_access_admins"       ON coffee_admins        FOR ALL TO anon, authenticated USING (FALSE);
CREATE POLICY "no_access_customers"    ON coffee_customers     FOR ALL TO anon, authenticated USING (FALSE);

-- ================================================================
--  Useful views (accessible only to service_role)
-- ================================================================
CREATE OR REPLACE VIEW coffee_order_summary AS
SELECT
    o.id,
    o.created_at,
    m.name            AS machine_name,
    m.location        AS machine_location,
    o.drink_type,
    o.customization,
    o.amount_paise,
    o.status          AS order_status,
    p.razorpay_payment_id,
    p.status          AS payment_status,
    p.method          AS payment_method
FROM  coffee_orders   o
JOIN  coffee_machines m ON m.id = o.machine_id
LEFT  JOIN coffee_payments p ON p.order_id = o.id
ORDER BY o.created_at DESC;
