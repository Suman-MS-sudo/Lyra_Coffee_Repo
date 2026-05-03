#include "wifi_provision.h"
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>

namespace wifiProv {

namespace {
Preferences prefs;
WebServer   server(80);
bool        finished = false;

const char PORTAL_HTML[] PROGMEM = R"HTML(<!doctype html>
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
 .row{display:flex;gap:8px;align-items:center}
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
 <div class="row" style="justify-content:space-between;margin-bottom:10px">
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

<div class="card" style="text-align:center"><small id="status">&nbsp;</small></div>

<script>
async function rescan(){
 document.getElementById('nets').innerHTML='<small>Scanning…</small>';
 try{
  const r=await fetch('/scan');
  const list=await r.json();
  if(!list.length){document.getElementById('nets').innerHTML='<small>No networks found.</small>';return}
  document.getElementById('nets').innerHTML=list.map(n=>{
    const safe=n.ssid.replace(/"/g,'&quot;');
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
 document.getElementById('status').textContent='If everything looks good, the machine will reboot in a few seconds.';
});
rescan();
</script>
</body></html>)HTML";

String apName() {
  uint64_t mac = ESP.getEfuseMac();
  char buf[24];
  snprintf(buf, sizeof(buf), "Lyra-Setup-%04X", (uint16_t)(mac & 0xFFFF));
  return String(buf);
}

void handleRoot() {
  server.send_P(200, "text/html", PORTAL_HTML);
}

void handleScan() {
  // Synchronous scan — small AP list only
  int n = WiFi.scanNetworks(false, true);
  String out = "[";
  bool first = true;
  for (int i = 0; i < n && i < 20; i++) {
    if (!first) out += ',';
    first = false;
    String ssid = WiFi.SSID(i);
    ssid.replace("\\", "\\\\");
    ssid.replace("\"", "\\\"");
    out += "{\"ssid\":\"";
    out += ssid;
    out += "\",\"rssi\":";
    out += WiFi.RSSI(i);
    out += ",\"secure\":";
    out += (WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "false" : "true");
    out += "}";
  }
  out += "]";
  WiFi.scanDelete();
  server.send(200, "application/json", out);
}

void handleSave() {
  if (!server.hasArg("ssid")) {
    server.send(400, "text/plain", "Missing SSID");
    return;
  }
  String ssid = server.arg("ssid");
  String pass = server.hasArg("pass") ? server.arg("pass") : String("");

  if (ssid.length() == 0 || ssid.length() > 32) {
    server.send(400, "text/plain", "Invalid SSID");
    return;
  }
  if (pass.length() > 64) {
    server.send(400, "text/plain", "Password too long");
    return;
  }

  prefs.begin("lyra-wifi", false);
  prefs.putString("ssid", ssid);
  prefs.putString("pass", pass);
  prefs.end();

  server.send(200, "text/html",
    "<!doctype html><meta http-equiv=\"refresh\" content=\"3\"/>"
    "<body style=\"font-family:sans-serif;background:#0b0b0b;color:#fff;padding:24px\">"
    "<h2>Saved.</h2><p>Rebooting and connecting to <b>" + ssid + "</b>…</p></body>");

  finished = true;
}

void handleNotFound() {
  // Captive-portal style: any unknown URL bounces back to root
  server.sendHeader("Location", "/");
  server.send(302, "text/plain", "");
}

} // namespace

void beginPortal() {
  Serial.println(F("[prov] starting captive AP"));

  WiFi.disconnect(true, true);
  WiFi.mode(WIFI_AP_STA);                  // STA enabled so we can scan

  String ssid = apName();
  WiFi.softAP(ssid.c_str());               // open network for setup
  IPAddress ip = WiFi.softAPIP();
  Serial.printf("[prov] AP \"%s\" up at http://%s\n", ssid.c_str(), ip.toString().c_str());

  server.on("/",      HTTP_GET,  handleRoot);
  server.on("/scan",  HTTP_GET,  handleScan);
  server.on("/save",  HTTP_POST, handleSave);
  server.onNotFound(handleNotFound);
  server.begin();

  unsigned long startedAt = millis();
  finished = false;
  while (!finished && millis() - startedAt < PROVISION_TIMEOUT_MS) {
    server.handleClient();
    delay(2);
  }
  server.close();
  WiFi.softAPdisconnect(true);

  if (finished) {
    Serial.println(F("[prov] credentials saved — rebooting"));
    delay(800);
    ESP.restart();
  } else {
    Serial.println(F("[prov] timed out — leaving portal"));
  }
}

bool loadCredentials(char* ssid, size_t ssidLen, char* pass, size_t passLen) {
  prefs.begin("lyra-wifi", true);
  String s = prefs.getString("ssid", "");
  String p = prefs.getString("pass", "");
  prefs.end();
  if (s.length() == 0) return false;
  strlcpy(ssid, s.c_str(), ssidLen);
  strlcpy(pass, p.c_str(), passLen);
  return true;
}

void clearCredentials() {
  prefs.begin("lyra-wifi", false);
  prefs.clear();
  prefs.end();
}

} // namespace wifiProv
