#!/usr/bin/env bash
# =============================================================================
#  Lyra Coffee Machine — Raspberry Pi 5 Setup Script
#  Run as root on a fresh Pi OS Bookworm (64-bit) install.
#
#  What this script does:
#    1. Installs system packages (Node.js 20, Python 3, SQLite, Chromium, git)
#    2. Copies the project to /opt/lyra
#    3. Installs npm dependencies (including building better-sqlite3 native addon)
#    4. Installs Python dependencies (gpiozero, lgpio, requests)
#    5. Creates the DB directory and seeds an initial admin user
#    6. Writes .env.local for the webapp
#    7. Builds the Next.js app
#    8. Installs and enables systemd services
#    9. Configures auto-login and kiosk display
#   10. Enables mDNS hostname (lyra.local)
# =============================================================================

set -euo pipefail

# ── Colour helpers ───────────────────────────────────────────────
RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GRN}[setup]${NC} $*"; }
warn()  { echo -e "${YLW}[warn] ${NC} $*"; }
error() { echo -e "${RED}[error]${NC} $*"; exit 1; }

# ── Must run as root ─────────────────────────────────────────────
[ "$(id -u)" -eq 0 ] || error "Run this script as root: sudo bash pi/setup.sh"

# Detect the real user who invoked sudo (not root)
LYRA_USER="${SUDO_USER:-$(logname 2>/dev/null || echo pi)}"
LYRA_HOME="/home/${LYRA_USER}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

info "Lyra Pi 5 Setup"
info "Repo   : ${REPO_DIR}"
info "Install: /opt/lyra"

# =============================================================================
# 1. System packages
# =============================================================================
info "Updating package lists..."
apt-get update -qq

info "Installing system packages..."
apt-get install -y --no-install-recommends \
  git curl wget ca-certificates gnupg \
  python3 python3-pip python3-venv \
  sqlite3 libsqlite3-dev \
  avahi-daemon \
  xdotool \
  build-essential \
  swig \
  liblgpio-dev \
  python3-dev \
  xorg xserver-xorg-legacy openbox lightdm \
  x11-xserver-utils unclutter \
  2>/dev/null

apt-get install -y --no-install-recommends chromium
ln -sf /usr/bin/chromium /usr/local/bin/chromium-browser 2>/dev/null || true

# ── Node.js 20 LTS (via NodeSource) ─────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node --version)" != v20* ]]; then
  info "Installing Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  info "Node.js $(node --version) already installed"
fi

# =============================================================================
# 2. Copy project to /opt/lyra
# =============================================================================
info "Copying project to /opt/lyra..."
mkdir -p /opt/lyra
rsync -a --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='.pio' \
  "${REPO_DIR}/" /opt/lyra/

chown -R "${LYRA_USER}:${LYRA_USER}" /opt/lyra

# =============================================================================
# 3. Add swap space (Next.js build needs more than 2GB RAM on Pi 5)
# =============================================================================
SWAP_FILE="/swapfile"
if [ ! -f "${SWAP_FILE}" ]; then
  info "Creating 2GB swap file (needed for Next.js build)..."
  fallocate -l 2G "${SWAP_FILE}"
  chmod 600 "${SWAP_FILE}"
  mkswap "${SWAP_FILE}"
  swapon "${SWAP_FILE}"
  echo "${SWAP_FILE} none swap sw 0 0" >> /etc/fstab
  info "Swap enabled"
else
  swapon "${SWAP_FILE}" 2>/dev/null || true
  info "Swap already exists"
fi

# =============================================================================
# 4. Install npm dependencies and build Next.js
# =============================================================================
info "Installing npm dependencies (this builds better-sqlite3 from source — takes a few minutes)..."
cd /opt/lyra/webapp-next
sudo -u "${LYRA_USER}" npm install --prefer-offline 2>&1 | tail -20

# =============================================================================
# 4. Python virtual environment + dependencies
# =============================================================================
info "Setting up Python virtual environment..."
python3 -m venv /opt/lyra/pi/.venv
/opt/lyra/pi/.venv/bin/pip install --quiet --upgrade pip
/opt/lyra/pi/.venv/bin/pip install --quiet -r /opt/lyra/pi/requirements.txt
info "Python deps installed"

# Update the service ExecStart to use the venv Python
sed -i 's|/usr/bin/python3|/opt/lyra/pi/.venv/bin/python3|g' /opt/lyra/pi/lyra-machine.service

# =============================================================================
# 5. Database directory
# =============================================================================
info "Creating database directory..."
mkdir -p /var/lib/lyra
chown "${LYRA_USER}:${LYRA_USER}" /var/lib/lyra

# =============================================================================
# 6. Write .env.local
# =============================================================================
ENV_FILE="/opt/lyra/webapp-next/.env.local"

if [ -f "${ENV_FILE}" ]; then
  warn ".env.local already exists — skipping (edit manually if needed)"
else
  info "Writing .env.local..."

  # Generate secrets
  ADMIN_JWT_SECRET=$(openssl rand -hex 32)
  MACHINE_API_SECRET=$(openssl rand -hex 32)

  cat > "${ENV_FILE}" <<EOF
# Generated by pi/setup.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)

# ── Pi local mode ──────────────────────────────────────────────
LOCAL_MODE=true
SQLITE_DB_PATH=/var/lib/lyra/lyra.db
NEXT_PUBLIC_APP_URL=http://lyra.local:3000

# ── Auth secrets ───────────────────────────────────────────────
ADMIN_JWT_SECRET=${ADMIN_JWT_SECRET}
MACHINE_API_SECRET=${MACHINE_API_SECRET}
NODE_ENV=production

# ── Razorpay (only needed if machine is NOT set to is_free) ────
# Uncomment and fill in when internet payments are needed.
# NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_...
# RAZORPAY_KEY_SECRET=...
# RAZORPAY_WEBHOOK_SECRET=...

# ── Supabase (NOT used in LOCAL_MODE, kept for reference) ──────
# NEXT_PUBLIC_SUPABASE_URL=
# SUPABASE_SERVICE_ROLE_KEY=
EOF
  chown "${LYRA_USER}:${LYRA_USER}" "${ENV_FILE}"
  info ".env.local written (admin JWT and machine secrets are auto-generated)"
fi

# =============================================================================
# 7. Build Next.js
# =============================================================================
if [ -d "/opt/lyra/webapp-next/.next" ]; then
  info "Next.js already built (.next folder present) — skipping build"
else
  info "Building Next.js app (this takes 5-10 min on Pi 5)..."
  cd /opt/lyra/webapp-next
  sudo -u "${LYRA_USER}" NODE_ENV=production NODE_OPTIONS="--max-old-space-size=1536" npm run build 2>&1 | tail -30
  info "Next.js build complete"
fi

# =============================================================================
# 8. Seed initial admin user in SQLite
# =============================================================================
info "Seeding admin user in SQLite..."
DB_PATH="/var/lib/lyra/lyra.db"

# Schema is created by the webapp on first request, but we need it now.
sqlite3 "${DB_PATH}" < /opt/lyra/webapp-next/src/lib/db/schema.sql 2>/dev/null || true

# Prompt for admin credentials
echo ""
echo "──────────────────────────────────────────────"
echo " Create the initial admin account"
echo "──────────────────────────────────────────────"
read -rp "Admin email    : " ADMIN_EMAIL
read -rsp "Admin password : " ADMIN_PASS
echo ""

# Hash password with SHA-256 (matches the login route)
PASS_HASH=$(echo -n "${ADMIN_PASS}" | sha256sum | awk '{print $1}')
ADMIN_ID=$(python3 -c "import uuid; print(uuid.uuid4())")
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

sqlite3 "${DB_PATH}" <<SQL
INSERT OR IGNORE INTO coffee_admins (id, email, password_hash, name, is_active, created_at)
VALUES ('${ADMIN_ID}', '${ADMIN_EMAIL}', '${PASS_HASH}', 'Admin', 1, '${NOW}');
SQL
info "Admin user created: ${ADMIN_EMAIL}"

# =============================================================================
# 9. Seed the physical machine row
# =============================================================================
echo ""
echo "──────────────────────────────────────────────"
echo " Register this Pi as a machine"
echo "──────────────────────────────────────────────"
read -rp "Machine name   : " MACHINE_NAME
read -rp "Machine location (optional): " MACHINE_LOC

# Read MAC address (prefer eth0, then end0, then wlan0)
MACHINE_MAC=""
for IFACE in eth0 end0 wlan0; do
  MAC_FILE="/sys/class/net/${IFACE}/address"
  if [ -f "${MAC_FILE}" ]; then
    MAC_TRY=$(cat "${MAC_FILE}" | tr '[:lower:]' '[:upper:]')
    if [ "${MAC_TRY}" != "00:00:00:00:00:00" ]; then
      MACHINE_MAC="${MAC_TRY}"
      break
    fi
  fi
done

if [ -z "${MACHINE_MAC}" ]; then
  warn "Could not detect MAC address automatically."
  read -rp "Enter MAC address (XX:XX:XX:XX:XX:XX): " MACHINE_MAC
fi

MACHINE_ID=$(python3 -c "import uuid; print(uuid.uuid4())")
# Placeholder hash — will be replaced by /api/machine/identify on first Python service start
PLACEHOLDER_KEY_HASH=$(echo -n "placeholder-${MACHINE_ID}" | sha256sum | awk '{print $1}')

sqlite3 "${DB_PATH}" <<SQL
INSERT OR IGNORE INTO coffee_machines
  (id, name, location, status, api_key_hash, is_free, mac_id, created_at, updated_at)
VALUES
  ('${MACHINE_ID}',
   '${MACHINE_NAME}',
   '${MACHINE_LOC:-NULL}',
   'active',
   '${PLACEHOLDER_KEY_HASH}',
   1,
   '${MACHINE_MAC}',
   '${NOW}',
   '${NOW}');
SQL
info "Machine registered: ${MACHINE_NAME} (${MACHINE_MAC})"

# =============================================================================
# 10. Install systemd services
# =============================================================================
info "Installing systemd services..."

# Fix ExecStart path for Next.js (npm global bin)
NPM_BIN=$(npm bin -g 2>/dev/null || echo "/usr/local/bin")
NEXT_BIN=$(which next 2>/dev/null || echo "${NPM_BIN}/next")

cat > /etc/systemd/system/lyra-webapp.service <<EOF
[Unit]
Description=Lyra Coffee Machine Next.js Webapp
After=network.target

[Service]
Type=simple
User=${LYRA_USER}
WorkingDirectory=/opt/lyra/webapp-next
ExecStart=$(which node) /opt/lyra/webapp-next/node_modules/.bin/next start -p 3000
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production
EnvironmentFile=/opt/lyra/webapp-next/.env.local

[Install]
WantedBy=multi-user.target
EOF

cp /opt/lyra/pi/lyra-machine.service /etc/systemd/system/
cp /opt/lyra/pi/lyra-kiosk.service   /etc/systemd/system/

chmod +x /opt/lyra/pi/kiosk.sh

systemctl daemon-reload
systemctl enable lyra-webapp.service lyra-machine.service lyra-kiosk.service
info "Services enabled"

# =============================================================================
# 11. mDNS hostname (lyra.local)
# =============================================================================
info "Configuring mDNS hostname..."
OLD_HOST=$(hostname)
hostnamectl set-hostname lyra
# Update /etc/hosts
sed -i "s/${OLD_HOST}/lyra/g" /etc/hosts 2>/dev/null || true
systemctl enable avahi-daemon
systemctl restart avahi-daemon
info "Hostname set to 'lyra' → accessible as http://lyra.local:3000"

# =============================================================================
# 12. Display: auto-login + minimal kiosk window manager (Lite OS compatible)
# =============================================================================
info "Configuring auto-login and kiosk display..."

# LightDM auto-login for user pi
mkdir -p /etc/lightdm/lightdm.conf.d
cat > /etc/lightdm/lightdm.conf.d/50-lyra-autologin.conf <<EOF
[Seat:*]
autologin-user=${LYRA_USER}
autologin-user-timeout=0
user-session=openbox
EOF

# Openbox autostart — launches the kiosk script on login
mkdir -p "${LYRA_HOME}/.config/openbox"
cat > "${LYRA_HOME}/.config/openbox/autostart" <<'EOF'
# Hide mouse cursor after 1 second of inactivity
unclutter -idle 1 -root &

# Launch Lyra kiosk
/opt/lyra/pi/kiosk.sh &
EOF
chown -R "${LYRA_USER}:${LYRA_USER}" "${LYRA_HOME}/.config"

# Disable screen blank in X11
mkdir -p /etc/X11/xorg.conf.d
cat > /etc/X11/xorg.conf.d/10-no-blank.conf <<'EOF'
Section "ServerFlags"
  Option "BlankTime"   "0"
  Option "StandbyTime" "0"
  Option "SuspendTime" "0"
  Option "OffTime"     "0"
EndSection
EOF

# Set graphical boot target
systemctl set-default graphical.target
systemctl enable lightdm

# =============================================================================
# Done
# =============================================================================
echo ""
echo -e "${GRN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GRN}║          Lyra Pi 5 setup complete!                   ║${NC}"
echo -e "${GRN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Admin panel : http://lyra.local:3000/admin/login"
echo "  Admin email : ${ADMIN_EMAIL}"
echo "  Machine MAC : ${MACHINE_MAC}"
echo "  Machine ID  : ${MACHINE_ID}"
echo ""
echo "  Wiring (BCM pin numbers):"
echo "    MILK_A   → BCM 17   MILK_B   → BCM 27"
echo "    COFFEE_A → BCM 22   COFFEE_B → BCM 23"
echo "    TEA_A    → BCM 24   TEA_B    → BCM 25"
echo "    BTN_MILK → BCM  5   BTN_COFFEE→ BCM  6"
echo "    BTN_TEA  → BCM 13   BTN_PROV → BCM 19"
echo ""
echo "  Next steps:"
echo "    1. Reboot: sudo reboot"
echo "    2. The 7\" display will open the ordering UI automatically."
echo "    3. If machine doesn't appear online, check: sudo journalctl -u lyra-machine -f"
echo ""
