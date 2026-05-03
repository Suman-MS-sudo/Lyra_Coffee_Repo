# UPI Payment Integration — Setup Guide

## Architecture Overview

```
Customer phone                 Your server                 ESP32
─────────────                  ───────────                 ─────
Scan QR code ──────────────▶  serve webapp/index.html
Select drink/ratio/strength
POST /api/order ────────────▶  Create Razorpay order
Razorpay checkout opens
Pay via UPI
                               POST /api/webhook ◀──── Razorpay
                               Verify HMAC-SHA256
                               Publish MQTT ──────────────────▶ lyra/LYRA001/dispense
                                                                 Dispense drink 🎉
```

---

## Step 1 — Razorpay Account Setup

1. Sign up at [https://razorpay.com](https://razorpay.com) and complete KYC.
2. **Dashboard → Settings → API Keys → Generate Key**  
   Copy `Key ID` and `Key Secret` → paste into `backend/.env`.
3. **Dashboard → Settings → Webhooks → Add New Webhook**
   - URL: `https://api.yourapp.com/api/webhook`
   - Events to subscribe: ✅ `payment.captured`
   - Copy the **Webhook Secret** → paste into `backend/.env`.

---

## Step 2 — Run the Backend

```bash
cd backend
cp .env.example .env      # edit .env with your real credentials
npm install
npm start
```

The server listens on port 3000 by default (set `PORT` in `.env`).  
Use [ngrok](https://ngrok.com) for local testing:

```bash
ngrok http 3000
# Razorpay Webhook URL: https://<ngrok-id>.ngrok.io/api/webhook
```

For production, deploy to any Node.js host (Railway, Render, Fly.io, etc.).

---

## Step 3 — Host the Web App

The web app is a single static HTML file at `webapp/index.html`.

1. Open `webapp/index.html` in a text editor and update **`API_BASE`**:
   ```js
   const API_BASE = 'https://api.yourapp.com';   // ← your backend URL
   ```
2. Deploy to any static host — GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.
3. Note the public URL, e.g. `https://yourapp.com/o`

---

## Step 4 — Configure the QR Code URL

1. Open `include/config.h`.
2. Update `WEBAPP_URL` to include your machine ID:
   ```c
   #define WEBAPP_URL  "https://yourapp.com/o?m=LYRA001"
   ```
   The URL must be **≤ 39 characters** to fit QR version 3.  
   Tip: use a URL shortener or a short custom domain.
3. Set a unique `MACHINE_ID` for each machine:
   ```c
   #define MACHINE_ID  "LYRA001"
   ```

---

## Step 5 — Configure WiFi

In `include/config.h`:
```c
#define WIFI_SSID  "YourWiFiSSID"
#define WIFI_PASS  "YourWiFiPassword"
```

The machine falls back to offline mode (physical buttons only) if WiFi is unavailable.

---

## Step 6 — MQTT Broker (Production)

For production, **do not use the public HiveMQ broker** — it has no authentication.

**Recommended free options:**
- **HiveMQ Cloud** free tier — TLS, username/password auth  
  URL format: `mqtts://your-cluster.hivemq.cloud:8883`
- **EMQX Cloud** free tier  
- **Self-hosted Mosquitto** on a VPS

Update `MQTT_HOST` and `MQTT_PORT` in `include/config.h`  
and `MQTT_BROKER_URL` in `backend/.env`.

---

## Step 7 — Flash the Firmware

```bash
cd "Lyra Coffee Machine"
pio run --target upload
pio device monitor       # watch serial output
```

On first boot, the machine will:
1. Connect to WiFi (shown on TFT)
2. Complete the normal heating startup sequence
3. Display the **QR code** and "Scan to Order" when ready

---

## Drink Customisation — Ratio Logic

| Parameter | Values | Effect on pump timing |
|-----------|--------|----------------------|
| `milk_pct`  | 0 – 100 | Scales `DISP_MILK_MS` linearly (0% = skip milk pump) |
| `strength`  | `light` | Decoction pump runs at 0.6× base duration |
|             | `medium` | 1.0× base duration (default) |
|             | `strong` | 1.5× base duration |

Base durations are configured in `include/config.h`:
```c
#define DISP_MILK_MS    7000UL   // 100% milk reference
#define DISP_COFFEE_MS  3000UL   // 1× coffee decoction reference
#define DISP_TEA_MS     3000UL   // 1× tea decoction reference
```

---

## MQTT Message Format

**Topic:** `lyra/{MACHINE_ID}/dispense`  
**Payload (JSON):**
```json
{
  "order_id": "order_XXXXXXXXXXXXXXXX",
  "drink":    "coffee",
  "milk_pct": 50,
  "strength": "medium"
}
```

You can also send a manual test command from any MQTT client:
```bash
mosquitto_pub -h broker.hivemq.com -t "lyra/LYRA001/dispense" \
  -m '{"order_id":"test","drink":"coffee","milk_pct":50,"strength":"medium"}'
```

---

## Security Checklist

- [ ] Replace public MQTT broker with a private, authenticated broker
- [ ] Set `WEBAPP_ORIGIN` in `backend/.env` to restrict CORS to your domain
- [ ] Enable HTTPS on the backend (required by Razorpay webhooks in live mode)
- [ ] Move from Razorpay test keys to live keys before going live
- [ ] In production, replace the in-memory order store with Redis or a database
- [ ] Add rate limiting to `/api/order` to prevent order-spam attacks
