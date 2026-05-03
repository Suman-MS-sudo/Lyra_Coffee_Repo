# Lyra Coffee Machine — Wiring Reference

> ⚠️ Danger: This project contains **230 V AC** wiring. Verify your connections are correct and the machine is **unplugged from mains** before touching any wiring. Install a GFCI/RCD breaker on the mains feed.

---

## System Block Diagram

```
                      ┌──────────────────────────────────────────────────────┐
    230 V AC MAINS    │                  LOW VOLTAGE (12 V / 3.3 V)          │
    ──────────────    │   ──────────────────────────────────────────────────  │
                      │                                                        │
    RCD/GFCI          │    12 V PSU ──────────┬──── L298N #1 (VCC)           │
       │              │         │             ├──── L298N #2 (VCC)           │
    Fuse 5A           │         └── GND bus   ├──── Solenoid Valve (+)       │
       │              │                       └──── Optional: 5V Buck → ESP32│
    Power Switch      │                                                        │
       │              │    ESP32 3.3V ──────── DS18B20 VCC (×3)              │
       ├──────────────┼──► SSR #1 (AC side) ──── Heater Water (500W)         │
       ├──────────────┼──► SSR #2 (AC side) ──── Heater Milk (300W)          │
       └──────────────┼──► SSR #3 (AC side) ──── Heater Decoction (200W)     │
                      │                                                        │
                      │    ESP32 GPIO ──────────► SSR DC control input (×3)   │
                      │    ESP32 GPIO ──────────► L298N IN1/IN2 (×8)          │
                      │    ESP32 GPIO ──────────► Fill valve relay/transistor  │
                      │    ESP32 GPIO ──────────► Buzzer                       │
                      │    ESP32 GPIO ◄────────── DS18B20 DATA (OneWire, ×3)  │
                      │    ESP32 GPIO ◄────────── Float switch                 │
                      │    ESP32 GPIO ◄────────── Buttons (×4)                 │
                      └──────────────────────────────────────────────────────┘
```

---

## Power Rails

### 230 V AC Rail

```
Wall outlet → GFCI/RCD → Fuse (5A slow-blow) → Power switch
  │
  ├──► Thermal fuse (100°C) ──► SSR #1 AC OUT ──► Water heater ──► Neutral
  ├──► Thermal fuse (70°C)  ──► SSR #2 AC OUT ──► Milk heater  ──► Neutral
  └──► Thermal fuse (45°C)  ──► SSR #3 AC OUT ──► Decoction heater ──► Neutral
```

### 12 V DC Rail

```
12 V 5 A PSU  (+ red, − black)
  │
  ├──► L298N Module #1 (pin: +12V and GND)
  ├──► L298N Module #2 (pin: +12V and GND)
  ├──► Solenoid fill valve + (via transistor collector)
  └──► Optional: 12V→5V buck converter → ESP32 5V pin
```

### 3.3 V Rail (from ESP32)

```
ESP32 3V3 pin
  ├──► DS18B20 VCC (×3)
  ├──► Pull-up resistors 4.7 kΩ (×3) to OneWire DATA lines
  └──► Pull-up resistors 10 kΩ (×4) to button lines
```

---

## ESP32 GPIO Pin Map

| GPIO | Direction | Connected To | Notes |
|------|-----------|-------------|-------|
| 2 | OUT | L298N #1 → IN2 (Motor 1 — Coffee IN4) | Moved from GPIO 13 to free it for TFT MOSI |
| 4 | OUT | Fill valve transistor base (via 1kΩ) | HIGH = fill open; safe at boot (stays LOW) |
| 12 | OUT | TFT DC (Data/Command) | Low at boot = command mode; safe (display in reset) |
| 13 | OUT | TFT MOSI | SPI data to display |
| 14 | OUT | TFT SCK + L298N #1 IN3 (Coffee IN3) | Shared; TFT_CS deselects display when Coffee runs |
| 15 | OUT | TFT CS | Active LOW; briefly HIGH at boot = deselected = safe |
| 0 | OUT | TFT RESET | Pulsed after boot completes; also BOOT button |
| 16 | OUT | L298N #2 → IN3 (Motor 3 — Hot Water) | |
| 17 | OUT | L298N #2 → IN4 (Motor 3 — Hot Water) | |
| 18 | OUT | SSR #1 DC input (+) | Water heater control |
| 19 | OUT | SSR #2 DC input (+) | Milk heater control |
| 21 | OUT | SSR #3 DC input (+) | Decoction heater control |
| 22 | IN/OUT | DS18B20 DATA bus (all 3) | 4.7 kΩ pull-up to 3.3 V |
| 23 | IN | Float switch | INPUT_PULLUP; LOW = water present |
| 25 | OUT | L298N #1 → IN1 (Motor 0 — Milk IN1) | |
| 26 | OUT | L298N #1 → IN2 (Motor 0 — Milk IN2) | |
| 27 | OUT | Buzzer + (via 330 Ω) | |
| 32 | OUT | L298N #2 → IN1 (Motor 2 — Tea) | |
| 33 | OUT | L298N #2 → IN2 (Motor 2 — Tea) | |
| 34 | IN | Button 1 — Milk | Input-only GPIO; 10 kΩ to 3.3 V |
| 35 | IN | Button 2 — Coffee | Input-only GPIO; 10 kΩ to 3.3 V |
| 36 | IN | Button 3 — Tea | Input-only GPIO; 10 kΩ to 3.3 V |
| 39 | IN | Button 4 — Hot Water | Input-only GPIO; 10 kΩ to 3.3 V |
| 3V3 | PWR | DS18B20 VCC (×3), TFT VCC, pull-up refs | |
| GND | PWR | All grounds | Common GND for all modules |

> **GPIO 34–39 are INPUT-ONLY** on ESP32. They do NOT have internal pull-up resistors. You MUST add 10 kΩ external pull-up resistors from each button pin to 3.3 V.
> **GPIO 14 is shared** between TFT SCK and L298N Coffee IN3. This is safe — TFT_CS (GPIO 15) deselects the display before coffee motor runs.

---

## L298N Motor Driver Modules

### L298N Module #1  (Motor 0 = Milk, Motor 1 = Coffee)

| L298N Pin | Connects To | Notes |
|-----------|------------|-------|
| +12V | 12 V PSU + | Motor power supply |
| GND | Common GND | |
| +5V (output) | Can power ESP32 if no other 5V supply | Onboard 7805 regulator |
| ENA | Leave jumper installed | Motors always enabled; direction via IN1/IN2 |
| ENB | Leave jumper installed | |
| IN1 | ESP32 GPIO 25 | Milk direction A |
| IN2 | ESP32 GPIO 26 | Milk direction B |
| IN3 | ESP32 GPIO 14 | Coffee direction A |
| IN4 | ESP32 GPIO 13 | Coffee direction B |
| OUT1 + OUT2 | Milk peristaltic pump terminals | Polarity doesn't matter — forward/reverse set by code |
| OUT3 + OUT4 | Coffee peristaltic pump terminals | |

### L298N Module #2  (Motor 2 = Tea, Motor 3 = Hot Water)

| L298N Pin | Connects To | Notes |
|-----------|------------|-------|
| +12V | 12 V PSU + | |
| GND | Common GND | |
| ENA | Leave jumper installed | |
| ENB | Leave jumper installed | |
| IN1 | ESP32 GPIO 32 | Tea direction A |
| IN2 | ESP32 GPIO 33 | Tea direction B |
| IN3 | ESP32 GPIO 16 | Hot Water direction A |
| IN4 | ESP32 GPIO 17 | Hot Water direction B |
| OUT1 + OUT2 | Tea peristaltic pump terminals | |
| OUT3 + OUT4 | Hot Water pump terminals | |

---

## DS18B20 Temperature Sensors (OneWire Bus)

All three sensors share a single OneWire bus on **GPIO 22**.  
Connect them in parallel (all VCC together, all GND together, all DATA together).

| Sensor Wire | Connects To |
|-------------|------------|
| Red (VCC) | ESP32 3.3 V |
| Black (GND) | Common GND |
| Yellow (DATA) | ESP32 GPIO 22 + 4.7 kΩ pull-up to 3.3 V |

```
ESP32 3.3V ──┬──[4.7kΩ]──┬── GPIO 22
             |             |
DS18B20 #0 VCC            DATA ─── (all sensor DATA wires joined here)
DS18B20 #1 VCC
DS18B20 #2 VCC

All DS18B20 GND → ESP32 GND
```

> Mount sensors **inside** the liquid containers, far from the heating element but below the min liquid level. Use stainless steel probes rated for submerged use.

---

## Solid State Relays (Heaters)

Each SSR has a DC control side (3–32 V) and an AC load side (24–480 V).

```
DC CONTROL SIDE:
  ESP32 GPIOxx ──[10kΩ]──► SSR pin (+)
  ESP32 GND ──────────────► SSR pin (-)

AC LOAD SIDE:
  Mains Live ──► Thermal fuse ──► SSR AC terminal 1
                                  SSR AC terminal 2 ──► Heater element one lead
  Heater element other lead ──► Mains Neutral
```

| SSR | GPIO | Heater | Thermal Fuse Rating |
|-----|------|--------|-------------------|
| SSR #1 | GPIO 18 | Water 500 W | 100 °C or 105 °C |
| SSR #2 | GPIO 19 | Milk 300 W | 70 °C or 77 °C |
| SSR #3 | GPIO 21 | Decoction 200 W | 40 °C or 45 °C |

**Mount each SSR on its heat sink.** Apply thermal paste between SSR and heat sink. SSRs must NOT be enclosed — they need airflow.

---

## Fill Solenoid Valve

The solenoid is 12 V and draws ~500 mA — too much for a GPIO pin to drive directly. Use a transistor or relay.

### Using NPN Transistor (recommended — simpler)

```
ESP32 GPIO 4 ──[1kΩ]──► BC547 / 2N2222 Base
12 V PSU (+) ─────────── Solenoid valve (+)
Solenoid valve (−) ────── Transistor Collector
Transistor Emitter ─────── GND
1N4007 diode ─── Cathode to 12V, Anode to Collector  (flyback protection)
```

### Using 5 V Relay Module

```
ESP32 GPIO 4 ──────────► Relay module IN
ESP32 5V ──────────────► Relay module VCC
ESP32 GND ─────────────► Relay module GND
Relay COM ─────────────► 12 V PSU (+)
Relay NO  ─────────────► Solenoid valve (+)
Solenoid valve (−) ────► GND
1N4007 diode across solenoid coil (Cathode to +, Anode to −)
```

---

## Water Level Float Switch

| Float Switch Wire | Connects To | Notes |
|------------------|------------|-------|
| Wire A | ESP32 GPIO 23 | |
| Wire B | GND | |

The firmware uses `INPUT_PULLUP` on GPIO 23. When the float rises (water present), the switch closes and pulls GPIO 23 to GND → reads `LOW` → water detected.

If your float switch is **Normally Open (NO)**: this wiring works as described.  
If your switch is **Normally Closed (NC)**: invert the logic in `config.h` by flipping the `waterLevelOK()` check.

---

## Buttons

All buttons are **active LOW** (press = connect to GND).  
GPIO 34–39 are input-only — **external 10 kΩ pull-up resistors are required**.

```
ESP32 3.3 V ──[10kΩ]──┬── GPIO 34  (BTN_MILK)
                        └── Button 1 ──── GND

(Same pattern for GPIO 35, 36, 39)
```

| Button | GPIO | Drink |
|--------|------|-------|
| Button 1 | GPIO 34 | Milk |
| Button 2 | GPIO 35 | Coffee Decoction |
| Button 3 | GPIO 36 | Tea Decoction |
| Button 4 | GPIO 39 | Hot Water |

---

## Buzzer

```
ESP32 GPIO 27 ──[330Ω]──► Buzzer + (longer lead)
GND ─────────────────────► Buzzer − (shorter lead)
```

---

## TFT Display (ILI9341 2.4" 240×320 SPI)

The display is driven via ESP32's VSPI bus in write-only mode (MISO not connected).  
**TFT_SCK (GPIO 14) is shared with L298N Coffee IN3** — safe because `TFT_CS` de-selects the display between SPI transactions, so the L298N never sees spurious clock pulses during coffee dispense.

```
TFT Pin     GPIO    Notes
─────────────────────────────────────────────────────────────
VCC(3.3V)   3.3V    Use 3.3V NOT 5V — ILI9341 is 3.3V logic
GND         GND
CS          GPIO 15  Chip select (active LOW)
RESET       GPIO 0   Software reset after boot; shares boot button
DC / RS     GPIO 12  Data/Command select. LOW=cmd, HIGH=data
MOSI / SDA  GPIO 13  SPI data from ESP32 to display
SCK / CLK   GPIO 14  SPI clock (shared with Coffee pump IN3 — see note)
LED / BL    ──────   Connect directly to 3.3V via 33Ω resistor
                     (always-on backlight; no GPIO needed)
MISO        ──────   Leave unconnected
```

**Physical connection:**

```
ESP32 3.3V ──[33Ω]──► TFT LED (backlight always on)
ESP32 3.3V ──────────► TFT VCC
ESP32 GND  ──────────► TFT GND
ESP32 GPIO15 ────────► TFT CS
ESP32 GPIO0  ────────► TFT RESET
ESP32 GPIO12 ────────► TFT DC
ESP32 GPIO13 ────────► TFT MOSI
ESP32 GPIO14 ────────► TFT SCK   (also wired to L298N #1 IN3 for Coffee pump)
```

> ⚠️ GPIO 0 also connects to the ESP32 onboard BOOT button. This is fine — the TFT reset pin is only pulsed in software after boot completes. During normal operation GPIO 0 can be driven as an output. Just ensure you don't hold GPIO 0 LOW while pressing RESET or you will enter download mode.

### What the display shows

| Area | Content |
|------|---------|
| Title bar (top) | "Lyra Coffee" |
| Rows 1–3 | Water / Milk / Decoction: current °C / target °C + coloured progress bar |
| Status section | Current state: Initialising / Heating / READY / Dispensing / Error |
| Bottom bar | Drink buttons: MILK B1 | COFFEE B2 | TEA B3 | HOT H2O B4 |

---

```
  [Milk Container] ─────► Pump 0 ─────► Dispense Nozzle 1
  [Coffee Decoction] ───► Pump 1 ─────► Dispense Nozzle 2
  [Tea Decoction] ──────► Pump 2 ─────► Dispense Nozzle 3
  [Hot Water Tank] ─────► Pump 3 ─────► Dispense Nozzle 4
                                                │
                                          [Drip Tray]
```

Keep tubing runs as short as possible.  
Use **food-grade silicone tubing** matched precisely to pump head dimensions (check pump datasheet for tubing OD/ID).  
Ensure tubing self-drains when the pump stops (gentle downward slope from source to nozzle).

---

## Grounding

- Connect ESP32 GND, L298N GND, SSR control (−), and 12 V PSU (−) to a **single common GND star point**.
- Connect metal enclosure to **mains Earth** (green/yellow wire).
- Do NOT connect mains Earth to the DC/ESP32 ground — they must be isolated.

---

## First-Power Checklist

- [ ] GFCI/RCD installed upstream of machine
- [ ] All mains connections (Live/Neutral/Earth) correctly made and insulated
- [ ] Thermal fuses installed in series with each heater
- [ ] SSRs mounted on heat sinks with thermal paste
- [ ] 12 V PSU polarity confirmed before connecting
- [ ] All DC GND connections at common star point
- [ ] DS18B20 sensors scanned (SCAN_SENSORS=1 run completed)
- [ ] Sensor addresses updated in config.h
- [ ] Float switch triggers correctly (tested by hand)
- [ ] Fill valve opens/closes on command via Serial '4' (or test GPIO 5 manually)
- [ ] All pump motor directions confirmed (forward = dispenses toward nozzle)
- [ ] Heater SSRs verified: GPIO HIGH → SSR LED on → heater warms up
