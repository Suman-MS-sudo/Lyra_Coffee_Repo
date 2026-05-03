/**
 * ================================================================
 *  Lyra Coffee Machine — ESP32 Firmware (online + local buttons)
 *  src/main.cpp
 *
 *  • Local buttons:  immediate test/manual dispense (debounced).
 *  • Online vending: polls the Lyra backend for paid orders and
 *                    runs the matching dispense recipe, then ACKs.
 *
 *  Wiring (per user spec):
 *    Milk   relays  : GPIO 26 / 27
 *    Coffee relays  : GPIO 14 / 15
 *    Tea    relays  : GPIO 18 / 19
 *    Buttons        : Milk=32, Coffee=33, Tea=25  (INPUT_PULLUP, active LOW)
 *
 *  Provision the device once via include/secrets.h
 *  (copy from include/secrets.h.example).
 * ================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "secrets.h"

// ── Pin configuration ───────────────────────────────────────────
constexpr int PIN_MILK_A   = 26;
constexpr int PIN_MILK_B   = 27;
constexpr int PIN_COFFEE_A = 14;
constexpr int PIN_COFFEE_B = 15;
constexpr int PIN_TEA_A    = 18;
constexpr int PIN_TEA_B    = 19;

constexpr int PIN_BTN_MILK   = 32;
constexpr int PIN_BTN_COFFEE = 33;
constexpr int PIN_BTN_TEA    = 25;

// ── Recipe timing (ms) ──────────────────────────────────────────
//   Strength is decoction:milk ratio. We keep total volume roughly
//   constant by scaling the milk and decoction phases inversely.
struct Recipe {
  uint16_t decoct_ms;    // forward run on coffee/tea pump
  uint16_t milk_ms;      // forward run on milk pump
};

constexpr Recipe RECIPE_LIGHT  = { 6000, 18000 };  // 20 : 80
constexpr Recipe RECIPE_MEDIUM = { 9000, 14000 };  // 30 : 70
constexpr Recipe RECIPE_STRONG = { 12000, 10000 }; // 40 : 60

constexpr uint16_t AGITATE_MS = 3000;
constexpr uint16_t FLUSH_MS   = 3000;

// ── Network behavior ────────────────────────────────────────────
constexpr unsigned long POLL_INTERVAL_MS = 3000;     // poll cadence when idle
constexpr unsigned long WIFI_RETRY_MS    = 15000;    // reconnect cadence
constexpr unsigned long BTN_DEBOUNCE_MS  = 50;
constexpr unsigned long BTN_LOCKOUT_MS   = 1500;     // ignore re-press after dispense start

// ── Globals ─────────────────────────────────────────────────────
unsigned long lastPollAt   = 0;
unsigned long lastWifiTry  = 0;
unsigned long btnLockUntil = 0;

bool busy = false;       // a dispense is in progress; pause polling

// ── Forward declarations ────────────────────────────────────────
void wifiEnsure();
void pollOnce();
void ackOrder(const String& orderId, const char* status, const char* error = nullptr);
void runRecipe(const String& drink, const Recipe& r, bool withMilk);

void forwardMotor(int a, int b, uint16_t ms);
void reverseMotor(int a, int b, uint16_t ms);
void stopMotor(int a, int b);
void stopAll();

// ── setup() ─────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(150);
  Serial.println();
  Serial.println(F("[boot] Lyra firmware starting"));

  for (int p : { PIN_MILK_A, PIN_MILK_B, PIN_COFFEE_A, PIN_COFFEE_B,
                 PIN_TEA_A,  PIN_TEA_B }) {
    pinMode(p, OUTPUT);
    digitalWrite(p, LOW);
  }
  pinMode(PIN_BTN_MILK,   INPUT_PULLUP);
  pinMode(PIN_BTN_COFFEE, INPUT_PULLUP);
  pinMode(PIN_BTN_TEA,    INPUT_PULLUP);
  stopAll();

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[wifi] connecting to %s\n", WIFI_SSID);
}

// ── loop() ──────────────────────────────────────────────────────
void loop() {
  wifiEnsure();

  // ── Local buttons (always available, even offline) ───────────
  if (!busy && millis() > btnLockUntil) {
    if (digitalRead(PIN_BTN_MILK) == LOW) {
      // brief debounce
      delay(BTN_DEBOUNCE_MS);
      if (digitalRead(PIN_BTN_MILK) == LOW) {
        Serial.println(F("[btn] milk only"));
        runRecipe("milk", RECIPE_MEDIUM, true);
      }
    } else if (digitalRead(PIN_BTN_COFFEE) == LOW) {
      delay(BTN_DEBOUNCE_MS);
      if (digitalRead(PIN_BTN_COFFEE) == LOW) {
        Serial.println(F("[btn] coffee (medium, with milk)"));
        runRecipe("coffee", RECIPE_MEDIUM, true);
      }
    } else if (digitalRead(PIN_BTN_TEA) == LOW) {
      delay(BTN_DEBOUNCE_MS);
      if (digitalRead(PIN_BTN_TEA) == LOW) {
        Serial.println(F("[btn] tea (medium, with milk)"));
        runRecipe("tea", RECIPE_MEDIUM, true);
      }
    }
  }

  // ── Online polling ───────────────────────────────────────────
  if (!busy && WiFi.status() == WL_CONNECTED &&
      millis() - lastPollAt > POLL_INTERVAL_MS) {
    lastPollAt = millis();
    pollOnce();
  }
}

// ── Wi-Fi connection helper ─────────────────────────────────────
void wifiEnsure() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - lastWifiTry < WIFI_RETRY_MS) return;

  lastWifiTry = millis();
  Serial.println(F("[wifi] reconnecting"));
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // wait briefly so we don't hammer the radio
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 8000) {
    delay(200);
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(F("[wifi] connected: "));
    Serial.println(WiFi.localIP());
  }
}

// ── HTTP helper: build a configured client + URL ────────────────
static String baseUrl() {
  String url = (USE_HTTPS ? "https://" : "http://");
  url += SERVER_HOST;
  if ((USE_HTTPS && SERVER_PORT != 443) || (!USE_HTTPS && SERVER_PORT != 80)) {
    url += ":";
    url += String(SERVER_PORT);
  }
  return url;
}

static int httpRequest(const char* method, const String& path,
                       const String& body, String& outBody) {
#if USE_HTTPS
  WiFiClientSecure client;
  client.setInsecure();   // server cert is Let's Encrypt, but we trust DNS for v1
#else
  WiFiClient client;
#endif

  HTTPClient http;
  http.setTimeout(8000);
  if (!http.begin(client, baseUrl() + path)) {
    Serial.println(F("[http] begin failed"));
    return -1;
  }
  http.addHeader("Authorization", String("Bearer ") + MACHINE_KEY);
  http.addHeader("X-Machine-Id",  MACHINE_ID);
  if (body.length()) http.addHeader("Content-Type", "application/json");

  int code;
  if (strcmp(method, "POST") == 0)      code = http.POST(body);
  else                                  code = http.GET();

  outBody = http.getString();
  http.end();
  return code;
}

// ── Poll for next paid order ────────────────────────────────────
void pollOnce() {
  String body;
  int code = httpRequest("GET", "/api/machine/poll", "", body);
  if (code == 204 || code == 200 && body.length() < 5) {
    // no work
    return;
  }
  if (code < 200 || code >= 300) {
    Serial.printf("[poll] HTTP %d body=%s\n", code, body.c_str());
    return;
  }

  // Parse: { order_id, drink_type, customization: { strength, milk, sugar } }
  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.printf("[poll] JSON err: %s\n", err.c_str());
    return;
  }

  const char* orderId  = doc["order_id"]   | "";
  const char* drink    = doc["drink_type"] | "";
  const char* strength = doc["customization"]["strength"] | "medium";
  bool        withMilk = doc["customization"]["milk"]     | true;

  if (!orderId[0] || !drink[0]) {
    Serial.println(F("[poll] empty job, ignoring"));
    return;
  }

  Recipe r = RECIPE_MEDIUM;
  if      (strcmp(strength, "light")  == 0) r = RECIPE_LIGHT;
  else if (strcmp(strength, "strong") == 0) r = RECIPE_STRONG;

  Serial.printf("[poll] job=%s drink=%s strength=%s milk=%d\n",
                orderId, drink, strength, withMilk ? 1 : 0);

  runRecipe(String(drink), r, withMilk);
  ackOrder(String(orderId), "dispensed");
}

// ── ACK back to server ──────────────────────────────────────────
void ackOrder(const String& orderId, const char* status, const char* error) {
  StaticJsonDocument<256> doc;
  doc["order_id"] = orderId;
  doc["status"]   = status;
  if (error) doc["error"] = error;

  String body;
  serializeJson(doc, body);

  String resp;
  int code = httpRequest("POST", "/api/machine/ack", body, resp);
  Serial.printf("[ack] HTTP %d\n", code);
}

// ── Dispense state machine ──────────────────────────────────────
void runRecipe(const String& drink, const Recipe& r, bool withMilk) {
  busy = true;
  btnLockUntil = millis() + BTN_LOCKOUT_MS;

  // Pick decoction motor based on drink. "milk" alone uses neither.
  int decA = -1, decB = -1;
  if (drink == "coffee") { decA = PIN_COFFEE_A; decB = PIN_COFFEE_B; }
  else if (drink == "tea") { decA = PIN_TEA_A;    decB = PIN_TEA_B;    }

  if (decA >= 0) {
    Serial.println(F("[dispense] decoction agitate"));
    reverseMotor(decA, decB, AGITATE_MS);

    Serial.printf("[dispense] decoction forward %u ms\n", r.decoct_ms);
    forwardMotor(decA, decB, r.decoct_ms);

    Serial.println(F("[dispense] decoction flush"));
    reverseMotor(decA, decB, FLUSH_MS);
    stopMotor(decA, decB);
  }

  if (withMilk) {
    Serial.println(F("[dispense] milk agitate"));
    reverseMotor(PIN_MILK_A, PIN_MILK_B, AGITATE_MS);

    Serial.printf("[dispense] milk forward %u ms\n", r.milk_ms);
    forwardMotor(PIN_MILK_A, PIN_MILK_B, r.milk_ms);

    Serial.println(F("[dispense] milk flush"));
    reverseMotor(PIN_MILK_A, PIN_MILK_B, FLUSH_MS);
    stopMotor(PIN_MILK_A, PIN_MILK_B);
  }

  stopAll();
  busy = false;
  Serial.println(F("[dispense] done"));
}

// ── Low-level motor helpers ─────────────────────────────────────
void forwardMotor(int a, int b, uint16_t ms) {
  digitalWrite(a, HIGH);
  digitalWrite(b, LOW);
  delay(ms);
}
void reverseMotor(int a, int b, uint16_t ms) {
  digitalWrite(a, LOW);
  digitalWrite(b, HIGH);
  delay(ms);
}
void stopMotor(int a, int b) {
  digitalWrite(a, LOW);
  digitalWrite(b, LOW);
}
void stopAll() {
  stopMotor(PIN_MILK_A,   PIN_MILK_B);
  stopMotor(PIN_COFFEE_A, PIN_COFFEE_B);
  stopMotor(PIN_TEA_A,    PIN_TEA_B);
}
