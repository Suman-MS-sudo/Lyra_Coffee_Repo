/**
 * Lyra Wi-Fi provisioning — captive AP at 192.168.4.1
 * - softAP "Lyra-Setup-XXXX" (last 4 of MAC, no password)
 * - Scans nearby networks, shows them in a simple form
 * - POST /save persists SSID/password to NVS, then reboots into STA
 *
 * Usage: call wifiProv::beginPortal() from your code (typically when
 * a long-press is detected). Loop will run until the user submits
 * credentials or PROVISION_TIMEOUT_MS elapses.
 */
#pragma once
#include <Arduino.h>

namespace wifiProv {

// Timeout for the portal session (default 10 minutes)
constexpr unsigned long PROVISION_TIMEOUT_MS = 10UL * 60UL * 1000UL;

// Run the captive portal. Blocks until done, then returns.
// On success the device reboots itself, so the call effectively
// only returns on timeout (caller can decide what to do then).
void beginPortal();

// Load saved Wi-Fi credentials into the provided buffers.
// Returns false if nothing was saved yet (caller should fall back
// to compile-time defaults from secrets.h).
bool loadCredentials(char* ssid, size_t ssidLen,
                     char* pass, size_t passLen);

// Wipe stored credentials (used by a "factory reset" gesture).
void clearCredentials();

} // namespace wifiProv
