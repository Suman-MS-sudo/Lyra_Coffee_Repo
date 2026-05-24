-- ================================================================
--  Lyra Coffee Machine — SQLite Schema (Pi 5 local mode)
--  Mirrors the Supabase/PostgreSQL schema in schema-compatible form.
--  Managed by the SQLite adapter; do not run manually.
-- ================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

-- customers must come before machines (FK)
CREATE TABLE IF NOT EXISTS coffee_customers (
  id                      TEXT PRIMARY KEY,
  email                   TEXT NOT NULL UNIQUE,
  password_hash           TEXT NOT NULL,
  name                    TEXT NOT NULL,
  company                 TEXT,
  is_active               INTEGER NOT NULL DEFAULT 1,
  last_login_at           TEXT,
  razorpay_key_id         TEXT,
  razorpay_key_secret     TEXT,
  razorpay_webhook_secret TEXT,
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS coffee_machines (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  location           TEXT,
  status             TEXT NOT NULL DEFAULT 'inactive'
                     CHECK(status IN ('active','inactive','maintenance')),
  api_key_hash       TEXT NOT NULL,
  customer_id        TEXT REFERENCES coffee_customers(id) ON DELETE SET NULL,
  is_free            INTEGER NOT NULL DEFAULT 0,
  price_coffee_paise INTEGER CHECK(price_coffee_paise IS NULL OR price_coffee_paise >= 0),
  price_tea_paise    INTEGER CHECK(price_tea_paise    IS NULL OR price_tea_paise    >= 0),
  price_milk_paise   INTEGER CHECK(price_milk_paise   IS NULL OR price_milk_paise   >= 0),
  mac_id             TEXT UNIQUE,
  mac_provisioned_at TEXT,
  last_seen_at       TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS coffee_orders (
  id                TEXT PRIMARY KEY,
  machine_id        TEXT NOT NULL REFERENCES coffee_machines(id) ON DELETE RESTRICT,
  drink_type        TEXT NOT NULL CHECK(drink_type IN ('coffee','tea','milk')),
  customization     TEXT NOT NULL DEFAULT '{}',
  amount_paise      INTEGER NOT NULL CHECK(amount_paise > 0),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','paid','dispensing','dispensed','failed','refunded')),
  razorpay_order_id TEXT UNIQUE,
  idempotency_key   TEXT UNIQUE NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS coffee_payments (
  id                  TEXT PRIMARY KEY,
  order_id            TEXT NOT NULL REFERENCES coffee_orders(id) ON DELETE RESTRICT,
  razorpay_payment_id TEXT NOT NULL UNIQUE,
  razorpay_order_id   TEXT NOT NULL,
  razorpay_signature  TEXT NOT NULL,
  amount_paise        INTEGER NOT NULL CHECK(amount_paise > 0),
  status              TEXT NOT NULL DEFAULT 'captured'
                      CHECK(status IN ('captured','refunded','failed')),
  method              TEXT,
  vpa                 TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS coffee_dispense_log (
  id            TEXT PRIMARY KEY,
  order_id      TEXT NOT NULL REFERENCES coffee_orders(id) ON DELETE RESTRICT,
  machine_id    TEXT NOT NULL REFERENCES coffee_machines(id) ON DELETE RESTRICT,
  status        TEXT NOT NULL CHECK(status IN ('queued','sent','ack','failed')),
  attempt       INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS coffee_admins (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_machines_status        ON coffee_machines(status);
CREATE INDEX IF NOT EXISTS idx_machines_customer_id   ON coffee_machines(customer_id);
CREATE INDEX IF NOT EXISTS idx_machines_last_seen_at  ON coffee_machines(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_orders_machine_id      ON coffee_orders(machine_id);
CREATE INDEX IF NOT EXISTS idx_orders_status          ON coffee_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at      ON coffee_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_rzp_order       ON coffee_orders(razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_order_id      ON coffee_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at    ON coffee_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispense_order         ON coffee_dispense_log(order_id);
CREATE INDEX IF NOT EXISTS idx_admins_email           ON coffee_admins(email);
CREATE INDEX IF NOT EXISTS idx_customers_email        ON coffee_customers(email);
