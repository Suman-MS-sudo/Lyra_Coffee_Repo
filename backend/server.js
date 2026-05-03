'use strict';

// ================================================================
//  Lyra Coffee Machine — Payment Backend
//  Node.js / Express
//
//  Responsibilities:
//    1. POST /api/order      — Create a Razorpay order (called by web app)
//    2. POST /api/webhook    — Verify Razorpay payment webhook (HMAC-SHA256)
//                              and publish the dispense command to MQTT
//    3. GET  /api/health     — Liveness probe
//
//  Security:
//    • Razorpay webhook signatures are verified before any action is taken.
//    • Order metadata is stored in memory between order creation and webhook.
//    • CORS is restricted to the webapp origin in production.
//
//  Usage:
//    cp .env.example .env       # fill in your secrets
//    npm install
//    npm start
// ================================================================

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const crypto   = require('crypto');
const Razorpay = require('razorpay');
const mqtt     = require('mqtt');

// ── Validate required environment variables ──────────────────────
const REQUIRED_ENV = [
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'MQTT_BROKER_URL',
];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[FATAL] Missing required env var: ${key}`);
    process.exit(1);
  }
}

const PORT           = parseInt(process.env.PORT || '3000', 10);
const WEBAPP_ORIGIN  = process.env.WEBAPP_ORIGIN || '*';   // e.g. https://yourapp.com
const PRICE_COFFEE   = parseInt(process.env.PRICE_COFFEE_PAISE || '2500', 10);  // ₹25
const PRICE_TEA      = parseInt(process.env.PRICE_TEA_PAISE    || '2000', 10);  // ₹20

// ── Razorpay client ───────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id    : process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── MQTT client ───────────────────────────────────────────────────
// Connects once at startup and stays connected (auto-reconnects).
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL, {
  clientId     : `lyra-backend-${Math.random().toString(16).slice(2, 8)}`,
  clean        : true,
  reconnectPeriod: 5000,
});
mqttClient.on('connect', () =>
  console.log(`[MQTT] Connected to ${process.env.MQTT_BROKER_URL}`));
mqttClient.on('error', err =>
  console.error('[MQTT] Error:', err.message));

// ── In-memory order store ─────────────────────────────────────────
// Maps razorpay_order_id → order metadata.
// In production, use Redis or a database so it survives restarts.
const orderStore = new Map();

// Expire stale orders after 30 minutes to prevent unbounded growth.
const ORDER_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, meta] of orderStore) {
    if (now - meta.createdAt > ORDER_TTL_MS) orderStore.delete(id);
  }
}, 5 * 60 * 1000);

// ── Express app ───────────────────────────────────────────────────
const app = express();

// IMPORTANT: The Razorpay webhook route MUST use the raw body for
// HMAC verification. Register the raw body parser BEFORE json().
app.use('/api/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(cors({
  origin : WEBAPP_ORIGIN,
  methods: ['GET', 'POST', 'OPTIONS'],
}));

// ─────────────────────────────────────────────────────────────────
//  POST /api/order
//  Called by the web app to create a Razorpay order.
//
//  Request body:
//    { machine_id, drink, milk_pct, strength }
//
//  Response:
//    { order_id, amount, currency, key_id }
// ─────────────────────────────────────────────────────────────────
app.post('/api/order', async (req, res) => {
  const { machine_id, drink, milk_pct, strength } = req.body || {};

  // ── Input validation ──
  if (!machine_id || typeof machine_id !== 'string' || !/^[A-Z0-9]{1,16}$/.test(machine_id)) {
    return res.status(400).json({ error: 'Invalid machine_id' });
  }
  if (!['coffee', 'tea'].includes(drink)) {
    return res.status(400).json({ error: 'drink must be "coffee" or "tea"' });
  }
  const parsedMilk = parseInt(milk_pct, 10);
  if (isNaN(parsedMilk) || parsedMilk < 0 || parsedMilk > 100) {
    return res.status(400).json({ error: 'milk_pct must be 0–100' });
  }
  if (!['light', 'medium', 'strong'].includes(strength)) {
    return res.status(400).json({ error: 'strength must be light / medium / strong' });
  }

  const amount = drink === 'coffee' ? PRICE_COFFEE : PRICE_TEA;

  try {
    const rzpOrder = await razorpay.orders.create({
      amount  : amount,
      currency: 'INR',
      receipt : `LYRA-${machine_id}-${Date.now()}`,
      // Store order metadata in Razorpay notes for the webhook to retrieve
      notes   : {
        machine_id,
        drink,
        milk_pct : String(parsedMilk),
        strength,
      },
    });

    // Cache locally for fast webhook processing
    orderStore.set(rzpOrder.id, {
      machine_id,
      drink,
      milk_pct : parsedMilk,
      strength,
      amount,
      createdAt: Date.now(),
    });

    console.log(`[ORDER] Created ${rzpOrder.id} | ${drink} | machine=${machine_id}`);

    return res.json({
      order_id: rzpOrder.id,
      amount  : rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id  : process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('[ORDER] Razorpay error:', err);
    return res.status(502).json({ error: 'Failed to create payment order' });
  }
});

// ─────────────────────────────────────────────────────────────────
//  POST /api/webhook
//  Razorpay calls this endpoint after a successful payment.
//
//  SECURITY: The HMAC-SHA256 signature in the X-Razorpay-Signature
//  header is verified before any action is taken (OWASP: software
//  and data integrity failures).
//
//  On verified payment:
//    • Look up the order metadata
//    • Publish the dispense command to MQTT
// ─────────────────────────────────────────────────────────────────
app.post('/api/webhook', (req, res) => {
  // req.body is a Buffer (raw body) — needed for HMAC verification
  const rawBody  = req.body;
  const sigHeader = req.headers['x-razorpay-signature'];

  if (!sigHeader || !rawBody) {
    return res.status(400).json({ error: 'Missing signature or body' });
  }

  // Verify HMAC-SHA256
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  const sigBuffer      = Buffer.from(sigHeader,    'hex');
  const expectedBuffer = Buffer.from(expectedSig, 'hex');
  if (sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    console.warn('[WEBHOOK] Invalid signature — rejected.');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Parse the now-trusted body
  let event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    return res.status(400).json({ error: 'Malformed JSON' });
  }

  // We only care about successful payment captures
  if (event.event !== 'payment.captured') {
    return res.status(200).json({ status: 'ignored' });
  }

  const payment  = event.payload?.payment?.entity;
  const orderId  = payment?.order_id;

  if (!orderId) {
    return res.status(400).json({ error: 'Missing order_id in payment entity' });
  }

  // Retrieve stored order metadata
  const meta = orderStore.get(orderId);
  if (!meta) {
    // Fallback: try notes stored in the payment entity by Razorpay
    const notes = payment?.notes || {};
    if (!notes.machine_id || !notes.drink) {
      console.warn(`[WEBHOOK] Unknown order ${orderId} — no metadata found.`);
      return res.status(200).json({ status: 'unknown_order' });
    }
    publishDispense(orderId, notes.machine_id, notes.drink,
                    parseInt(notes.milk_pct || '50', 10),
                    notes.strength || 'medium');
  } else {
    publishDispense(orderId, meta.machine_id, meta.drink, meta.milk_pct, meta.strength);
    orderStore.delete(orderId);   // clean up — one dispense per payment
  }

  return res.status(200).json({ status: 'ok' });
});

/**
 * Publish a dispense command to the machine's MQTT topic.
 * Topic format: lyra/{MACHINE_ID}/dispense
 */
function publishDispense(orderId, machineId, drink, milkPct, strength) {
  const topic   = `lyra/${machineId}/dispense`;
  const payload = JSON.stringify({
    order_id : orderId,
    drink,
    milk_pct : milkPct,
    strength,
  });

  mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error(`[MQTT] Publish failed for order ${orderId}:`, err.message);
    } else {
      console.log(`[MQTT] Dispatched to ${topic}: ${payload}`);
    }
  });
}

// ─────────────────────────────────────────────────────────────────
//  GET /api/health
// ─────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status     : 'ok',
    mqtt       : mqttClient.connected ? 'connected' : 'disconnected',
    pendingOrders: orderStore.size,
  });
});

// ─────────────────────────────────────────────────────────────────
//  Start server
// ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[SERVER] Lyra Coffee backend listening on port ${PORT}`);
});
