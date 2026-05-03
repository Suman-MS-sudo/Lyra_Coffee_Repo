/**
 * ================================================================
 *  Lyra Coffee Machine — ESP32 Firmware (single-file build)
 *
 *  This ONE file does everything:
 *    1. Wi-Fi captive portal provisioning at 192.168.4.1
 *       (long-press milk button 3+ s → AP "Lyra-Setup-XXXX",
 *        10+ s → wipe saved Wi-Fi).
 *    2. Wi-Fi STA auto-connect using saved creds (or secrets.h
 *       compile-time fallback).
 *    3. Online vending — polls the Lyra backend, runs the matching
 *       motor recipe, ACKs the order.
 *    4. Local buttons — manual/test dispense, always available.
 *
 *  Drop this into src/main.cpp. Delete src/wifi_provision.* if
 *  they exist — everything lives here now.
 *
 *  Configuration:
 *    cp include/secrets.h.example include/secrets.h, then edit:
 *       MACHINE_ID, MACHINE_KEY, SERVER_HOST,
 *       WIFI_SSID/WIFI_PASSWORD (optional, portal can override).
 * ================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "secrets.h"

// ────────────────────────────────────────────────────────────────
//  Pin map  (per the user's wiring)
// ────────────────────────────────────────────────────────────────
constexpr int PIN_MILK_A   = 26;
constexpr int PIN_MILK_B   = 27;
constexpr int PIN_COFFEE_A = 14;
constexpr int PIN_COFFEE_B = 15;
constexpr int PIN_TEA_A    = 18;
constexpr int PIN_TEA_B    = 19;

constexpr int PIN_BTN_MILK   = 32;
constexpr int PIN_BTN_COFFEE = 33;
constexpr int PIN_BTN_TEA    = 25;

// ────────────────────────────────────────────────────────────────
//  Recipe timing (ms). Strength = decoction:milk ratio.
//  Total volume kept roughly constant.
// ────────────────────────────────────────────────────────────────
struct Recipe { uint16_t decoct_ms; uint16_t milk_ms; };

constexpr Recipe RECIPE_LIGHT  = {  6000, 18000 };  // 20:80
constexpr Recipe RECIPE_MEDIUM = {  9000, 14000 };  // 30:70
constexpr Recipe RECIPE_STRONG = { 12000, 10000 };  // 40:60

constexpr uint16_t AGITATE_MS = 3000;
constexpr uint16_t FLUSH_MS   = 3000;

// ────────────────────────────────────────────────────────────────
//  Network behaviour
// ────────────────────────────────────────────────────────────────
constexpr unsigned long POLL_INTERVAL_MS    = 3000;
constexpr unsigned long WIFI_RETRY_MS       = 15000;
constexpr unsigned long BTN_DEBOUNCE_MS     = 50;
constexpr unsigned long BTN_LOCKOUT_MS      = 1500;

// Long-press milk button to enter Wi-Fi setup portal
constexpr unsigned long PROV_HOLD_MS        = 3000;
constexpr unsigned long PROV_RESET_HOLD_MS  = 10000;

// Captive portal session timeout
constexpr unsigned long PROVISION_TIMEOUT_MS = 10UL * 60UL * 1000UL;

// ────────────────────────────────────────────────────────────────
//  Globals
// ────────────────────────────────────────────────────────────────
Preferences prefs;
WebServer   portalServer(80);

unsigned long lastPollAt    = 0;
unsigned long lastWifiTry   = 0;
unsigned long btnLockUntil  = 0;
bool          busy          = false;
bool          portalDone    = false;

char activeSsid[33] = {0};
char activePass[65] = {0};

// ────────────────────────────────────────────────────────────────
//  Forward declarations
// ────────────────────────────────────────────────────────────────
void wifiEnsure();
void pollOnce();
void ackOrder(const String& orderId, const char* status, const char* error = nullptr);
void runRecipe(const String& drink, const Recipe& r, bool withMilk);
void checkProvisioningGesture();
void enterProvisioningPortal();
bool loadSavedCreds();
void clearSavedCreds();

void forwardMotor(int a, int b, uint16_t ms);
void reverseMotor(int a, int b, uint16_t ms);
void stopMotor(int a, int b);
void stopAll();

// ================================================================
//  setup() / loop()
// ================================================================
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

  if (!loadSavedCreds()) {
    strlcpy(activeSsid, WIFI_SSID,     sizeof(activeSsid));
    strlcpy(activePass, WIFI_PASSWORD, sizeof(activePass));
  }
  Serial.printf("[boot] using ssid=\"%s\"\n", activeSsid);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  WiFi.begin(activeSsid, activePass);
  Serial.printf("[wifi] connecting to %s\n", activeSsid);
}

void loop() {
  checkProvisioningGesture();
  wifiEnsure();

  // ── Local buttons (always available, even offline) ────────────
  if (!busy && millis() > btnLockUntil) {
    if (digitalRead(PIN_BTN_MILK) == LOW) {
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

  // ── Online polling ────────────────────────────────────────────
  if (!busy && WiFi.status() == WL_CONNECTED &&
      millis() - lastPollAt > POLL_INTERVAL_MS) {
    lastPollAt = millis();
    pollOnce();
  }
}

// ================================================================
//  Wi-Fi connection helper
// ================================================================
void wifiEnsure() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - lastWifiTry < WIFI_RETRY_MS) return;

  lastWifiTry = millis();
  Serial.println(F("[wifi] reconnecting"));
  WiFi.disconnect();
  WiFi.begin(activeSsid, activePass);

  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 8000) {
    delay(200);
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(F("[wifi] connected: "));
    Serial.println(WiFi.localIP());
  }
}

// ================================================================
//  Long-press detection on milk button → setup portal
// ================================================================
void checkProvisioningGesture() {
  if (busy) return;
  if (digitalRead(PIN_BTN_MILK) != LOW) return;

  unsigned long pressStart = millis();
  while (digitalRead(PIN_BTN_MILK) == LOW &&
         millis() - pressStart < PROV_RESET_HOLD_MS + 200) {
    delay(20);
  }
  unsigned long held = millis() - pressStart;
  if (held < PROV_HOLD_MS) return;   // short press → normal flow handles it

  if (held >= PROV_RESET_HOLD_MS) {
    Serial.println(F("[prov] factory-reset hold — wiping saved Wi-Fi"));
    clearSavedCreds();
  } else {
    Serial.println(F("[prov] long-press — entering portal"));
  }

  enterProvisioningPortal();   // blocks until reboot or timeout

  btnLockUntil = millis() + 2000;
  lastWifiTry  = 0;
}

// ================================================================
//  NVS-backed credential storage
// ================================================================
bool loadSavedCreds() {
  prefs.begin("lyra-wifi", true);
  String s = prefs.getString("ssid", "");
  String p = prefs.getString("pass", "");
  prefs.end();
  if (s.length() == 0) return false;
  strlcpy(activeSsid, s.c_str(), sizeof(activeSsid));
  strlcpy(activePass, p.c_str(), sizeof(activePass));
  return true;
}

void clearSavedCreds() {
  prefs.begin("lyra-wifi", false);
  prefs.clear();
  prefs.end();
  activeSsid[0] = '\0';
  activePass[0] = '\0';
}

// ================================================================
//  Captive-portal HTML + handlers
// ================================================================
static const char PORTAL_HTML[] PROGMEM = R"HTML(<!doctype html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Lyra Wi-Fi Setup</title>
<style>
 body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:24px;background:#0b0b0b;color:#fff}
 h1{font-size:20px;margin:0 0 4px}
 p.sub{color:#aaa;margin:0 0 18px;font-size:13px}
 .card{background:#171717;border:1px solid #2a2a2a;border-radius:14px;padding:16px;margin-bottom:14px}
 label{display:block;font-size:12px;color:#aaa;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em}
 input,select{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid #333;background:#0e0e0e;color:#fff;font-size:14px;outline:none}
 input:focus,select:focus{border-color:#d4a24a}
 button{width:100%;padding:12px;border:0;border-radius:10px;background:#d4a24a;color:#000;font-weight:600;font-size:15px;margin-top:10px;cursor:pointer}
 button:disabled{opacity:.5}
 .row{display:flex;gap:8px;align-items:center;justify-content:space-between}
 .row button{width:auto;padding:8px 12px;font-size:12px;background:#2a2a2a;color:#ddd}
 small{color:#777;font-size:11px}
 .net{padding:10px 12px;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:center;cursor:pointer}
 .net:hover{background:#1d1d1d}
 .net:last-child{border-bottom:0}
 .signal{color:#888;font-size:11px;font-variant-numeric:tabular-nums}
 .lock{color:#d4a24a;font-size:11px}
</style></head>
<body>
<h1>Lyra Wi-Fi Setup</h1>
<p class="sub">Pick your Wi-Fi network, enter the password, then save. The machine will reboot and come online.</p>

<div class="card">
 <div class="row" style="margin-bottom:10px">
  <label style="margin:0">Available networks</label>
  <button type="button" onclick="rescan()">Rescan</button>
 </div>
 <div id="nets"><small>Scanning…</small></div>
</div>

<form class="card" method="POST" action="/save" id="form">
 <label for="ssid">Network name (SSID)</label>
 <input id="ssid" name="ssid" autocomplete="off" required maxlength="32"/>
 <div style="height:10px"></div>
 <label for="pass">Password</label>
 <input id="pass" name="pass" type="password" autocomplete="new-password" maxlength="64"/>
 <small>Leave blank for open networks.</small>
 <button type="submit" id="submit">Save &amp; connect</button>
</form>

<script>
async function rescan(){
 document.getElementById('nets').innerHTML='<small>Scanning…</small>';
 try{
  const r=await fetch('/scan');
  const list=await r.json();
  if(!list.length){document.getElementById('nets').innerHTML='<small>No networks found.</small>';return}
  document.getElementById('nets').innerHTML=list.map(n=>{
    const safe=(n.ssid||'').replace(/"/g,'&quot;');
    const lock=n.secure?'<span class="lock">&#128274;</span>':'';
    return `<div class="net" onclick="pick('${safe}')">
      <span>${n.ssid||'<i>hidden</i>'}</span>
      <span class="signal">${lock} ${n.rssi} dBm</span></div>`;
  }).join('');
 }catch(e){document.getElementById('nets').innerHTML='<small>Scan failed.</small>'}
}
function pick(s){document.getElementById('ssid').value=s;document.getElementById('pass').focus()}
document.getElementById('form').addEventListener('submit',function(){
 document.getElementById('submit').disabled=true;
 document.getElementById('submit').textContent='Saving…';
});
rescan();
</script>
</body></html>)HTML";

static String portalApName() {
  uint64_t mac = ESP.getEfuseMac();
  char buf[24];
  snprintf(buf, sizeof(buf), "Lyra-Setup-%04X", (uint16_t)(mac & 0xFFFF));
  return String(buf);
}

static void portalHandleRoot()    { portalServer.send_P(200, "text/html", PORTAL_HTML); }

static void portalHandleScan() {
  int n = WiFi.scanNetworks(false, true);
  String out = "[";
  bool first = true;
  for (int i = 0; i < n && i < 20; i++) {
    if (!first) out += ',';
    first = false;
    String ssid = WiFi.SSID(i);
    ssid.replace("\\", "\\\\");
    ssid.replace("\"", "\\\"");
    out += "{\"ssid\":\"" + ssid + "\",\"rssi\":" + String(WiFi.RSSI(i)) +
           ",\"secure\":" + (WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "false" : "true") + "}";
  }
  out += "]";
  WiFi.scanDelete();
  portalServer.send(200, "application/json", out);
}

static void portalHandleSave() {
  if (!portalServer.hasArg("ssid")) { portalServer.send(400, "text/plain", "Missing SSID"); return; }
  String ssid = portalServer.arg("ssid");
  String pass = portalServer.hasArg("pass") ? portalServer.arg("pass") : String("");
  if (ssid.length() == 0 || ssid.length() > 32) { portalServer.send(400, "text/plain", "Invalid SSID"); return; }
  if (pass.length() > 64) { portalServer.send(400, "text/plain", "Password too long"); return; }

  prefs.begin("lyra-wifi", false);
  prefs.putString("ssid", ssid);
  prefs.putString("pass", pass);
  prefs.end();

  portalServer.send(200, "text/html",
    "<!doctype html><meta http-equiv=\"refresh\" content=\"3\"/>"
    "<body style=\"font-family:sans-serif;background:#0b0b0b;color:#fff;padding:24px\">"
    "<h2>Saved.</h2><p>Rebooting and connecting to <b>" + ssid + "</b>…</p></body>");

  portalDone = true;
}

static void portalHandle404() {
  portalServer.sendHeader("Location", "/");
  portalServer.send(302, "text/plain", "");
}

void enterProvisioningPortal() {
  Serial.println(F("[prov] starting captive AP"));

  WiFi.disconnect(true, true);
  WiFi.mode(WIFI_AP_STA);

  String ssid = portalApName();
  WiFi.softAP(ssid.c_str());
  IPAddress ip = WiFi.softAPIP();
  Serial.printf("[prov] AP \"%s\" up at http://%s\n", ssid.c_str(), ip.toString().c_str());

  portalServer.on("/",     HTTP_GET,  portalHandleRoot);
  portalServer.on("/scan", HTTP_GET,  portalHandleScan);
  portalServer.on("/save", HTTP_POST, portalHandleSave);
  portalServer.onNotFound(portalHandle404);
  portalServer.begin();

  unsigned long startedAt = millis();
  portalDone = false;
  while (!portalDone && millis() - startedAt < PROVISION_TIMEOUT_MS) {
    portalServer.handleClient();
    delay(2);
  }
  portalServer.close();
  WiFi.softAPdisconnect(true);

  if (portalDone) {
    Serial.println(F("[prov] credentials saved — rebooting"));
    delay(800);
    ESP.restart();
  } else {
    Serial.println(F("[prov] portal timed out"));
  }
}

// ================================================================
//  Backend HTTP helpers
// ================================================================
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
  client.setInsecure();              // simple TLS — DNS-trust v1
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
  if (strcmp(method, "POST") == 0) code = http.POST(body);
  else                              code = http.GET();

  outBody = http.getString();
  http.end();
  return code;
}

// ================================================================
//  Poll for next paid order
// ================================================================
void pollOnce() {
  String body;
  int code = httpRequest("GET", "/api/machine/poll", "", body);
  if (code == 204) return;
  if (code == 200 && body.length() < 5) return;
  if (code < 200 || code >= 300) {
    Serial.printf("[poll] HTTP %d body=%s\n", code, body.c_str());
    return;
  }

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

  if (!orderId[0] || !drink[0]) return;

  Recipe r = RECIPE_MEDIUM;
  if      (strcmp(strength, "light")  == 0) r = RECIPE_LIGHT;
  else if (strcmp(strength, "strong") == 0) r = RECIPE_STRONG;

  Serial.printf("[poll] job=%s drink=%s strength=%s milk=%d\n",
                orderId, drink, strength, withMilk ? 1 : 0);

  runRecipe(String(drink), r, withMilk);
  ackOrder(String(orderId), "dispensed");
}

// ================================================================
//  ACK back to server
// ================================================================
void ackOrder(const String& orderId, const char* status, const char* error) {
  StaticJsonDocument<256> doc;
  doc["order_id"] = orderId;
  doc["status"]   = status;
  if (error) doc["error"] = error;

  String body, resp;
  serializeJson(doc, body);
  int code = httpRequest("POST", "/api/machine/ack", body, resp);
  Serial.printf("[ack] HTTP %d\n", code);
}

// ================================================================
//  Dispense recipe
// ================================================================
void runRecipe(const String& drink, const Recipe& r, bool withMilk) {
  busy = true;
  btnLockUntil = millis() + BTN_LOCKOUT_MS;

  int decA = -1, decB = -1;
  if      (drink == "coffee") { decA = PIN_COFFEE_A; decB = PIN_COFFEE_B; }
  else if (drink == "tea")    { decA = PIN_TEA_A;    decB = PIN_TEA_B;    }

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

// ================================================================
//  Low-level motor helpers
// ================================================================
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
