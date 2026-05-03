# Lyra Coffee — Deployment & Operations Guide

## Prerequisites
- Node.js ≥ 18
- Supabase project at `https://fjghhrubobqwplvokszz.supabase.co`
- Razorpay account (test keys for dev, live keys for prod)
- Vercel account (free tier works)

---

## 1. Supabase Setup

### Run the schema
1. Open the Supabase Dashboard → **SQL Editor**
2. Paste contents of `lyra-web/supabase/schema.sql`
3. Click **Run**

### Get your keys
- **Anon key**: Project Settings → API → `anon` key
- **Service role key**: Project Settings → API → `service_role` key  
  ⚠️ **Never expose the service role key in the browser**

---

## 2. Razorpay Setup

1. Log in to [razorpay.com/dashboard](https://dashboard.razorpay.com)
2. Go to **Settings → API Keys** → Generate key
3. Copy `Key ID` (starts with `rzp_test_…`) and `Key Secret`
4. Go to **Settings → Webhooks** → Add webhook:
   - URL: `https://yourdomain.com/api/payments/webhook`
   - Events: `payment.captured`, `payment.failed`
   - Secret: generate a random string (save it as `RAZORPAY_WEBHOOK_SECRET`)

---

## 3. Environment Variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

Required variables:
| Variable | Where to get |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Project Settings → API |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay Dashboard → API Keys |
| `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Dashboard → Webhooks |
| `JWT_SECRET` | Generate: `openssl rand -hex 64` |
| `MACHINE_WEBHOOK_SECRET` | Generate: `openssl rand -hex 32` |

---

## 4. Create First Admin

```bash
cd lyra-web
node scripts/seed-admin.js
```

---

## 5. Local Development

```bash
cd lyra-web
npm install
npm run dev
```

Visit:
- Customer flow: `http://localhost:3000/?machine=<uuid>`
- Admin panel: `http://localhost:3000/admin`

---

## 6. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd lyra-web
vercel --prod
```

**Set environment variables in Vercel:**
1. Vercel Dashboard → Project → Settings → Environment Variables
2. Add all variables from `.env.example`
3. Set `NEXT_PUBLIC_APP_URL` to your production URL

**After deploy:**
- Update `NEXT_PUBLIC_APP_URL` to `https://yourapp.vercel.app`
- Update Razorpay webhook URL to `https://yourapp.vercel.app/api/payments/webhook`

---

## 7. QR Code Generation

Each machine's QR code should encode:
```
https://yourapp.vercel.app/?machine=<machine-uuid>
```

Get the UUID from the Admin → Machines page after creating a machine.

Free QR generators: [qr-code-generator.com](https://www.qr-code-generator.com) or use the `qrcode` npm package.

---

## 8. Machine ESP32 Integration

The ESP32 firmware already supports MQTT. After payment success, the backend should publish to:
```
topic: lyra/machine/<machine_id>/dispense
payload: { order_id, drink_type, customization }
```

To connect the Next.js backend to MQTT:
1. Install `mqtt` package: `npm install mqtt`
2. Update `src/app/api/machine/dispense/route.ts` — replace the mock section with an MQTT publish call using the machine's `api_key` as the client ID

---

## 9. Security Checklist

- [x] Razorpay signature verified server-side (HMAC-SHA256)
- [x] Admin routes protected by JWT cookie (HttpOnly, Secure)
- [x] `proxy.ts` adds CSP, X-Frame-Options, HSTS headers
- [x] Rate limiting on payment and login routes
- [x] Machine dispense endpoint authenticated by HMAC signature
- [x] All inputs validated with Zod
- [x] Service role key never exposed to browser
- [x] Supabase RLS enabled on all tables
- [x] Timing-safe comparisons for all HMAC checks
- [x] bcrypt cost factor 12 for admin passwords
- [ ] **TODO**: Add Redis-based rate limiter (Upstash) for multi-instance deployments
- [ ] **TODO**: Replace in-memory rate limiter for production
- [ ] **TODO**: Add MQTT auth for ESP32 ↔ backend channel
- [ ] **TODO**: Enable Supabase PITR (Point-in-Time Recovery) backups

---

## 10. Architecture Diagram

```
[QR Code] → /?machine=UUID
                │
                ▼
        [ Next.js App Router ]
                │
      ┌─────────┼──────────────────┐
      │         │                  │
   Customer   Admin           API Routes
   Flow UI    Panel          /api/orders
  (Client)  (Server)         /api/payments/*
                             /api/machine/*
                │                  │
                ▼                  ▼
         [ Supabase DB ]     [ Razorpay ]
         coffee_machines
         coffee_orders
         coffee_payments
         coffee_dispense_log
                              │
                              ▼
                    [ ESP32 via MQTT/HTTP ]
                       ↓ Dispenses drink
```
