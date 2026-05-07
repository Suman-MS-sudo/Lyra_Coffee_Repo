/**
 * ================================================================
 *  Lyra Coffee Machine — ESP32 Firmware (single-file build)
 *
 *  Drop this entire file into the Arduino IDE (or PlatformIO).
 *  No other source/header files are needed — everything is inline.
 *
 *  Required Arduino libraries (Library Manager):
 *    - ArduinoJson  by Benoit Blanchon  (v6.x)
 *  Built-in with the ESP32 board package:
 *    WiFi, WebServer, Preferences, HTTPClient, WiFiClientSecure
 *
 *  What this firmware does:
 *    1. Wi-Fi captive portal at 192.168.4.1
 *       (long-press provisioning button (GPIO 13) 3+ s → AP
 *        "Lyra-Setup-XXXX", 10+ s → wipe saved Wi-Fi + identity).
 *    2. STA auto-connect using saved creds.
 *    3. MAC-driven self-identification — first boot, the firmware
 *       sends its MAC to /api/machine/identify and receives a
 *       unique machine_id + api_key (persisted in NVS).
 *    4. Online vending — polls the Lyra backend, runs the matching
 *       motor recipe, ACKs the order.
 *    5. Local buttons — manual/test dispense, always available.
 *
 *  Just flash, then in the admin dashboard add a new machine with
 *  this ESP's MAC address (printed on serial at boot).
 * ================================================================
 */

// ───────────────────────────────────────────────────────────
//  Configuration — same values for every machine you flash.
// ───────────────────────────────────────────────────────────
#define SERVER_HOST     "brew.lyra-app.co.in"
#define SERVER_PORT     443     // 443 for HTTPS, 80 for plain HTTP
#define USE_HTTPS       1       // 1 = WiFiClientSecure, 0 = WiFiClient

// Optional fallback Wi-Fi creds (used only if NVS is empty).
// Leave blank to force the captive portal on first boot.
#define WIFI_SSID       ""
#define WIFI_PASSWORD   ""

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <esp_task_wdt.h>
#include <esp_mac.h>

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

// Dedicated Wi-Fi provisioning button.
// Wire one leg to this GPIO and the other leg to GND.
// Hold 3 s+ → captive portal AP. Hold 10 s+ → factory reset.
constexpr int PIN_BTN_PROV   = 13;

// ────────────────────────────────────────────────────────────────
//  Recipe timing (ms). Strength = decoction:milk ratio.
//  Total volume kept roughly constant.
// ────────────────────────────────────────────────────────────────
struct Recipe { uint16_t decoct_ms; uint16_t milk_ms; };

constexpr Recipe RECIPE_LIGHT  = {  2000,  6000 };  // 20:80
constexpr Recipe RECIPE_MEDIUM = {  3000,  4700 };  // 30:70
constexpr Recipe RECIPE_STRONG = {  4000,  3300 };  // 40:60

constexpr uint16_t AGITATE_MS       = 3000;
constexpr uint16_t FLUSH_MS         = 1000;
constexpr uint16_t MILK_DISPENSE_MS = 5000;  // fixed volume for milk-only orders (strength has no meaning for milk)

// ────────────────────────────────────────────────────────────────
//  Network behaviour
// ────────────────────────────────────────────────────────────────
constexpr unsigned long POLL_INTERVAL_MS    = 3000;
constexpr unsigned long HEARTBEAT_INTERVAL_MS = 60UL * 1000UL;  // explicit ping
constexpr unsigned long WIFI_RETRY_MS       = 15000;
constexpr unsigned long BTN_DEBOUNCE_MS     = 50;
constexpr unsigned long BTN_LOCKOUT_MS      = 1500;

// Hardware task watchdog. If loop() stops feeding it for this long
// (e.g. a TLS handshake wedges a whole minute), the chip reboots
// rather than going silent until someone notices. The first cold
// TLS handshake on ESP32 + mbedtls can legitimately take 15-25 s,
// and setHandshakeTimeout() is not reliably enforced on core 3.x,
// so give ourselves real headroom here. We also feed the WDT
// around each blocking HTTP call inside httpRequest().
constexpr uint32_t WDT_TIMEOUT_S         = 60;

// Software liveness guard. If neither poll nor heartbeat has
// succeeded in this window we assume the network stack is wedged
// and reboot. Five minutes is generous — normal traffic happens
// every 3 s / 60 s respectively.
constexpr unsigned long LIVENESS_TIMEOUT_MS = 5UL * 60UL * 1000UL;

// TLS handshake cap (seconds). Without this, WiFiClientSecure can
// stall indefinitely on a flaky network and HTTPClient::setTimeout
// won't help — that only covers the read/write phase.
constexpr uint32_t TLS_HANDSHAKE_TIMEOUT_S = 15;

// HTTP connect/read timeouts. Each request opens a brand-new TLS
// socket (no keep-alive), so cold round-trips can legitimately take
// 10–15 s on residential DSL. Keep these well above the median
// observed latency or you'll see HTTPC_ERROR_READ_TIMEOUT (-11)
// on every call.
constexpr uint32_t HTTP_CONNECT_TIMEOUT_MS = 15000;
constexpr uint32_t HTTP_READ_TIMEOUT_MS    = 20000;

// Long-press provisioning button to enter Wi-Fi setup portal
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
unsigned long lastHeartbeatAt = 0;
unsigned long lastWifiTry   = 0;
unsigned long btnLockUntil  = 0;
unsigned long lastNetOkAt   = 0;   // last successful poll OR heartbeat
bool          busy          = false;
bool          portalDone    = false;

char activeSsid[33] = {0};
char activePass[65] = {0};

// Identity — resolved at runtime from the server, NOT compiled in.
char machineId[40] = {0};   // UUID
char machineKey[80] = {0};  // 64-hex-char API key
char machineMac[18] = {0};  // "AA:BB:CC:DD:EE:FF"
char machineName[64] = {0}; // optional, for logs
bool identityReady = false;

// ────────────────────────────────────────────────────────────────
//  Forward declarations
// ────────────────────────────────────────────────────────────────
void wifiEnsure();
void pollOnce();
void sendHeartbeat();
void ackOrder(const String& orderId, const char* status, const char* error = nullptr);
void runRecipe(const String& drink, const Recipe& r, bool withMilk);
void checkProvisioningGesture();
void enterProvisioningPortal();
bool loadSavedCreds();
void clearSavedCreds();
void readMacAddress(char* out, size_t outLen);
bool loadIdentity();
void saveIdentity(const char* id, const char* key, const char* name);
bool identifyWithServer();
void clearIdentity();
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
  pinMode(PIN_BTN_PROV,   INPUT_PULLUP);
  stopAll();

  // Arm the task watchdog on the loop task. Every iteration of
  // loop() must call esp_task_wdt_reset() within WDT_TIMEOUT_S or
  // the chip reboots — guarantees we never go silent for long.
  // ESP32 Arduino core 3.x uses a config struct; older 2.x took
  // (timeout_seconds, panic). Pick at compile time.
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  // Arduino-ESP32 core 3.x auto-initializes TWDT on the loop task with
  // a short default (~5 s) — that's why a fresh TLS handshake (~16 s)
  // panics us. Reconfigure (not re-init) to extend the timeout.
  esp_task_wdt_config_t wdt_cfg = {
    .timeout_ms     = WDT_TIMEOUT_S * 1000U,
    .idle_core_mask = 0,
    .trigger_panic  = true,
  };
  esp_task_wdt_reconfigure(&wdt_cfg);
#else
  esp_task_wdt_init(WDT_TIMEOUT_S, true);
#endif
  // loopTask is already subscribed by the core in 3.x; add() is idempotent.
  esp_task_wdt_add(NULL);
  lastNetOkAt = millis();

  if (!loadSavedCreds()) {
    strlcpy(activeSsid, WIFI_SSID,     sizeof(activeSsid));
    strlcpy(activePass, WIFI_PASSWORD, sizeof(activePass));
  }
  Serial.printf("[boot] using ssid=\"%s\"\n", activeSsid);

  readMacAddress(machineMac, sizeof(machineMac));
  Serial.printf("[boot] mac=%s\n", machineMac);

  identityReady = loadIdentity();
  if (identityReady) {
    Serial.printf("[boot] identity loaded id=%s name=\"%s\"\n",
                  machineId, machineName);
  } else {
    Serial.println(F("[boot] no saved identity — will identify with server"));
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  WiFi.begin(activeSsid, activePass);
  Serial.printf("[wifi] connecting to %s\n", activeSsid);
}

void loop() {
  esp_task_wdt_reset();

  // Software liveness guard: if we've had no successful network
  // round-trip in LIVENESS_TIMEOUT_MS, the network stack is wedged.
  // Reboot rather than sit silent.
  if (!busy && millis() - lastNetOkAt > LIVENESS_TIMEOUT_MS) {
    Serial.println(F("[guard] no network activity for too long \u2014 rebooting"));
    delay(200);
    ESP.restart();
  }

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

    // Self-identify on the first online opportunity.
    if (!identityReady) {
      if (!identifyWithServer()) {
        // Will retry next tick. The server might be down, the row
        // might not have this MAC yet, or the unit is already
        // provisioned and an admin needs to reset it.
        return;
      }
    }
    pollOnce();

    // Explicit heartbeat once a minute so the dashboard knows we're
    // alive even when no orders are coming through (poll already
    // bumps last_seen_at, but a slower cadence is enough here).
    if (millis() - lastHeartbeatAt > HEARTBEAT_INTERVAL_MS) {
      lastHeartbeatAt = millis();
      sendHeartbeat();
    }
  }
}

// ================================================================
//  Wi-Fi connection helper
// ================================================================
void wifiEnsure() {
  static bool announcedConnected = false;

  if (WiFi.status() == WL_CONNECTED) {
    // Print the IP exactly once after each transition to connected
    // so the serial log proves STA actually came up on first boot.
    if (!announcedConnected) {
      announcedConnected = true;
      Serial.print(F("[wifi] connected: "));
      Serial.println(WiFi.localIP());
    }
    return;
  }
  announcedConnected = false;
  if (millis() - lastWifiTry < WIFI_RETRY_MS) return;

  lastWifiTry = millis();
  Serial.println(F("[wifi] reconnecting"));
  WiFi.disconnect();
  WiFi.begin(activeSsid, activePass);

  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 8000) {
    esp_task_wdt_reset();
    delay(200);
  }
  if (WiFi.status() == WL_CONNECTED) {
    announcedConnected = true;
    Serial.print(F("[wifi] connected: "));
    Serial.println(WiFi.localIP());
  }
}

// ================================================================
//  Long-press detection on dedicated provisioning button
// ================================================================
void checkProvisioningGesture() {
  if (busy) return;
  if (digitalRead(PIN_BTN_PROV) != LOW) return;

  unsigned long pressStart = millis();
  while (digitalRead(PIN_BTN_PROV) == LOW &&
         millis() - pressStart < PROV_RESET_HOLD_MS + 200) {
    delay(20);
  }
  unsigned long held = millis() - pressStart;
  if (held < PROV_HOLD_MS) return;   // short press — ignore

  if (held >= PROV_RESET_HOLD_MS) {
    Serial.println(F("[prov] factory-reset hold — wiping saved Wi-Fi + identity"));
    clearSavedCreds();
    clearIdentity();
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
  // Cap the SSL handshake. Without this the call can wedge for
  // minutes on a flaky network and starve the watchdog.
  client.setHandshakeTimeout(TLS_HANDSHAKE_TIMEOUT_S);
#else
  WiFiClient client;
#endif

  HTTPClient http;
  http.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
  http.setTimeout(HTTP_READ_TIMEOUT_MS);

  // Feed the watchdog before each blocking step. The TLS handshake
  // and the POST/GET both run on the loop task synchronously and
  // can each take >10 s on a cold connection; without these resets
  // the WDT panics mid-handshake.
  esp_task_wdt_reset();
  if (!http.begin(client, baseUrl() + path)) {
    Serial.println(F("[http] begin failed"));
    return -1;
  }
  // Authenticated calls (poll/ack) use the runtime identity.
  // The /identify call has no identity yet — leave headers off so
  // the server's auth helper short-circuits and the route handles
  // it as a public lookup.
  if (machineKey[0]) {
    http.addHeader("Authorization", String("Bearer ") + machineKey);
  }
  if (machineId[0]) {
    http.addHeader("X-Machine-Id", machineId);
  }
  if (body.length()) http.addHeader("Content-Type", "application/json");

  esp_task_wdt_reset();
  int code;
  if (strcmp(method, "POST") == 0) code = http.POST(body);
  else                              code = http.GET();
  esp_task_wdt_reset();

  outBody = http.getString();
  http.end();
  return code;
}

// ================================================================
//  Identity (MAC-driven self-provisioning)
// ================================================================
void readMacAddress(char* out, size_t outLen) {
  // Read the base MAC straight from eFuse so this works even before
  // the Wi-Fi driver is started. WiFi.macAddress() returns zeros (or
  // a stale cached value) if called pre-WiFi.mode() on some core
  // versions — that's why the ID looked "static" across boots.
  uint8_t mac[6] = {0};
  esp_err_t err = esp_read_mac(mac, ESP_MAC_WIFI_STA);
  if (err != ESP_OK) {
    // Fallback to the runtime API; if that also fails we'll print
    // 00:00:... which makes the failure obvious in the serial log.
    WiFi.macAddress(mac);
  }
  snprintf(out, outLen, "%02X:%02X:%02X:%02X:%02X:%02X",
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

bool loadIdentity() {
  prefs.begin("lyra-id", true);
  String id   = prefs.getString("id",   "");
  String key  = prefs.getString("key",  "");
  String name = prefs.getString("name", "");
  prefs.end();
  if (id.length() == 0 || key.length() == 0) return false;
  strlcpy(machineId,   id.c_str(),   sizeof(machineId));
  strlcpy(machineKey,  key.c_str(),  sizeof(machineKey));
  strlcpy(machineName, name.c_str(), sizeof(machineName));
  return true;
}

void saveIdentity(const char* id, const char* key, const char* name) {
  prefs.begin("lyra-id", false);
  prefs.putString("id",   id);
  prefs.putString("key",  key);
  prefs.putString("name", name ? name : "");
  prefs.end();
  strlcpy(machineId,   id,            sizeof(machineId));
  strlcpy(machineKey,  key,           sizeof(machineKey));
  strlcpy(machineName, name ? name : "", sizeof(machineName));
}

void clearIdentity() {
  prefs.begin("lyra-id", false);
  prefs.clear();
  prefs.end();
  machineId[0] = machineKey[0] = machineName[0] = '\0';
  identityReady = false;
}

bool identifyWithServer() {
  StaticJsonDocument<128> req;
  req["mac_id"] = machineMac;
  String body, resp;
  serializeJson(req, body);

  // Temporarily clear stored creds so the helper sends no auth headers.
  char savedId[40];  strlcpy(savedId,  machineId,  sizeof(savedId));
  char savedKey[80]; strlcpy(savedKey, machineKey, sizeof(savedKey));
  machineId[0] = machineKey[0] = '\0';

  int code = httpRequest("POST", "/api/machine/identify", body, resp);

  // Restore in case identify failed.
  strlcpy(machineId,  savedId,  sizeof(machineId));
  strlcpy(machineKey, savedKey, sizeof(machineKey));

  if (code < 200 || code >= 300) {
    Serial.printf("[identify] HTTP %d body=%s\n", code, resp.c_str());
    return false;
  }

  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, resp) != DeserializationError::Ok) {
    Serial.println(F("[identify] bad JSON"));
    return false;
  }
  const char* id   = doc["id"]      | "";
  const char* key  = doc["api_key"] | "";
  const char* name = doc["name"]    | "";
  if (!id[0] || !key[0]) {
    Serial.println(F("[identify] missing id/key"));
    return false;
  }

  saveIdentity(id, key, name);
  identityReady = true;
  // Log just the prefix of the new key so we can correlate with
  // server logs without dumping the full secret.
  char keyPrefix[9] = {0};
  strlcpy(keyPrefix, key, sizeof(keyPrefix));
  Serial.printf("[identify] OK \u2014 id=%s name=\"%s\" key=%s… (len=%u)\n",
                id, name, keyPrefix, (unsigned)strlen(key));
  return true;
}

// ================================================================
//  Poll for next paid order
// ================================================================
void pollOnce() {
  String body;
  int code = httpRequest("GET", "/api/machine/poll", "", body);
  static unsigned long lastQuietLog = 0;
  if (code == 204 || (code == 200 && body.length() < 5)) {
    lastNetOkAt = millis();
    // Log "no orders" once a minute so the serial console proves
    // polling is alive without flooding it every 3 s.
    if (millis() - lastQuietLog > 60000) {
      lastQuietLog = millis();
      Serial.println(F("[poll] idle (no orders)"));
    }
    return;
  }
  // 401/403 means the stored API key no longer matches the server
  // (e.g. the machine row was re-created or the key was rotated).
  // Wipe identity so the next loop tick re-runs /identify and picks
  // up the current key — no manual factory-reset needed.
  if (code == 401 || code == 403) {
    Serial.printf("[poll] HTTP %d \u2014 stale identity, clearing and re-identifying\n", code);
    clearIdentity();
    return;
  }
  if (code < 200 || code >= 300) {
    Serial.printf("[poll] HTTP %d body=%s\n", code, body.c_str());
    return;
  }
  lastNetOkAt = millis();

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
//  Heartbeat — lightweight liveness ping
// ================================================================
void sendHeartbeat() {
  String resp;
  int code = httpRequest("POST", "/api/machine/heartbeat", "{}", resp);
  // Same self-heal as pollOnce(): a 401 means our key is stale.
  if (code == 401 || code == 403) {
    Serial.printf("[hb] HTTP %d \u2014 stale identity, clearing and re-identifying\n", code);
    clearIdentity();
    return;
  }
  // Only count it as a real heartbeat if the JSON shape matches.
  // Cloudflare can return HTTP 200 with a "Just a moment…" challenge
  // page when its bot-fight rules trip on the ESP's user agent — in
  // that case the route never runs and last_seen_at stays stale even
  // though the firmware sees a 2xx.
  bool ok = (code >= 200 && code < 300) && resp.indexOf("\"ok\":true") >= 0;
  if (ok) lastNetOkAt = millis();
  // Log a body snippet on failure so we can tell a real backend
  // error from a Cloudflare interstitial.
  if (!ok) {
    String snippet = resp.substring(0, 120);
    Serial.printf("[hb] HTTP %d (rejected) body=%s\n", code, snippet.c_str());
  } else {
    Serial.printf("[hb] HTTP %d ok\n", code);
  }
}

// ================================================================
//  Dispense recipe
// ================================================================
void runRecipe(const String& drink, const Recipe& r, bool withMilk) {
  busy = true;
  btnLockUntil = millis() + BTN_LOCKOUT_MS;

  bool isMilkOnly = (drink == "milk");

  if (isMilkOnly && !withMilk) {
    Serial.println(F("[dispense] milk-only order with milk=false — nothing to do"));
    busy = false;
    return;
  }

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
    // Milk-only orders use a fixed volume — strength is meaningless for plain milk.
    uint16_t milkMs = isMilkOnly ? MILK_DISPENSE_MS : r.milk_ms;

    Serial.println(F("[dispense] milk agitate"));
    reverseMotor(PIN_MILK_A, PIN_MILK_B, AGITATE_MS);

    Serial.printf("[dispense] milk forward %u ms\n", milkMs);
    forwardMotor(PIN_MILK_A, PIN_MILK_B, milkMs);

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
  esp_task_wdt_reset();
  digitalWrite(a, HIGH);
  digitalWrite(b, LOW);
  delay(ms);
}
void reverseMotor(int a, int b, uint16_t ms) {
  esp_task_wdt_reset();
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
