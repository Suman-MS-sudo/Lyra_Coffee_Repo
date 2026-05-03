/**
 * ================================================================
 *  Lyra Coffee Machine — ESP32 Firmware
 *  src/main.cpp
 *
 *  Architecture: Finite State Machine
 *
 *    Power ON
 *      │
 *      ▼
 *   S_CHECK_WATER ──(no water)──> S_ERROR_NO_WATER
 *      │ (has water)                    │ (retry every 10 s)
 *      ▼                                └──────────────────┐
 *   S_FILLING ──(fill failed)──> S_ERROR_FILL              │
 *      │ (filled OK)                                        │
 *      ▼                                                    │
 *   S_HEAT_WATER  — heat water to 80 °C first               │
 *      │ (water ready)                                       │
 *      ▼                                                    │
 *   S_FILL_DECOCTIONS  — pump hot water into Coffee &        │
 *      │  Tea Decoction containers via Pump 3 (Motor 3)     │
 *      ▼                                                    │
 *   S_HEAT_MILK_DECOCT — heat milk (60°C) then decoct(30°C)│
 *      │ (all temps reached)                                │
 *      ▼                                                    │
 *   S_READY ←───────────────────────────────────────────────┘
 *      │ (button pressed)
 *      ▼
 *   S_DISPENSING  (blocking dispense sequence)
 *      │ (done)
 *      └──────────> S_READY
 *
 *  Motor sequences:
 *    Milk / Coffee / Tea  : Reverse PRIME_MS → Forward DISP_Xms → Reverse PURGE_MS
 *    Hot Water            : Forward DISP_WATER_MS only
 *
 *  Heater startup (3-phase, staggered):
 *    Phase 1 — S_HEAT_WATER     : Water heater ON → wait 80 °C
 *    Phase 2 — S_FILL_DECOCTIONS: Pump hot water to Coffee & Tea containers
 *    Phase 3 — S_HEAT_MILK_DECOCT: Milk heater ON → 60 °C, then Decoction ON → 30 °C
 *
 *  Build:  pio run
 *  Flash:  pio run --target upload
 *  Monitor: pio device monitor
 *
 *  Serial commands (for bench testing, 115200 baud):
 *    1 → Dispense Milk
 *    2 → Dispense Coffee
 *    3 → Dispense Tea
 *    4 → Dispense Hot Water
 *    t → Print current temperatures
 *    r → Restart ESP32
 * ================================================================
 */

#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <TFT_eSPI.h>        // ILI9341 2.4" 240×320 SPI display
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <qrcode.h>          // ricmoo/QRCode
#include "config.h"

// ================================================================
//  TFT Display
// ================================================================
static TFT_eSPI tft;

// ================================================================
//  WiFi / MQTT
// ================================================================
static WiFiClient   espClient;
static PubSubClient mqtt(espClient);

// ================================================================
//  UPI Payment — Pending Dispense Command
//  Set by the MQTT callback when the backend confirms payment.
//  Processed in the S_READY state on the next loop iteration.
// ================================================================
struct DispenseCmd {
    uint8_t drinkIdx;      // 0 = milk-only, 1 = coffee, 2 = tea
    uint8_t milkPct;       // 0 – 100 %  (scales DISP_MILK_MS)
    uint8_t strength;      // 0 = light (0.6×), 1 = medium (1.0×), 2 = strong (1.5×)
    char    orderId[32];   // Razorpay order ID — for serial logging
};

static DispenseCmd pendingCmd     = {};
static bool        pendingDispense = false;

// Colour palette
#define COL_BG       TFT_BLACK
#define COL_TITLE    TFT_CYAN
#define COL_LABEL    TFT_DARKGREY
#define COL_VALUE    TFT_WHITE
#define COL_HOT      TFT_RED
#define COL_WARM     TFT_ORANGE
#define COL_COOL     TFT_SKYBLUE
#define COL_OK       TFT_GREEN
#define COL_ERROR    TFT_RED
#define COL_HEATING  TFT_YELLOW
#define COL_READY    TFT_GREEN

/** Clear screen and draw the fixed chrome (title bar + dividers). */
static void tftDrawChrome() {
    tft.fillScreen(COL_BG);
    // Title bar
    tft.fillRect(0, 0, 240, 28, TFT_NAVY);
    tft.setTextColor(COL_TITLE, TFT_NAVY);
    tft.setTextSize(2);
    tft.setCursor(10, 6);
    tft.print("Lyra Coffee");
    // Horizontal divider under title
    tft.drawFastHLine(0, 28, 240, TFT_CYAN);
    // Section labels (static — drawn once)
    tft.setTextColor(COL_LABEL, COL_BG);
    tft.setTextSize(1);
    tft.setCursor(8,  40); tft.print("WATER");
    tft.setCursor(8,  80); tft.print("MILK");
    tft.setCursor(8, 120); tft.print("DECOCTION");
    tft.drawFastHLine(0, 155, 240, 0x2945);  // subtle divider
    tft.setCursor(8, 162); tft.print("STATUS");
}

/**
 * Update one chamber row:
 *   y = top pixel of the row
 *   label already drawn — only update the temperature value and bar.
 */
static void tftUpdateTemp(int16_t y, float current, float target) {
    // Clear value area
    tft.fillRect(0, y + 10, 240, 28, COL_BG);

    // Colour: blue if cold, yellow if heating, green if at target
    uint16_t col;
    if (current < target - 5.0f)       col = COL_COOL;
    else if (current < target - 1.5f)  col = COL_HEATING;
    else                               col = COL_OK;

    tft.setTextColor(col, COL_BG);
    tft.setTextSize(2);
    tft.setCursor(8, y + 12);
    tft.printf("%.1f / %.0f C", current, target);

    // Progress bar (160 px wide, 6 px tall)
    int16_t barX = 8, barY = y + 30, barW = 160, barH = 5;
    tft.drawRect(barX, barY, barW, barH, TFT_DARKGREY);
    float pct = current / target;
    if (pct > 1.0f) pct = 1.0f;
    int16_t fill = (int16_t)(pct * (barW - 2));
    if (fill > 0) tft.fillRect(barX + 1, barY + 1, fill, barH - 2, col);
}

/** Show a full-screen status message (state transitions). */
static void tftShowStatus(const char* line1, const char* line2,
                           uint16_t colour, bool clearScreen = false) {
    if (clearScreen) tft.fillRect(0, 162, 240, 158, COL_BG);
    tft.fillRect(0, 162, 240, 18, COL_BG);  // clear label area
    tft.setTextColor(COL_LABEL, COL_BG);
    tft.setTextSize(1);
    tft.setCursor(8, 162); tft.print("STATUS");
    tft.fillRect(0, 178, 240, 60, COL_BG);
    tft.setTextColor(colour, COL_BG);
    tft.setTextSize(2);
    tft.setCursor(8, 180); tft.print(line1);
    tft.setCursor(8, 204); tft.print(line2);
}

/** Shown during dispense — which drink + progress. */
static void tftShowDispense(const char* drinkName, const char* phase) {
    tft.fillRect(0, 178, 240, 60, COL_BG);
    tft.setTextColor(TFT_CYAN, COL_BG);
    tft.setTextSize(2);
    tft.setCursor(8, 180); tft.print(drinkName);
    tft.setTextColor(TFT_YELLOW, COL_BG);
    tft.setCursor(8, 204); tft.print(phase);
}

/** Draw drink menu icons at the bottom of the screen. */
static void tftDrawMenu() {
    int16_t y = 250;
    tft.fillRect(0, y, 240, 70, COL_BG);
    tft.drawFastHLine(0, y, 240, 0x2945);
    tft.setTextColor(COL_LABEL, COL_BG);
    tft.setTextSize(1);
    const char* labels[4] = { "MILK", "COFFEE", "TEA", "HOT H2O" };
    for (int i = 0; i < 4; i++) {
        int16_t x = 8 + i * 58;
        tft.drawRect(x, y + 6, 50, 22, TFT_DARKGREY);
        tft.setCursor(x + 3, y + 12);
        tft.print(labels[i]);
        // Button number
        tft.setTextColor(TFT_CYAN, COL_BG);
        tft.setCursor(x + 18, y + 34);
        tft.printf("B%d", i + 1);
        tft.setTextColor(COL_LABEL, COL_BG);
    }
}

/**
 * Draw the READY screen: compact temperature summary at top,
 * then a static QR code in the lower portion of the display.
 * The QR encodes WEBAPP_URL so the customer can scan and order.
 *
 * Layout (portrait 240×320):
 *   0 – 28  : Title bar (unchanged)
 *  28 – 155 : Temperature rows  (drawn by tftUpdateTemp — unchanged)
 * 155 – 160 : Divider
 * 160 – 292 : QR code (version 3, scale 4, 2-module quiet zone)
 * 293 – 319 : Labels: "Scan to Order" + WiFi status
 */
static void tftDrawQRReady() {
    // Clear lower section
    tft.fillRect(0, 156, 240, 164, COL_BG);
    tft.drawFastHLine(0, 156, 240, TFT_CYAN);

    // ---- Generate QR code ----
    QRCode qrcode;
    static uint8_t qrData[200];   // 200 bytes covers version ≤ 7
    qrcode_initText(&qrcode, qrData, QR_VERSION, ECC_LOW, WEBAPP_URL);

    const int SCALE = QR_SCALE;
    const int QUIET = QR_QUIET_MODS * SCALE;
    int full  = (int)qrcode.size * SCALE + 2 * QUIET;
    int xOff  = (240 - full) / 2;
    int yOff  = 160;

    // White quiet-zone background
    tft.fillRect(xOff, yOff, full, full, TFT_WHITE);

    // Draw only the dark modules (saves ~50 % fillRect calls)
    for (uint8_t qy = 0; qy < qrcode.size; qy++) {
        for (uint8_t qx = 0; qx < qrcode.size; qx++) {
            if (qrcode_getModule(&qrcode, qx, qy)) {
                tft.fillRect(xOff + QUIET + qx * SCALE,
                             yOff + QUIET + qy * SCALE,
                             SCALE, SCALE, TFT_BLACK);
            }
        }
    }

    // ---- Labels below QR ----
    int labelY = yOff + full + 3;
    tft.setTextSize(1);
    tft.setTextColor(TFT_CYAN, COL_BG);
    tft.setCursor(8, labelY);
    tft.print("  Scan QR to order & pay via UPI");

    int statusY = labelY + 11;
    if (statusY < 318) {
        bool wifiOK = (WiFi.status() == WL_CONNECTED);
        tft.setTextColor(wifiOK ? TFT_GREEN : TFT_ORANGE, COL_BG);
        tft.setCursor(8, statusY);
        tft.print(wifiOK ? "  WiFi OK  | Physical btns also work"
                         : "  WiFi offline | Physical btns only ");
    }
}

/** Brief confirmation screen shown for 2 s after an MQTT order arrives. */
static void tftShowOrderReceived(const DispenseCmd& cmd) {
    tft.fillRect(0, 156, 240, 164, COL_BG);
    tft.drawFastHLine(0, 156, 240, TFT_CYAN);

    tft.setTextColor(TFT_GREEN, COL_BG);
    tft.setTextSize(2);
    tft.setCursor(10, 165); tft.print("Order Placed!");

    const char* drinkName = (cmd.drinkIdx == 1) ? "Coffee"
                          : (cmd.drinkIdx == 2) ? "Tea"
                          :                       "Milk";
    const char* strName   = (cmd.strength == 0) ? "Light"
                          : (cmd.strength == 2) ? "Strong"
                          :                       "Medium";

    tft.setTextSize(1);
    tft.setTextColor(TFT_WHITE, COL_BG);
    tft.setCursor(10, 195); tft.printf("Drink    : %s", drinkName);
    tft.setCursor(10, 209); tft.printf("Milk     : %d%%", cmd.milkPct);
    tft.setCursor(10, 223); tft.printf("Strength : %s", strName);
    tft.setTextColor(TFT_DARKGREY, COL_BG);
    tft.setCursor(10, 241); tft.printf("Order: %.20s", cmd.orderId);
}
// ================================================================
static OneWire         oneWire(ONE_WIRE_BUS);
static DallasTemperature sensors(&oneWire);

// ================================================================
//  State Machine
// ================================================================
enum State : uint8_t {
    S_CHECK_WATER,
    S_ERROR_NO_WATER,
    S_FILLING,
    S_HEAT_WATER,        // Phase 1: heat water tank to 80 °C only
    S_FILL_DECOCTIONS,   // Phase 2: pump hot water into decoction containers
    S_HEAT_MILK_DECOCT,  // Phase 3: heat milk (60°C) then decoction (30°C)
    S_READY,
    S_DISPENSING,
    S_ERROR_FILL
};

static State state = S_CHECK_WATER;

// ================================================================
//  Live temperature readings (updated by regulateHeaters)
// ================================================================
static float tempWater  = 0.0f;
static float tempMilk   = 0.0f;
static float tempDecoct = 0.0f;

// ================================================================
//  Motor pin lookup tables
//  Index: 0=Milk  1=Coffee  2=Tea  3=HotWater
// ================================================================
static const uint8_t MOTOR_IN1[4] = { M0_IN1, M1_IN1, M2_IN1, M3_IN1 };
static const uint8_t MOTOR_IN2[4] = { M0_IN2, M1_IN2, M2_IN2, M3_IN2 };

// ================================================================
//  LOW-LEVEL MOTOR HELPERS
// ================================================================

static inline void motorStop(uint8_t idx) {
    digitalWrite(MOTOR_IN1[idx], LOW);
    digitalWrite(MOTOR_IN2[idx], LOW);
}

static inline void motorForward(uint8_t idx) {
    digitalWrite(MOTOR_IN1[idx], HIGH);
    digitalWrite(MOTOR_IN2[idx], LOW);
}

static inline void motorReverse(uint8_t idx) {
    digitalWrite(MOTOR_IN1[idx], LOW);
    digitalWrite(MOTOR_IN2[idx], HIGH);
}

// ================================================================
//  DISPENSE SEQUENCES
// ================================================================

/**
 * Full dispense sequence for peristaltic pumps 0-2:
 *   Phase 1 — PRIME   : Reverse PRIME_MS  (clears the line, prevents messy first drop)
 *   Phase 2 — DISPENSE: Forward dispenseMs (delivers measured volume)
 *   Phase 3 — PURGE   : Reverse PURGE_MS  (sucks liquid back to prevent post-drip)
 *
 * Motor 3 (hot water) runs forward only — no prime/purge.
 */
static void dispense(uint8_t idx, unsigned long dispenseMs) {
    if (idx < 3) {
        // --- PRIME ---
        Serial.printf("[MOTOR %d] PRIME  : %lu ms reverse\n", idx + 1, PRIME_MS);
        motorReverse(idx);
        delay(PRIME_MS);
        motorStop(idx);
        delay(120);

        // --- DISPENSE ---
        Serial.printf("[MOTOR %d] DISPENSE: %lu ms forward\n", idx + 1, dispenseMs);
        motorForward(idx);
        delay(dispenseMs);
        motorStop(idx);
        delay(120);

        // --- PURGE ---
        Serial.printf("[MOTOR %d] PURGE  : %lu ms reverse\n", idx + 1, PURGE_MS);
        motorReverse(idx);
        delay(PURGE_MS);
        motorStop(idx);

    } else {
        // Hot water — forward only
        Serial.printf("[MOTOR %d] DISPENSE: %lu ms forward (hot water)\n", idx + 1, dispenseMs);
        motorForward(idx);
        delay(dispenseMs);
        motorStop(idx);
    }

    Serial.printf("[MOTOR %d] Done.\n", idx + 1);
}

static void dispenseMilk()   { dispense(0, DISP_MILK_MS);   }
static void dispenseCoffee() { dispense(1, DISP_COFFEE_MS);  }
static void dispenseTea()    { dispense(2, DISP_TEA_MS);     }
static void dispenseWater()  { dispense(3, DISP_WATER_MS);   }

// ================================================================
//  HEATER CONTROL
// ================================================================

/**
 * Read all three sensors and apply bang-bang control with HYSTERESIS_C deadband.
 * Also enforces thermal runaway protection — if any sensor reads more than
 * THERMAL_RUNAWAY_C above its target, all heaters are cut immediately.
 */
static void regulateHeaters() {
    sensors.requestTemperatures();

    float t0 = sensors.getTempCByIndex(0);
    float t1 = sensors.getTempCByIndex(1);
    float t2 = sensors.getTempCByIndex(2);

    // Only accept valid readings (DS18B20 returns -127 on disconnect)
    if (t0 > -50.0f) tempWater  = t0;
    if (t1 > -50.0f) tempMilk   = t1;
    if (t2 > -50.0f) tempDecoct = t2;

    // ---- Thermal runaway guard ----
    if (tempWater  > TARGET_WATER_C  + THERMAL_RUNAWAY_C ||
        tempMilk   > TARGET_MILK_C   + THERMAL_RUNAWAY_C ||
        tempDecoct > TARGET_DECOCT_C + THERMAL_RUNAWAY_C) {
        digitalWrite(HEATER_WATER,  LOW);
        digitalWrite(HEATER_MILK,   LOW);
        digitalWrite(HEATER_DECOCT, LOW);
        Serial.println("[!!! SAFETY] THERMAL RUNAWAY — all heaters OFF.");
        return;
    }

    // ---- Bang-bang regulation ----
    if (tempWater  < TARGET_WATER_C  - HYSTERESIS_C) digitalWrite(HEATER_WATER,  HIGH);
    if (tempWater  > TARGET_WATER_C  + HYSTERESIS_C) digitalWrite(HEATER_WATER,  LOW);

    if (tempMilk   < TARGET_MILK_C   - HYSTERESIS_C) digitalWrite(HEATER_MILK,   HIGH);
    if (tempMilk   > TARGET_MILK_C   + HYSTERESIS_C) digitalWrite(HEATER_MILK,   LOW);

    if (tempDecoct < TARGET_DECOCT_C - HYSTERESIS_C) digitalWrite(HEATER_DECOCT, HIGH);
    if (tempDecoct > TARGET_DECOCT_C + HYSTERESIS_C) digitalWrite(HEATER_DECOCT, LOW);
}

static void allHeatersOff() {
    digitalWrite(HEATER_WATER,  LOW);
    digitalWrite(HEATER_MILK,   LOW);
    digitalWrite(HEATER_DECOCT, LOW);
}

static bool allTempsReady() {
    return (tempWater  >= TARGET_WATER_C  - HYSTERESIS_C) &&
           (tempMilk   >= TARGET_MILK_C   - HYSTERESIS_C) &&
           (tempDecoct >= TARGET_DECOCT_C - HYSTERESIS_C);
}

// ================================================================
//  STARTUP PHASE 1 — Heat water tank to 80 °C
//  Called from S_HEAT_WATER state.
// ================================================================
static void startupHeatWater() {
    Serial.println("[HEAT-P1] Water heater ON → target 80 °C");
    tftShowStatus("Heating Water", "Target: 80C", COL_HEATING);
    digitalWrite(HEATER_WATER, HIGH);

    while (true) {
        sensors.requestTemperatures();
        float t = sensors.getTempCByIndex(0);
        if (t > -50.0f) tempWater = t;
        Serial.printf("[HEAT-P1] Water = %.1f °C  (target 80 °C)\n", tempWater);
        tftUpdateTemp(38, tempWater, TARGET_WATER_C);
        if (tempWater >= TARGET_WATER_C - HYSTERESIS_C) break;
        delay(2000);
    }
    Serial.println("[HEAT-P1] Water at 80 °C — ready to fill decoction containers.");
}

// ================================================================
//  STARTUP PHASE 2 — Pump hot water into decoction containers
//
//  Motor 3 (Hot Water pump) pushes water through a Y-pipe that
//  branches into the Coffee Decoction and Tea Decoction containers.
//
//  Plumbing:
//    Hot Water Tank → Pump 3 → Y-splitter
//                               ├─ Branch A → Coffee Decoction inlet
//                               └─ Branch B → Tea Decoction inlet
//
//  The Coffee fill runs first (FILL_COFFEE_HOT_MS), then the Tea fill
//  runs (FILL_TEA_HOT_MS). Water heater stays ON and regulated during
//  the entire fill so temperature doesn't drop significantly.
// ================================================================
static void startupFillDecoctions() {
    // ---- Coffee Decoction fill ----
    Serial.printf("[FILL-D] Filling Coffee Decoction container — %lu ms\n", FILL_COFFEE_HOT_MS);
    tftShowStatus("Filling Coffee", "Decoction...", COL_COOL);
    motorForward(3);    // Pump 3 = Hot Water pump, index 3
    unsigned long start = millis();
    while (millis() - start < FILL_COFFEE_HOT_MS) {
        // Keep water heater regulated during fill
        sensors.requestTemperatures();
        float t = sensors.getTempCByIndex(0);
        if (t > -50.0f) tempWater = t;
        if (tempWater < TARGET_WATER_C - HYSTERESIS_C) digitalWrite(HEATER_WATER, HIGH);
        if (tempWater > TARGET_WATER_C + HYSTERESIS_C) digitalWrite(HEATER_WATER, LOW);
        tftUpdateTemp(38, tempWater, TARGET_WATER_C);
        delay(500);
    }
    motorStop(3);
    Serial.println("[FILL-D] Coffee Decoction fill done.");
    delay(FILL_DECOCT_PAUSE_MS);

    // ---- Tea Decoction fill ----
    Serial.printf("[FILL-D] Filling Tea Decoction container — %lu ms\n", FILL_TEA_HOT_MS);
    tftShowStatus("Filling Tea", "Decoction...", COL_COOL);
    motorForward(3);
    start = millis();
    while (millis() - start < FILL_TEA_HOT_MS) {
        sensors.requestTemperatures();
        float t = sensors.getTempCByIndex(0);
        if (t > -50.0f) tempWater = t;
        if (tempWater < TARGET_WATER_C - HYSTERESIS_C) digitalWrite(HEATER_WATER, HIGH);
        if (tempWater > TARGET_WATER_C + HYSTERESIS_C) digitalWrite(HEATER_WATER, LOW);
        tftUpdateTemp(38, tempWater, TARGET_WATER_C);
        delay(500);
    }
    motorStop(3);
    Serial.println("[FILL-D] Tea Decoction fill done. Hot water distributed.");
}

// ================================================================
//  STARTUP PHASE 3 — Heat milk (60°C) then decoction (30°C)
//  Water heater already running; milk and decoction now added.
// ================================================================
static void startupHeatMilkDecoct() {
    delay(HEATER_STAGGER_MS);

    // ---- Milk heater ----
    Serial.println("[HEAT-P3] Milk heater ON → target 60 °C");
    tftShowStatus("Heating Milk", "Target: 60C", COL_HEATING);
    digitalWrite(HEATER_MILK, HIGH);

    while (true) {
        sensors.requestTemperatures();
        float t0 = sensors.getTempCByIndex(0);
        float t1 = sensors.getTempCByIndex(1);
        if (t0 > -50.0f) tempWater = t0;
        if (t1 > -50.0f) tempMilk  = t1;
        if (tempWater < TARGET_WATER_C - HYSTERESIS_C) digitalWrite(HEATER_WATER, HIGH);
        if (tempWater > TARGET_WATER_C + HYSTERESIS_C) digitalWrite(HEATER_WATER, LOW);
        Serial.printf("[HEAT-P3] Milk = %.1f °C  |  Water = %.1f °C\n", tempMilk, tempWater);
        tftUpdateTemp(38, tempWater, TARGET_WATER_C);
        tftUpdateTemp(78, tempMilk,  TARGET_MILK_C);
        if (tempMilk >= TARGET_MILK_C - HYSTERESIS_C) break;
        delay(2000);
    }
    Serial.println("[HEAT-P3] Milk at target.");
    delay(HEATER_STAGGER_MS);

    // ---- Decoction heater ----
    Serial.println("[HEAT-P3] Decoction heater ON → target 30 °C");
    tftShowStatus("Heating Decoct", "Target: 30C", COL_HEATING);
    digitalWrite(HEATER_DECOCT, HIGH);

    while (true) {
        sensors.requestTemperatures();
        float t0 = sensors.getTempCByIndex(0);
        float t1 = sensors.getTempCByIndex(1);
        float t2 = sensors.getTempCByIndex(2);
        if (t0 > -50.0f) tempWater  = t0;
        if (t1 > -50.0f) tempMilk   = t1;
        if (t2 > -50.0f) tempDecoct = t2;
        if (tempWater < TARGET_WATER_C - HYSTERESIS_C) digitalWrite(HEATER_WATER, HIGH);
        if (tempWater > TARGET_WATER_C + HYSTERESIS_C) digitalWrite(HEATER_WATER, LOW);
        if (tempMilk  < TARGET_MILK_C  - HYSTERESIS_C) digitalWrite(HEATER_MILK,  HIGH);
        if (tempMilk  > TARGET_MILK_C  + HYSTERESIS_C) digitalWrite(HEATER_MILK,  LOW);
        Serial.printf("[HEAT-P3] Decoct = %.1f °C  |  Milk = %.1f °C  |  Water = %.1f °C\n",
                      tempDecoct, tempMilk, tempWater);
        tftUpdateTemp( 38, tempWater,  TARGET_WATER_C);
        tftUpdateTemp( 78, tempMilk,   TARGET_MILK_C);
        tftUpdateTemp(118, tempDecoct, TARGET_DECOCT_C);
        if (tempDecoct >= TARGET_DECOCT_C - HYSTERESIS_C) break;
        delay(2000);
    }
    Serial.println("[HEAT-P3] All chambers at target. Machine ready!");
}

// ================================================================
//  WATER LEVEL & FILL VALVE
// ================================================================

/**
 * Returns true when the float switch closes (water level is OK).
 * With INPUT_PULLUP: float closed = pulled to GND = reads LOW.
 */
static bool waterLevelOK() {
    return digitalRead(WATER_LEVEL_PIN) == LOW;
}

/**
 * Opens the fill valve and waits until the float switch closes.
 * Returns false if the fill times out (supply problem).
 */
static bool fillContainer() {
    if (waterLevelOK()) {
        Serial.println("[FILL] Container already full — skipping fill.");
        return true;
    }

    Serial.println("[FILL] Opening fill valve...");
    digitalWrite(FILL_VALVE_PIN, HIGH);

    unsigned long start = millis();
    while (!waterLevelOK()) {
        if (millis() - start > FILL_TIMEOUT_MS) {
            digitalWrite(FILL_VALVE_PIN, LOW);
            Serial.println("[FILL] TIMEOUT — check water supply line!");
            return false;
        }
        delay(100);
    }

    digitalWrite(FILL_VALVE_PIN, LOW);
    delay(FILL_SETTLE_MS);
    Serial.println("[FILL] Container filled successfully.");
    return true;
}

// ================================================================
//  BUZZER
// ================================================================

static void buzz(uint16_t freqHz, uint16_t durationMs) {
    tone(BUZZER_PIN, freqHz, durationMs);
    delay((uint32_t)durationMs + 40);
    noTone(BUZZER_PIN);
}

static void beepOK()       { buzz(1000, 150); buzz(1500, 250); }
static void beepReady()    { buzz(1000, 100); buzz(1250, 100); buzz(1600, 250); }
static void beepDispense() { buzz(1200, 80); }
static void beepError() {
    for (int i = 0; i < 3; i++) { buzz(400, 300); delay(100); }
}

// ================================================================
//  WiFi helpers
// ================================================================

/** Connect to the configured WiFi network.
 *  Returns true on success; false if timed out (offline mode). */
static bool connectWiFi() {
    tftShowStatus("Connecting", "WiFi...", COL_HEATING);
    Serial.printf("[WiFi] Connecting to \"%s\"\n", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - start > WIFI_TIMEOUT_MS) {
            Serial.println("[WiFi] Timeout — running in offline mode (physical buttons only).");
            tftShowStatus("WiFi Timeout", "Offline mode", TFT_ORANGE);
            delay(1500);
            return false;
        }
        delay(500);
        Serial.print('.');
    }
    Serial.printf("\n[WiFi] Connected. IP: %s\n", WiFi.localIP().toString().c_str());
    return true;
}

// ================================================================
//  MQTT helpers
// ================================================================

/** Called by PubSubClient when a message arrives on a subscribed topic.
 *  Parses the JSON payload and stores the dispense command for the
 *  main loop to pick up. */
static void mqttCallback(char* topic, byte* payload, unsigned int length) {
    if (length == 0 || length > 255) {
        Serial.println("[MQTT] Ignored: payload empty or too large.");
        return;
    }
    // Copy payload to null-terminated buffer
    char msg[256];
    memcpy(msg, payload, length);
    msg[length] = '\0';

    Serial.printf("[MQTT] Received on %s: %s\n", topic, msg);

    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, msg) != DeserializationError::Ok) {
        Serial.println("[MQTT] JSON parse error — ignored.");
        return;
    }

    const char* drink    = doc["drink"]    | "coffee";
    int         milkPct  = doc["milk_pct"] | 50;
    const char* strength = doc["strength"] | "medium";
    const char* orderId  = doc["order_id"] | "";

    // Map drink string to motor index
    if      (strcmp(drink, "tea")    == 0) pendingCmd.drinkIdx = 2;
    else if (strcmp(drink, "coffee") == 0) pendingCmd.drinkIdx = 1;
    else                                   pendingCmd.drinkIdx = 0;  // milk-only

    pendingCmd.milkPct  = (uint8_t)constrain(milkPct, 0, 100);

    if      (strcmp(strength, "light")  == 0) pendingCmd.strength = 0;
    else if (strcmp(strength, "strong") == 0) pendingCmd.strength = 2;
    else                                      pendingCmd.strength = 1;

    strncpy(pendingCmd.orderId, orderId, sizeof(pendingCmd.orderId) - 1);
    pendingCmd.orderId[sizeof(pendingCmd.orderId) - 1] = '\0';

    pendingDispense = true;
    Serial.printf("[MQTT] Order queued: drink=%s, milk=%d%%, strength=%s, orderId=%s\n",
                  drink, pendingCmd.milkPct, strength, pendingCmd.orderId);
}

/** (Re)connect to the MQTT broker.  Rate-limited to MQTT_RECONNECT_MS.
 *  Only call when WiFi is connected. */
static void mqttReconnect() {
    static unsigned long lastAttemptMs = 0;
    if (millis() - lastAttemptMs < MQTT_RECONNECT_MS) return;
    lastAttemptMs = millis();

    // Append lower 24 bits of MAC to client ID for uniqueness
    char clientId[48];
    snprintf(clientId, sizeof(clientId), "%s-%06X",
             MQTT_CLIENT_ID, (uint32_t)(ESP.getEfuseMac() & 0xFFFFFFULL));

    Serial.printf("[MQTT] Connecting to %s:%d as %s ...\n", MQTT_HOST, MQTT_PORT, clientId);
    if (mqtt.connect(clientId)) {
        mqtt.subscribe(MQTT_TOPIC_DISPENSE);
        mqtt.publish(MQTT_TOPIC_STATUS, "{\"status\":\"online\",\"machine\":\"" MACHINE_ID "\"}");
        Serial.printf("[MQTT] Connected. Subscribed to %s\n", MQTT_TOPIC_DISPENSE);
    } else {
        Serial.printf("[MQTT] Failed (rc=%d). Retry in %lu ms.\n",
                      mqtt.state(), MQTT_RECONNECT_MS);
    }
}

// ================================================================
//  Parameterised Dispense
//  Executes a full milk + decoction sequence based on the ratios
//  received from the web-app order.
// ================================================================

/** Dispense an order from the web app.
 *  cmd.milkPct  scales the base DISP_MILK_MS   (0 = skip milk).
 *  cmd.strength applies a multiplier to the decoction duration:
 *               0 (light) = 0.6×,  1 (medium) = 1.0×,  2 (strong) = 1.5× */
static void dispenseOrder(const DispenseCmd& cmd) {
    static const float strengthMult[3] = { 0.6f, 1.0f, 1.5f };
    float mult = strengthMult[constrain(cmd.strength, 0, 2)];

    const char* drinkName = (cmd.drinkIdx == 1) ? "Coffee"
                          : (cmd.drinkIdx == 2) ? "Tea"
                          :                       "Milk";

    // ---- Milk pump (Motor 0) ----
    unsigned long milkMs = (DISP_MILK_MS * (unsigned long)cmd.milkPct) / 100UL;
    if (milkMs > 0) {
        tftShowDispense(drinkName, "Adding Milk...");
        Serial.printf("[ORDER] Milk: %lu ms\n", milkMs);
        dispense(0, milkMs);
    }

    // ---- Decoction pump (Motor 1 = coffee, Motor 2 = tea) ----
    if (cmd.drinkIdx == 1 || cmd.drinkIdx == 2) {
        unsigned long baseMs   = (cmd.drinkIdx == 1) ? DISP_COFFEE_MS : DISP_TEA_MS;
        unsigned long decoctMs = (unsigned long)(baseMs * mult);
        tftShowDispense(drinkName, "Decoction...");
        Serial.printf("[ORDER] %s decoction: %lu ms (%.1f× base)\n",
                      drinkName, decoctMs, mult);
        dispense(cmd.drinkIdx, decoctMs);
    }

    Serial.printf("[ORDER] Complete. Order: %s\n", cmd.orderId);
}
// ================================================================

#if SCAN_SENSORS
static void scanAndPrintSensors() {
    int count = sensors.getDeviceCount();
    Serial.printf("\n[SCAN] Found %d DS18B20 sensor(s) on OneWire bus:\n", count);
    DeviceAddress addr;
    for (int i = 0; i < count; i++) {
        sensors.getAddress(addr, i);
        Serial.printf("  Sensor index %d:  { ", i);
        for (int b = 0; b < 8; b++) {
            Serial.printf("0x%02X%s", addr[b], (b < 7) ? ", " : " }\n");
        }
    }
    Serial.println("\nCopy addresses into config.h → SENSOR_*_ADDR");
    Serial.println("Set SCAN_SENSORS=0 and reflash when done.\n");
}
#endif

// ================================================================
//  SETUP
// ================================================================

void setup() {
    Serial.begin(115200);
    Serial.println("\n================================");
    Serial.println("    Lyra Coffee Machine v1.0   ");
    Serial.println("================================");
    Serial.println("[INIT] Initialising hardware...");

    // ---- Motor pins ----
    for (int i = 0; i < 4; i++) {
        pinMode(MOTOR_IN1[i], OUTPUT);
        pinMode(MOTOR_IN2[i], OUTPUT);
        motorStop(i);
    }

    // ---- Heater SSR pins (start OFF) ----
    pinMode(HEATER_WATER,  OUTPUT); digitalWrite(HEATER_WATER,  LOW);
    pinMode(HEATER_MILK,   OUTPUT); digitalWrite(HEATER_MILK,   LOW);
    pinMode(HEATER_DECOCT, OUTPUT); digitalWrite(HEATER_DECOCT, LOW);

    // ---- Fill valve (start closed) ----
    pinMode(FILL_VALVE_PIN, OUTPUT); digitalWrite(FILL_VALVE_PIN, LOW);

    // ---- Buzzer ----
    pinMode(BUZZER_PIN, OUTPUT);

    // ---- Water level sensor ----
    pinMode(WATER_LEVEL_PIN, INPUT_PULLUP);

    // ---- Buttons (GPIO 34-39 are input-only; external 10k pull-up required) ----
    pinMode(BTN_MILK,      INPUT);
    pinMode(BTN_COFFEE,    INPUT);
    pinMode(BTN_TEA,       INPUT);
    pinMode(BTN_HOT_WATER, INPUT);

    // ---- DS18B20 sensors ----
    sensors.begin();
    sensors.setResolution(10);   // 10-bit ≈ 0.125 °C, 187 ms conversion time

    Serial.printf("[INIT] Found %d temperature sensor(s).\n", sensors.getDeviceCount());

#if SCAN_SENSORS
    scanAndPrintSensors();
    Serial.println("[SCAN] Halted. Update config.h and reflash.");
    while (true) delay(1000);
#endif

    // ---- TFT display ----
    tft.init();
    tft.setRotation(0);   // Portrait 240×320
    tftDrawChrome();
    tftShowStatus("Initialising", "Please wait...", COL_HEATING);
    tftDrawMenu();

    buzz(800, 200);
    Serial.println("[INIT] Hardware OK. Starting water check...");

    // ---- WiFi + MQTT (non-blocking: offline mode if no WiFi) ----
    if (connectWiFi()) {
        mqtt.setServer(MQTT_HOST, MQTT_PORT);
        mqtt.setCallback(mqttCallback);
        mqttReconnect();
    }

    state = S_CHECK_WATER;
}

// ================================================================
//  MAIN LOOP — State Machine
// ================================================================

static unsigned long lastHeaterCheck = 0;

void loop() {
    // ---- MQTT keepalive / reconnect (every loop tick) ----
    if (WiFi.status() == WL_CONNECTED) {
        if (!mqtt.connected()) mqttReconnect();
        else                   mqtt.loop();
    }

    // ---- Ongoing heater regulation while machine is READY ----
    if (state == S_READY && (millis() - lastHeaterCheck >= HEATER_CHECK_MS)) {
        regulateHeaters();
        lastHeaterCheck = millis();
        Serial.printf("[TEMP] Water:%.1f°C  Milk:%.1f°C  Decoct:%.1f°C\n",
                      tempWater, tempMilk, tempDecoct);
        // Update display temperature rows
        tftUpdateTemp( 38, tempWater,  TARGET_WATER_C);
        tftUpdateTemp( 78, tempMilk,   TARGET_MILK_C);
        tftUpdateTemp(118, tempDecoct, TARGET_DECOCT_C);
    }

    switch (state) {

        // ========================================================
        case S_CHECK_WATER:
            Serial.println("[STATE] Checking water supply...");
            tftShowStatus("Checking", "water level...", COL_HEATING);
            if (waterLevelOK()) {
                Serial.println("[OK] Water detected.");
                beepOK();
                state = S_FILLING;
            } else {
                Serial.println("[ERROR] No water in reservoir!");
                Serial.println("        → Fill the reservoir, then wait 10 s for retry.");
                tftShowStatus("NO WATER", "Refill reservoir!", COL_ERROR);
                beepError();
                state = S_ERROR_NO_WATER;
            }
            break;

        // ========================================================
        case S_ERROR_NO_WATER:
            delay(10000);
            Serial.println("[RETRY] Re-checking water level...");
            tftShowStatus("Retrying...", "water check", COL_HEATING);
            if (waterLevelOK()) {
                beepOK();
                state = S_FILLING;
            } else {
                beepError();
                Serial.println("[ERROR] Still no water. Please refill.");
                tftShowStatus("NO WATER", "Refill reservoir!", COL_ERROR);
            }
            break;

        // ========================================================
        case S_FILLING:
            tftShowStatus("Filling", "water tank...", COL_COOL);
            if (fillContainer()) {
                state = S_HEAT_WATER;
            } else {
                tftShowStatus("FILL ERROR", "Check supply!", COL_ERROR);
                beepError();
                state = S_ERROR_FILL;
            }
            break;

        // ========================================================
        case S_HEAT_WATER:
            // Phase 1: heat water only to 80 °C
            startupHeatWater();
            state = S_FILL_DECOCTIONS;
            break;

        // ========================================================
        case S_FILL_DECOCTIONS:
            // Phase 2: distribute 80 °C water into decoction containers
            startupFillDecoctions();
            state = S_HEAT_MILK_DECOCT;
            break;

        // ========================================================
        case S_HEAT_MILK_DECOCT:
            // Phase 3: heat milk + decoction chambers
            startupHeatMilkDecoct();
            tftDrawQRReady();   // shows QR code + "Scan to Order"
            beepReady();
            state = S_READY;
            break;

        // ========================================================
        case S_READY: {
            // ---- Web-app UPI order received via MQTT ----
            if (pendingDispense) {
                pendingDispense = false;
                DispenseCmd cmd = pendingCmd;    // copy before clearing
                beepDispense();
                state = S_DISPENSING;
                tftShowOrderReceived(cmd);       // show confirmation for 2 s
                delay(2000);
                dispenseOrder(cmd);              // dispense with custom ratios
                tftDrawQRReady();                // return to QR screen
                state = S_READY;
                break;
            }
            // ---- Physical buttons ----
            if (digitalRead(BTN_MILK) == LOW) {
                Serial.println("[BTN] Milk");
                beepDispense();
                state = S_DISPENSING;
                tftShowDispense("Milk", "Priming...");
                dispenseMilk();
                tftDrawQRReady();
                state = S_READY;
            }
            else if (digitalRead(BTN_COFFEE) == LOW) {
                Serial.println("[BTN] Coffee Decoction");
                beepDispense();
                state = S_DISPENSING;
                tftShowDispense("Coffee", "Priming...");
                dispenseCoffee();
                tftDrawQRReady();
                state = S_READY;
            }
            else if (digitalRead(BTN_TEA) == LOW) {
                Serial.println("[BTN] Tea Decoction");
                beepDispense();
                state = S_DISPENSING;
                tftShowDispense("Tea", "Priming...");
                dispenseTea();
                tftDrawQRReady();
                state = S_READY;
            }
            else if (digitalRead(BTN_HOT_WATER) == LOW) {
                Serial.println("[BTN] Hot Water");
                beepDispense();
                state = S_DISPENSING;
                tftShowDispense("Hot Water", "Dispensing...");
                dispenseWater();
                tftDrawQRReady();
                state = S_READY;
            }
            // ---- Serial commands (for testing/debugging) ----
            else if (Serial.available()) {
                char cmd = (char)Serial.read();
                switch (cmd) {
                    case '1':
                        beepDispense(); state = S_DISPENSING;
                        tftShowDispense("Milk", "Priming...");
                        dispenseMilk();
                        tftDrawQRReady();
                        state = S_READY; break;
                    case '2':
                        beepDispense(); state = S_DISPENSING;
                        tftShowDispense("Coffee", "Priming...");
                        dispenseCoffee();
                        tftDrawQRReady();
                        state = S_READY; break;
                    case '3':
                        beepDispense(); state = S_DISPENSING;
                        tftShowDispense("Tea", "Priming...");
                        dispenseTea();
                        tftDrawQRReady();
                        state = S_READY; break;
                    case '4':
                        beepDispense(); state = S_DISPENSING;
                        tftShowDispense("Hot Water", "Dispensing...");
                        dispenseWater();
                        tftDrawQRReady();
                        state = S_READY; break;
                    case 't':
                        regulateHeaters();
                        Serial.printf("[TEMP] Water:%.1f°C  Milk:%.1f°C  Decoct:%.1f°C\n",
                                      tempWater, tempMilk, tempDecoct);
                        break;
                    case 'r':
                        Serial.println("[SYS] Restarting...");
                        allHeatersOff();
                        delay(500);
                        ESP.restart();
                        break;
                    default:
                        break;
                }
            }
            delay(50);   // Polling interval / button debounce
            break;
        }

        // ========================================================
        case S_DISPENSING:
            // Dispense functions are called inline above and return here.
            // This case handles any future async path.
            break;

        // ========================================================
        case S_ERROR_FILL:
            Serial.println("[ERROR] Fill failed — check supply line.");
            Serial.println("        Restarting in 30 s...");
            allHeatersOff();
            beepError();
            delay(30000);
            ESP.restart();
            break;

        default:
            break;
    }
}
