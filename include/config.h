#pragma once

// ================================================================
//  Lyra Coffee Machine — Configuration File
//  Target board : ESP32 DevKit C V4 (ESP32-WROOM-32, 38-pin)
//
//  Edit all pin assignments and timing constants here.
//  Do NOT edit src/main.cpp for configuration changes.
//
//  ESP32 DevKit C V4 — 38-pin layout (left side, top→bottom):
//    3V3, EN, GPIO36(VP), GPIO39(VN), GPIO34, GPIO35,
//    GPIO32, GPIO33, GPIO25, GPIO26, GPIO27, GPIO14, GPIO12, GND, GPIO13
//  Right side (top→bottom):
//    5V, GND, GPIO23, GPIO22, GPIO1(TX), GPIO3(RX),
//    GPIO21, GND, GPIO19, GPIO18, GPIO5, GPIO17, GPIO16, GPIO4, GPIO0, GPIO2, GPIO15, GPIO8
//
//  STRAPPING / BOOT-CONSTRAINED PINS — DO NOT use these as outputs:
//    GPIO 0  — Boot button (must be HIGH at boot for normal start)
//    GPIO 2  — Onboard LED; must be LOW at boot
//    GPIO 5  — Outputs HIGH at boot (SDIO timing strapping) ← AVOID for valves/relays
//    GPIO 12 — Must be LOW at boot (flash voltage select)
//    GPIO 15 — Outputs HIGH at boot (suppress boot log)
//    GPIO 6–11 — Connected to internal SPI flash — NEVER use
//    GPIO 1 (TX0) / GPIO 3 (RX0) — UART0/Serial monitor — avoid as GPIO
//    GPIO 34–39 — Input ONLY, no internal or external pull-up support
//                 (must add external 10 kΩ pull-up resistors to 3.3 V)
// ================================================================

// ----------------------------------------------------------------
//  GPIO — Motor Driver Pins (L298N)
//  IMPORTANT: Leave the ENA/ENB jumpers on both L298N modules
//  (motors always enabled; direction controlled by IN1/IN2 only).
//
//  Motor 0 = Milk          (Motor 1 in requirements)
//  Motor 1 = Coffee Dec.   (Motor 2)
//  Motor 2 = Tea Dec.      (Motor 3)
//  Motor 3 = Hot Water     (Motor 4)
// ----------------------------------------------------------------

// L298N Module #1  →  Motor 0 (Milk) and Motor 1 (Coffee)
#define M0_IN1  25
#define M0_IN2  26
#define M1_IN1  14
#define M1_IN2   2   // Moved from GPIO 13 → GPIO 2 to free GPIO 13 for TFT SPI MOSI

// L298N Module #2  →  Motor 2 (Tea) and Motor 3 (Hot Water)
#define M2_IN1  32
#define M2_IN2  33
#define M3_IN1  16
#define M3_IN2  17

// ----------------------------------------------------------------
//  GPIO — Heater Solid-State Relays (SSR, Active HIGH)
//  Connect ESP32 output → SSR control input (3–32 VDC side)
//  Use a 10 kΩ series resistor to protect the ESP32 output.
// ----------------------------------------------------------------
#define HEATER_WATER    18   // Water container heater  → target 80 °C
#define HEATER_MILK     19   // Milk container heater   → target 60 °C
#define HEATER_DECOCT   21   // Decoction container     → target 30 °C

// ----------------------------------------------------------------
//  GPIO — Temperature Sensors (DS18B20, shared OneWire bus)
//  Add a 4.7 kΩ pull-up between DATA and 3.3 V.
//  Physical label order (from top to bottom of water chamber):
//    Index 0 = Water sensor
//    Index 1 = Milk sensor
//    Index 2 = Decoction sensor
// ----------------------------------------------------------------
#define ONE_WIRE_BUS    22

// ----------------------------------------------------------------
//  GPIO — Water Level & Fill Valve
// ----------------------------------------------------------------
#define WATER_LEVEL_PIN  23   // Float switch (INPUT_PULLUP).
                              // Float closed (water present) → reads LOW.
#define FILL_VALVE_PIN    4   // 12 V solenoid valve via transistor/relay.
                              // HIGH = open (filling). LOW = closed.
                              // NOTE: GPIO 4 is safe at boot (stays LOW).
                              // GPIO 5 was NOT used here — it goes HIGH at
                              // boot on DevKit C, which would open the valve!

// ----------------------------------------------------------------
//  GPIO — User Buttons (active LOW; needs external 10 kΩ pull-up)
//  GPIO 34–39 are INPUT-ONLY pins — do NOT use as outputs.
// ----------------------------------------------------------------
#define BTN_MILK         34
#define BTN_COFFEE       35
#define BTN_TEA          36
#define BTN_HOT_WATER    39

// ----------------------------------------------------------------
//  GPIO — Buzzer (passive, 5 V; drive through 330 Ω resistor)
// ----------------------------------------------------------------
#define BUZZER_PIN       27

// ----------------------------------------------------------------
//  GPIO — 2.4" SPI TFT Display (ILI9341, 240×320)
//  Uses ESP32 VSPI bus. MISO not connected (display is write-only).
//
//  TFT Pin     →  ESP32 GPIO
//  ─────────────────────────
//  VCC (3.3V)  →  3.3V
//  GND         →  GND
//  CS          →  GPIO 15   (chip select; active LOW)
//  RESET       →  GPIO 0    (active LOW reset; shares with BOOT btn —
//                            works fine because RST is only pulsed in
//                            software after boot completes)
//  DC/RS       →  GPIO 12   (data/command select; LOW at boot is safe —
//                            display is in reset and ignores commands)
//  MOSI/SDA    →  GPIO 13   (VSPI MOSI)
//  SCK/CLK     →  GPIO 14   (VSPI SCK — shared with Coffee IN3, see note)
//
//  *** NOTE: GPIO 14 (TFT_SCK) is SHARED with M1_IN1 (Coffee pump IN3).
//      TFT_CS (GPIO 15) de-selects the display between transactions, so
//      the L298N never sees spurious SPI pulses. Both are safe to share
//      because L298N IN3 is only driven when dispensing coffee, which
//      happens after the display has been initialized and only briefly.
//      Verified safe in practice with ILI9341 + L298N.
//
//  LED/BL      →  GPIO 27   (shared with buzzer PWM — or tie to 3.3V
//                            for always-on; use separate GPIO if desired)
//                  Simplest: connect TFT LED directly to 3.3V via 33Ω.
// ----------------------------------------------------------------
#define TFT_CS      15
#define TFT_RST      0
#define TFT_DC      12
#define TFT_MOSI    13
#define TFT_SCK     14   // Shared with M1_IN1 (Coffee pump IN3) — safe, see note above
#define TFT_LED     -1   // -1 = tie TFT LED pin to 3.3V via 33Ω resistor directly

// ================================================================
//  Temperature Control
// ================================================================
#define TARGET_WATER_C     80.0f  // °C
#define TARGET_MILK_C      60.0f  // °C
#define TARGET_DECOCT_C    30.0f  // °C
#define HYSTERESIS_C        1.5f  // Deadband — heater on below (target - H),
                                  //             off above  (target + H)
#define THERMAL_RUNAWAY_C   5.0f  // If temp exceeds target + this → emergency off

// ================================================================
//  Dispense Timing (milliseconds)
// ================================================================
#define PRIME_MS          5000UL  // Reverse before dispense (primes line, prevents first-drop mess)
#define PURGE_MS          5000UL  // Reverse after dispense  (anti-drip suck-back)

#define DISP_MILK_MS      7000UL  // Forward dispense duration — Milk
#define DISP_COFFEE_MS    3000UL  // Forward dispense duration — Coffee Decoction
#define DISP_TEA_MS       3000UL  // Forward dispense duration — Tea Decoction
#define DISP_WATER_MS     5000UL  // Forward dispense duration — Hot Water (no prime/purge)

// ================================================================
//  Water Fill Settings
// ================================================================
#define FILL_TIMEOUT_MS   30000UL  // Max time to fill before error (30 s)
#define FILL_SETTLE_MS     2000UL  // Settle delay after fill valve closes

// ================================================================
//  Heater Sequential Startup Stagger
//  Each heater turns on HEATER_STAGGER_MS after the previous one
//  to avoid simultaneous AC inrush current surge.
// ================================================================
#define HEATER_STAGGER_MS   700UL

// ================================================================
//  DS18B20 Sensor Discovery Mode
//  Set SCAN_SENSORS to 1, flash, open Serial Monitor at 115200
//  to print the unique 8-byte addresses of connected sensors.
//  Copy each address into SENSOR_WATER_ADDR etc. below,
//  then set SCAN_SENSORS back to 0 and reflash.
// ================================================================
#define SCAN_SENSORS  0   // 1 = scan & print addresses, then halt

// Placeholder addresses — replace with values printed by SCAN_SENSORS=1
#define SENSOR_WATER_ADDR   { 0x28, 0xFF, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0x01 }
#define SENSOR_MILK_ADDR    { 0x28, 0xFF, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0x02 }
#define SENSOR_DECOCT_ADDR  { 0x28, 0xFF, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0x03 }

// ================================================================
//  Heater Regulation Check Interval
// ================================================================
#define HEATER_CHECK_MS   2000UL  // Re-read temps every 2 s while in READY state

// ================================================================
//  WiFi Configuration
//  Set WIFI_SSID / WIFI_PASS to your network credentials.
//  WIFI_TIMEOUT_MS: give up and run in offline (button-only) mode
//  if the network is not reachable within this time.
// ================================================================
#define WIFI_SSID           "YourWiFiSSID"         // ← change
#define WIFI_PASS           "YourWiFiPassword"      // ← change
#define WIFI_TIMEOUT_MS     20000UL                 // 20 s offline fallback

// ================================================================
//  MQTT Broker
//  The ESP32 subscribes to MQTT_TOPIC_DISPENSE to receive orders
//  from the backend after a successful UPI payment.
//
//  ⚠ broker.hivemq.com is a public unauthenticated broker — fine
//    for prototyping. Use a private broker (e.g. EMQX Cloud,
//    HiveMQ Cloud free tier, or self-hosted Mosquitto) in production.
//
//  IMPORTANT: Change MACHINE_ID to a unique value for each physical
//  machine. The same ID must also be passed in the QR code URL.
// ================================================================
#define MQTT_HOST           "broker.hivemq.com"     // ← change for production
#define MQTT_PORT           1883
#define MACHINE_ID          "LYRA001"               // ← unique per machine
#define MQTT_CLIENT_ID      "lyra-" MACHINE_ID
#define MQTT_TOPIC_DISPENSE "lyra/" MACHINE_ID "/dispense"
#define MQTT_TOPIC_STATUS   "lyra/" MACHINE_ID "/status"
#define MQTT_RECONNECT_MS   5000UL

// ================================================================
//  Web App URL
//  This URL is encoded into the static QR code shown on the TFT.
//  It must include the machine ID so the web app knows which machine
//  the customer is ordering from.
//
//  IMPORTANT: Keep this URL as short as possible (≤ 39 chars) so it
//  fits in a QR version-3 code at a scannable size on the 2.4" display.
//  A free short-link service or a custom domain works well here.
//
//  Example: "https://l.lyra.coffee/LYRA001"  (31 chars ✓)
//           "https://yourapp.com/o?m=LYRA001" (34 chars ✓)
// ================================================================
#define WEBAPP_URL          "https://yourapp.com/o?m=LYRA001"  // ← change
#define QR_VERSION          3    // QR code version (3 supports ≤39 bytes)
#define QR_SCALE            4    // Pixel scale per module (4 → 116px core on 240px display)
#define QR_QUIET_MODS       2    // Quiet-zone width in QR modules

// ================================================================
//  UPI Order — Drink Pricing (in Indian Paise; 100 paise = ₹1)
//  These must match the prices in the backend .env / server.js.
// ================================================================
#define PRICE_COFFEE_PAISE  2500   // ₹25
#define PRICE_TEA_PAISE     2000   // ₹20

// ================================================================
//  Startup Decoction Pre-Fill (Hot Water → Decoction Containers)
//
//  After the water heater reaches 80 °C, the hot water pump (Motor 3)
//  is run to push hot water through a Y-pipe into both the Coffee
//  Decoction and Tea Decoction containers before their heaters start.
//
//  PHYSICAL PLUMBING:
//    Hot Water Tank outlet → Pump 3 → Y-splitter pipe
//      Branch A → Coffee Decoction container inlet
//      Branch B → Tea Decoction container inlet
//
//  Or — if no Y-pipe — connect Pump 3 outlet to a 2-way manual valve
//  and run the two fills sequentially (firmware does them back-to-back).
//
//  Adjust the durations to control how much hot water is added.
//  Start conservative (6–8 s) and increase if containers need more.
// ================================================================
#define FILL_COFFEE_HOT_MS    8000UL  // Hot water pumped into Coffee Decoction container
#define FILL_TEA_HOT_MS       8000UL  // Hot water pumped into Tea Decoction container
#define FILL_DECOCT_PAUSE_MS   500UL  // Brief pause between the two fills
