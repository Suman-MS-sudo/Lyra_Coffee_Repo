#!/usr/bin/env bash
# Lyra kiosk — opens the cloud ordering UI on the Pi's display.
# Called by startx from ~/.bash_profile on tty1 auto-login.

URL="https://brew.lyra-app.co.in/?machine=c78022d7-443a-4d81-a57b-4d55fd104415"

# Disable screen blanking
xset s off -dpms 2>/dev/null || true
xset s noblank  2>/dev/null || true

# Wait for network (up to 60 s)
echo "[kiosk] waiting for network..."
for i in $(seq 1 30); do
  if curl -sf --max-time 2 "https://brew.lyra-app.co.in" > /dev/null 2>&1; then
    echo "[kiosk] network up"
    break
  fi
  sleep 2
done

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
