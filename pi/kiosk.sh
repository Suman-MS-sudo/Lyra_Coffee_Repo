#!/usr/bin/env bash
# Lyra kiosk launcher — runs on the Pi 5's 7" HDMI display.
# Reads the machine UUID from /etc/lyra/machine.json (set after first identify).
# Falls back to the landing page if identity is not yet provisioned.

set -euo pipefail

WEBAPP_URL="http://localhost:3000"
IDENTITY_FILE="/etc/lyra/machine.json"

# Wait for the webapp to respond (up to 60 s)
echo "[kiosk] waiting for webapp..."
for i in $(seq 1 30); do
  if curl -sf --max-time 2 "${WEBAPP_URL}" > /dev/null 2>&1; then
    echo "[kiosk] webapp is up"
    break
  fi
  sleep 2
done

# Resolve machine URL
if [ -f "${IDENTITY_FILE}" ]; then
  MACHINE_ID=$(python3 -c "import json,sys; d=json.load(open('${IDENTITY_FILE}')); print(d.get('id',''))" 2>/dev/null || true)
else
  MACHINE_ID=""
fi

if [ -n "${MACHINE_ID}" ]; then
  URL="${WEBAPP_URL}/?machine=${MACHINE_ID}"
  echo "[kiosk] navigating to ${URL}"
else
  URL="${WEBAPP_URL}"
  echo "[kiosk] no machine identity yet — showing landing page (${URL})"
fi

# Disable screen blanking / screensaver
xset s off -dpms 2>/dev/null || true

# Launch Chromium in kiosk mode
# --ozone-platform=wayland : use Wayland on Pi OS Bookworm
# --kiosk                  : full-screen, no chrome
# --noerrdialogs           : suppress crash dialogs
# --disable-infobars       : no "Chrome is being controlled" bar
exec chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --no-first-run \
  --ozone-platform=wayland \
  --enable-features=UseOzonePlatform \
  --autoplay-policy=no-user-gesture-required \
  "${URL}"
