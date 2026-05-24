#!/usr/bin/env bash
# Lyra kiosk — opens the cloud ordering UI on the Pi's display.
# Called by startx from ~/.bash_profile on tty1 auto-login.

CLOUD_URL="https://brew.lyra-app.co.in"
IDENTITY_FILE="/etc/lyra/machine.json"

# Disable screen blanking
xset s off -dpms 2>/dev/null || true
xset s noblank  2>/dev/null || true

# Wait for network (up to 30 s)
for i in $(seq 1 15); do
  if curl -sf --max-time 2 "${CLOUD_URL}" > /dev/null 2>&1; then
    break
  fi
  sleep 2
done

# Append machine ID if identity is known
if [ -f "${IDENTITY_FILE}" ]; then
  MACHINE_ID=$(python3 -c "import json; print(json.load(open('${IDENTITY_FILE}')).get('id',''))" 2>/dev/null || true)
fi

URL="${CLOUD_URL}${MACHINE_ID:+/?machine=${MACHINE_ID}}"
echo "[kiosk] opening ${URL}"

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
