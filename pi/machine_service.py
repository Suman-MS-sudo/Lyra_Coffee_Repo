#!/usr/bin/env python3
"""
Lyra Coffee Machine — Raspberry Pi 5 Machine Controller
Replaces the ESP32 firmware (src/main.cpp).

GPIO library : gpiozero + lgpio backend (Pi 5 / RP1 chip compatible).
               Falls back to simulation mode on non-Pi hardware.

Identity     : machine UUID and API key persisted at /etc/lyra/machine.json
               by /api/machine/identify on first successful poll.

Motor wiring : dual H-bridge (e.g. L298N or DRV8833).
               Each pump has two control pins (A = forward, B = reverse).
               Both LOW = coasting stop.

BCM pin map  (40-pin header, matches the wiring table in pi/setup.sh):
  MILK_A   → BCM 17  (pin 11)    MILK_B   → BCM 27  (pin 13)
  COFFEE_A → BCM 22  (pin 15)    COFFEE_B → BCM 23  (pin 16)
  TEA_A    → BCM 24  (pin 18)    TEA_B    → BCM 25  (pin 22)
  BTN_MILK → BCM  5  (pin 29)    BTN_COFFEE→ BCM  6  (pin 31)
  BTN_TEA  → BCM 13  (pin 33)    BTN_PROV → BCM 19  (pin 35)
"""

import os
import sys
import json
import time
import signal
import hashlib
import logging
import threading
from pathlib import Path

import requests

# ────────────────────────────────────────────────────────────────
#  Logging
# ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/var/log/lyra-machine.log', encoding='utf-8'),
    ],
)
log = logging.getLogger('lyra')

# ────────────────────────────────────────────────────────────────
#  Configuration
# ────────────────────────────────────────────────────────────────
SERVER_URL     = os.environ.get('LYRA_SERVER_URL', 'http://localhost:3000')
IDENTITY_FILE  = Path('/etc/lyra/machine.json')

# BCM pin numbers
PIN_MILK_A   = 17
PIN_MILK_B   = 27
PIN_COFFEE_A = 22
PIN_COFFEE_B = 23
PIN_TEA_A    = 24
PIN_TEA_B    = 25

PIN_BTN_MILK   = 5
PIN_BTN_COFFEE = 6
PIN_BTN_TEA    = 13
PIN_BTN_PROV   = 19

# Recipe timing (seconds) — mirrors RECIPE_* in main.cpp
AGITATE_S     = 3.0
FLUSH_S       = 1.0
MILK_ONLY_S   = 5.0
RECIPES = {
    'light':  {'decoct_s': 2.0, 'milk_s': 6.0},
    'medium': {'decoct_s': 3.0, 'milk_s': 4.7},
    'strong': {'decoct_s': 4.0, 'milk_s': 3.3},
}

POLL_INTERVAL_S      = 3.0
HEARTBEAT_INTERVAL_S = 60.0
BTN_DEBOUNCE_S       = 0.05
BTN_LOCKOUT_S        = 1.5

# How long to wait for identify to succeed before retrying
IDENTIFY_RETRY_S = 5.0

# ────────────────────────────────────────────────────────────────
#  GPIO setup (gpiozero + lgpio for Pi 5; sim fallback otherwise)
# ────────────────────────────────────────────────────────────────
GPIO_AVAILABLE = False

try:
    from gpiozero import OutputDevice, Button
    from gpiozero.pins.lgpio import LGPIOFactory
    from gpiozero import Device
    Device.pin_factory = LGPIOFactory()

    milk_a   = OutputDevice(PIN_MILK_A,   initial_value=False)
    milk_b   = OutputDevice(PIN_MILK_B,   initial_value=False)
    coffee_a = OutputDevice(PIN_COFFEE_A, initial_value=False)
    coffee_b = OutputDevice(PIN_COFFEE_B, initial_value=False)
    tea_a    = OutputDevice(PIN_TEA_A,    initial_value=False)
    tea_b    = OutputDevice(PIN_TEA_B,    initial_value=False)

    btn_milk   = Button(PIN_BTN_MILK,   pull_up=True, bounce_time=BTN_DEBOUNCE_S)
    btn_coffee = Button(PIN_BTN_COFFEE, pull_up=True, bounce_time=BTN_DEBOUNCE_S)
    btn_tea    = Button(PIN_BTN_TEA,    pull_up=True, bounce_time=BTN_DEBOUNCE_S)
    btn_prov   = Button(PIN_BTN_PROV,   pull_up=True, bounce_time=BTN_DEBOUNCE_S)

    GPIO_AVAILABLE = True
    log.info('[gpio] gpiozero + lgpio backend ready')

except Exception as exc:
    log.warning(f'[gpio] unavailable — running in SIMULATION mode ({exc})')

    class _FakePin:
        def on(self):  log.debug('[sim] pin ON')
        def off(self): log.debug('[sim] pin OFF')

    class _FakeBtn:
        when_pressed = None
        hold_time    = 3.0

    milk_a = milk_b = coffee_a = coffee_b = tea_a = tea_b = _FakePin()
    btn_milk = btn_coffee = btn_tea = btn_prov = _FakeBtn()

# ────────────────────────────────────────────────────────────────
#  Global state
# ────────────────────────────────────────────────────────────────
machine_id    = None
machine_key   = None
busy          = threading.Event()   # set while dispensing
btn_lock_until = 0.0
last_heartbeat = 0.0
_running       = True

# ────────────────────────────────────────────────────────────────
#  MAC / identity helpers
# ────────────────────────────────────────────────────────────────
def get_mac_address() -> str:
    """Return the Pi's hardware MAC (eth0 → end0 → wlan0 → derived)."""
    for iface in ('eth0', 'end0', 'wlan0'):
        p = Path(f'/sys/class/net/{iface}/address')
        if p.exists():
            mac = p.read_text().strip().upper()
            if mac and mac != '00:00:00:00:00:00':
                return mac
    # Last resort: derive from /etc/machine-id
    try:
        mid = Path('/etc/machine-id').read_text().strip()
        h   = hashlib.md5(mid.encode()).hexdigest()
        return ':'.join(h[i:i+2] for i in range(0, 12, 2)).upper()
    except Exception:
        return 'PI:00:00:00:00:00'


def load_identity() -> bool:
    global machine_id, machine_key
    if not IDENTITY_FILE.exists():
        return False
    try:
        data        = json.loads(IDENTITY_FILE.read_text())
        machine_id  = data.get('id')
        machine_key = data.get('api_key')
        if machine_id and machine_key:
            log.info(f'[identity] loaded id={machine_id} key={machine_key[:8]}…')
            return True
    except Exception as e:
        log.warning(f'[identity] load error: {e}')
    return False


def save_identity(data: dict):
    global machine_id, machine_key
    IDENTITY_FILE.parent.mkdir(parents=True, exist_ok=True)
    IDENTITY_FILE.write_text(json.dumps(data, indent=2))
    machine_id  = data['id']
    machine_key = data['api_key']
    log.info(f'[identity] saved id={machine_id}')


def clear_identity():
    global machine_id, machine_key
    if IDENTITY_FILE.exists():
        IDENTITY_FILE.unlink()
    machine_id = machine_key = None
    log.info('[identity] cleared — will re-identify on next poll')


def identify_with_server() -> bool:
    mac = get_mac_address()
    log.info(f'[identify] mac={mac}')
    try:
        r = requests.post(
            f'{SERVER_URL}/api/machine/identify',
            json={'mac_id': mac},
            timeout=10,
        )
        if r.status_code == 200:
            data = r.json()
            if data.get('id') and data.get('api_key'):
                save_identity(data)
                return True
            log.warning(f'[identify] response missing id/key: {data}')
        elif r.status_code == 409:
            # Already provisioned — re-use stored identity or wait for admin reset
            log.warning('[identify] 409 — machine already provisioned; using stored identity if available')
        else:
            log.warning(f'[identify] HTTP {r.status_code}: {r.text[:200]}')
    except requests.ConnectionError:
        log.warning('[identify] webapp not ready yet — will retry')
    except Exception as e:
        log.warning(f'[identify] error: {e}')
    return False

# ────────────────────────────────────────────────────────────────
#  API helpers
# ────────────────────────────────────────────────────────────────
def _headers() -> dict:
    h = {'Content-Type': 'application/json'}
    if machine_id:  h['X-Machine-Id']  = machine_id
    if machine_key: h['Authorization'] = f'Bearer {machine_key}'
    return h


def poll_once() -> dict | None:
    try:
        r = requests.get(f'{SERVER_URL}/api/machine/poll', headers=_headers(), timeout=10)
        if r.status_code == 204:
            return None
        if r.status_code in (401, 403):
            log.warning(f'[poll] HTTP {r.status_code} — stale key, re-identifying')
            clear_identity()
            return None
        if r.status_code == 200 and r.text.strip():
            return r.json()
        log.debug(f'[poll] HTTP {r.status_code}')
    except requests.ConnectionError:
        log.warning('[poll] connection error — webapp may not be ready')
    except Exception as e:
        log.warning(f'[poll] error: {e}')
    return None


def ack_order(order_id: str, status: str, error: str = None):
    body = {'order_id': order_id, 'status': status}
    if error:
        body['error'] = error
    try:
        r = requests.post(
            f'{SERVER_URL}/api/machine/ack',
            json=body,
            headers=_headers(),
            timeout=10,
        )
        log.info(f'[ack] HTTP {r.status_code}')
    except Exception as e:
        log.warning(f'[ack] error: {e}')


def send_heartbeat():
    try:
        r    = requests.post(f'{SERVER_URL}/api/machine/heartbeat', json={}, headers=_headers(), timeout=10)
        data = r.json() if r.status_code == 200 else {}
        ok   = data.get('ok', False)
        if r.status_code in (401, 403):
            log.warning('[heartbeat] stale key — re-identifying')
            clear_identity()
        elif ok:
            log.info(f'[heartbeat] ok server_time={data.get("server_time","")}')
        else:
            log.warning(f'[heartbeat] HTTP {r.status_code} body={r.text[:80]}')
    except Exception as e:
        log.warning(f'[heartbeat] error: {e}')

# ────────────────────────────────────────────────────────────────
#  Motor helpers
# ────────────────────────────────────────────────────────────────
def _forward(a, b, duration: float):
    a.on(); b.off()
    time.sleep(duration)

def _reverse(a, b, duration: float):
    a.off(); b.on()
    time.sleep(duration)

def _stop(a, b):
    a.off(); b.off()

def stop_all():
    for a, b in [(milk_a, milk_b), (coffee_a, coffee_b), (tea_a, tea_b)]:
        _stop(a, b)

# ────────────────────────────────────────────────────────────────
#  Recipe dispatcher
# ────────────────────────────────────────────────────────────────
def run_recipe(drink: str, strength: str, with_milk: bool):
    global btn_lock_until
    busy.set()
    btn_lock_until = time.monotonic() + BTN_LOCKOUT_S
    log.info(f'[dispense] drink={drink} strength={strength} milk={with_milk}')

    try:
        recipe      = RECIPES.get(strength, RECIPES['medium'])
        is_milk_only = drink == 'milk'

        if is_milk_only and not with_milk:
            log.info('[dispense] milk-only with milk=false — no-op')
            return

        # ── Decoction pump (coffee / tea) ──────────────────────
        if drink == 'coffee':
            dec = (coffee_a, coffee_b)
        elif drink == 'tea':
            dec = (tea_a, tea_b)
        else:
            dec = None

        if dec:
            log.info('[dispense] decoction agitate')
            _reverse(*dec, AGITATE_S)
            log.info(f'[dispense] decoction forward {recipe["decoct_s"]:.1f}s')
            _forward(*dec, recipe['decoct_s'])
            log.info('[dispense] decoction flush')
            _reverse(*dec, FLUSH_S)
            _stop(*dec)

        # ── Milk pump ───────────────────────────────────────────
        if with_milk:
            milk_dur = MILK_ONLY_S if is_milk_only else recipe['milk_s']
            log.info('[dispense] milk agitate')
            _reverse(milk_a, milk_b, AGITATE_S)
            log.info(f'[dispense] milk forward {milk_dur:.1f}s')
            _forward(milk_a, milk_b, milk_dur)
            log.info('[dispense] milk flush')
            _reverse(milk_a, milk_b, FLUSH_S)
            _stop(milk_a, milk_b)

    finally:
        stop_all()
        busy.clear()
        log.info('[dispense] done')

# ────────────────────────────────────────────────────────────────
#  Button callbacks (run on gpiozero event thread)
# ────────────────────────────────────────────────────────────────
def _btn_handler(drink: str):
    if busy.is_set() or time.monotonic() < btn_lock_until:
        return
    log.info(f'[btn] {drink}')
    threading.Thread(
        target=run_recipe,
        args=(drink, 'medium', True),
        daemon=True,
    ).start()

if GPIO_AVAILABLE:
    btn_milk.when_pressed   = lambda: _btn_handler('milk')
    btn_coffee.when_pressed = lambda: _btn_handler('coffee')
    btn_tea.when_pressed    = lambda: _btn_handler('tea')

    # Provisioning button: hold 5 s → clear identity; hold 10 s → factory reset
    # For Pi, "factory reset" just removes the identity file.
    btn_prov.hold_time = 5.0
    def _prov_held():
        log.info('[prov] button held — clearing machine identity')
        clear_identity()
    btn_prov.when_held = _prov_held

# ────────────────────────────────────────────────────────────────
#  Signal handling
# ────────────────────────────────────────────────────────────────
def _shutdown(sig, _frame):
    global _running
    log.info(f'[boot] received signal {sig} — shutting down')
    _running = False
    stop_all()

signal.signal(signal.SIGTERM, _shutdown)
signal.signal(signal.SIGINT,  _shutdown)

# ────────────────────────────────────────────────────────────────
#  Main loop
# ────────────────────────────────────────────────────────────────
def main():
    global last_heartbeat

    log.info('=' * 60)
    log.info(' Lyra Pi5 Machine Service starting')
    log.info(f' Server  : {SERVER_URL}')
    log.info(f' GPIO    : {"enabled" if GPIO_AVAILABLE else "SIMULATION"}')
    log.info('=' * 60)

    stop_all()

    if not load_identity():
        log.info('[boot] no saved identity — will identify on first poll')

    while _running:
        # ── Ensure identity ─────────────────────────────────────
        if not machine_id:
            if not identify_with_server():
                time.sleep(IDENTIFY_RETRY_S)
                continue

        # ── Heartbeat ───────────────────────────────────────────
        now = time.monotonic()
        if now - last_heartbeat > HEARTBEAT_INTERVAL_S:
            last_heartbeat = now
            send_heartbeat()

        # ── Poll for orders ─────────────────────────────────────
        if not busy.is_set():
            order = poll_once()
            if order:
                order_id  = order.get('order_id', '')
                drink     = order.get('drink_type', 'coffee')
                cust      = order.get('customization') or {}
                strength  = cust.get('strength', 'medium')
                with_milk = bool(cust.get('milk', True))

                log.info(f'[poll] job={order_id} drink={drink} strength={strength} milk={with_milk}')
                try:
                    run_recipe(drink, strength, with_milk)
                    ack_order(order_id, 'dispensed')
                except Exception as exc:
                    log.error(f'[dispense] failed: {exc}', exc_info=True)
                    ack_order(order_id, 'failed', str(exc))

        time.sleep(POLL_INTERVAL_S)

    log.info('[boot] service stopped')


if __name__ == '__main__':
    main()
