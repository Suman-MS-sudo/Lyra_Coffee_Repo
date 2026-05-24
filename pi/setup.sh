#!/usr/bin/env bash
# =============================================================================
#  Lyra Coffee Machine — Raspberry Pi 5 Setup Script
#  Run as root on a fresh Pi OS Lite Bookworm (64-bit) install.
#
#  What this script does:
#    1. Installs system packages (Chromium, X11, Python GPIO libs)
#    2. Copies the pi/ folder to /opt/lyra/pi
#    3. Installs Python GPIO dependencies via apt
#    4. Installs and enables the GPIO machine service
#    5. Configures console autologin + startx kiosk
#    6. Enables mDNS hostname (lyra.local)
#
#  The Next.js webapp runs in the CLOUD at https://brew.lyra-app.co.in
#  The Pi is a pure display + GPIO device — no local webapp, no database.
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GRN}[setup]${NC} $*"; }
warn()  { echo -e "${YLW}[warn] ${NC} $*"; }
error() { echo -e "${RED}[error]${NC} $*"; exit 1; }

[ "$(id -u)" -eq 0 ] || error "Run as root: sudo bash pi/setup.sh"

LYRA_USER="${SUDO_USER:-$(logname 2>/dev/null || echo pi)}"
LYRA_HOME="/home/${LYRA_USER}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

info "Lyra Pi 5 Setup (cloud kiosk mode)"
info "User: ${LYRA_USER}"

# =============================================================================
# 1. Fix /etc/hosts so sudo doesn't warn about hostname
# =============================================================================
HOSTNAME_NOW=$(hostname)
grep -q "${HOSTNAME_NOW}" /etc/hosts || echo "127.0.1.1 ${HOSTNAME_NOW}" >> /etc/hosts

# =============================================================================
# 2. System packages
# =============================================================================
info "Updating package lists..."
apt-get update -qq

info "Installing system packages..."
apt-get install -y --no-install-recommends \
  curl ca-certificates avahi-daemon \
  xorg xserver-xorg-legacy openbox xinit \
  x11-xserver-utils unclutter \
  chromium \
  python3 python3-gpiozero python3-lgpio python3-requests \
  2>/dev/null

# Chromium binary name varies — normalise to chromium-browser
ln -sf /usr/bin/chromium /usr/local/bin/chromium-browser 2>/dev/null || true

# =============================================================================
# 3. Copy pi/ scripts to /opt/lyra/pi
# =============================================================================
info "Installing pi scripts to /opt/lyra/pi..."
mkdir -p /opt/lyra/pi
cp "${SCRIPT_DIR}/machine_service.py" /opt/lyra/pi/
cp "${SCRIPT_DIR}/kiosk.sh"          /opt/lyra/pi/
cp "${SCRIPT_DIR}/lyra-machine.service" /opt/lyra/pi/
chmod +x /opt/lyra/pi/kiosk.sh /opt/lyra/pi/machine_service.py
chown -R "${LYRA_USER}:${LYRA_USER}" /opt/lyra

# =============================================================================
# 4. GPIO machine service (talks to cloud API)
# =============================================================================
info "Installing lyra-machine systemd service..."
cat > /etc/systemd/system/lyra-machine.service <<EOF
[Unit]
Description=Lyra Coffee Machine GPIO Controller
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/lyra/pi
ExecStart=/usr/bin/python3 /opt/lyra/pi/machine_service.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=LYRA_SERVER_URL=https://brew.lyra-app.co.in

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable lyra-machine.service
info "lyra-machine service enabled"

# =============================================================================
# 5. Console autologin + startx kiosk (no display manager needed)
# =============================================================================
info "Configuring kiosk display..."

# Auto-login on tty1
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin ${LYRA_USER} --noclear %I \$TERM
EOF

# On tty1 login → start X → kiosk
cat > "${LYRA_HOME}/.bash_profile" <<'PROFILE'
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec startx /opt/lyra/pi/kiosk.sh -- :0 -nocursor 2>/tmp/kiosk-x11.log
fi
PROFILE
chown "${LYRA_USER}:${LYRA_USER}" "${LYRA_HOME}/.bash_profile"

# Prevent X from blanking the screen
mkdir -p /etc/X11/xorg.conf.d
cat > /etc/X11/xorg.conf.d/10-no-blank.conf <<'EOF'
Section "ServerFlags"
  Option "BlankTime"   "0"
  Option "StandbyTime" "0"
  Option "SuspendTime" "0"
  Option "OffTime"     "0"
EndSection
EOF

# Force HDMI output even if display not detected at boot
BOOT_CONFIG="/boot/firmware/config.txt"
[ -f "${BOOT_CONFIG}" ] && grep -q "hdmi_force_hotplug" "${BOOT_CONFIG}" \
  || echo "hdmi_force_hotplug=1" >> "${BOOT_CONFIG}"

# Boot to text (multi-user) — startx handles the display
systemctl set-default multi-user.target
systemctl disable lightdm 2>/dev/null || true

# =============================================================================
# 6. mDNS hostname (lyra.local)
# =============================================================================
info "Setting hostname to 'lyra'..."
OLD_HOST=$(hostname)
hostnamectl set-hostname lyra
sed -i "s/${OLD_HOST}/lyra/g" /etc/hosts 2>/dev/null || true
echo "127.0.1.1 lyra" >> /etc/hosts
systemctl enable avahi-daemon
systemctl restart avahi-daemon 2>/dev/null || true

# =============================================================================
# Done
# =============================================================================
echo ""
echo -e "${GRN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GRN}║          Lyra Pi 5 setup complete!                   ║${NC}"
echo -e "${GRN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Kiosk URL : https://brew.lyra-app.co.in"
echo ""
echo "  Wiring (BCM pin numbers):"
echo "    MILK_A   → BCM 17   MILK_B   → BCM 27"
echo "    COFFEE_A → BCM 22   COFFEE_B → BCM 23"
echo "    TEA_A    → BCM 24   TEA_B    → BCM 25"
echo "    BTN_MILK → BCM  5   BTN_COFFEE→ BCM  6"
echo "    BTN_TEA  → BCM 13   BTN_PROV → BCM 19"
echo ""
echo "  Next steps:"
echo "    1. sudo reboot"
echo "    2. The display will open https://brew.lyra-app.co.in automatically"
echo "    3. GPIO service logs: sudo journalctl -u lyra-machine -f"
echo ""
