#!/usr/bin/env bash
# Lyra kiosk launcher — called by startx on tty1 auto-login.
# No window manager needed; Chromium runs directly on bare X.

WEBAPP_URL="http://localhost:3000"
IDENTITY_FILE="/etc/lyra/machine.json"

# Disable screen blanking
xset s off -dpms 2>/dev/null || true
xset s noblank 2>/dev/null || true

# Wait for the webapp to respond (up to 120 s)
echo "[kiosk] waiting for webapp..."
for i in $(seq 1 60); do
  if curl -sf --max-time 2 "${WEBAPP_URL}" > /dev/null 2>&1; then
    echo "[kiosk] webapp is up"
    break
  fi
  sleep 2
done

# Resolve machine URL from identity file
if [ -f "${IDENTITY_FILE}" ]; then
  MACHINE_ID=$(python3 -c "import json; d=json.load(open('${IDENTITY_FILE}')); print(d.get('id',''))" 2>/dev/null || true)
else
  MACHINE_ID=""
fi

if [ -n "${MACHINE_ID}" ]; then
  URL="${WEBAPP_URL}/?machine=${MACHINE_ID}"
else
  URL="${WEBAPP_URL}"
fi

echo "[kiosk] opening ${URL}"

# Launch Chromium in kiosk mode on bare X (no window manager)
exec chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --no-first-run \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  --display=:0 \
  "${URL}"
