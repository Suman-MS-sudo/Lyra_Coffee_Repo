# Lyra Coffee Machine — Complete Build Guide

**Version:** 1.0  
**Platform:** ESP32 DevKit C V4  
**Framework:** Arduino (PlatformIO)  
**Display:** ILI9341 2.4" SPI 240×320  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [How It Works](#2-how-it-works)
3. [Complete Components List (BOM)](#3-complete-components-list-bom)
4. [GPIO Pin Assignment Table](#4-gpio-pin-assignment-table)
5. [Full Circuit Diagram](#5-full-circuit-diagram)
6. [Wiring Connection Tables](#6-wiring-connection-tables)
7. [Display Layout](#7-display-layout)
8. [Startup Sequence (Detailed)](#8-startup-sequence-detailed)
9. [Dispense Sequences](#9-dispense-sequences)
10. [Temperature Control System](#10-temperature-control-system)
11. [Software Setup](#11-software-setup)
12. [Mechanical Assembly](#12-mechanical-assembly)
13. [Testing Procedure](#13-testing-procedure)
14. [Safety Guidelines](#14-safety-guidelines)
15. [Troubleshooting](#15-troubleshooting)
16. [Adjusting Timings & Temperatures](#16-adjusting-timings--temperatures)

---

## 1. Project Overview

The Lyra Coffee Machine is an ESP32-controlled beverage vending machine that automatically prepares four drinks using peristaltic pumps and three independently heated chambers.

```
                    ┌─────────────────────────────────┐
                    │       LYRA COFFEE MACHINE        │
                    │                                  │
                    │  [WATER]  [MILK]  [COFFEE] [TEA] │
                    │  TANK     TANK    DECOCT   DECOCT│
                    │   80°C    60°C    30°C     30°C  │
                    │    ↓        ↓       ↓        ↓   │
                    │  Pump3   Pump0   Pump1    Pump2  │
                    │                                  │
           Buttons→ │  [B1]   [B2]   [B3]   [B4]      │
                    │  Milk  Coffee   Tea  Hot H2O     │
                    └─────────────────────────────────┘
                                    ↓
                               [Drip Tray]
```

### Drinks Menu

| Button | Drink | Pump | Sequence |
|--------|-------|------|----------|
| B1 | Milk Only | Pump 0 | Reverse 5s → Forward 7s → Reverse 5s |
| B2 | Coffee Decoction | Pump 1 | Reverse 5s → Forward 3s → Reverse 5s |
| B3 | Tea Decoction | Pump 2 | Reverse 5s → Forward 3s → Reverse 5s |
| B4 | Hot Water | Pump 3 | Forward 5s only |

---

## 2. How It Works

### System Architecture

```
ESP32 DevKit C V4 (Brain)
  │
  ├── L298N #1 ──► Pump 0 (Milk), Pump 1 (Coffee)
  ├── L298N #2 ──► Pump 2 (Tea),  Pump 3 (Hot Water)
  ├── SSR #1  ──► Water Heater 500W  (80°C target)
  ├── SSR #2  ──► Milk Heater  300W  (60°C target)
  ├── SSR #3  ──► Decoct Heater 200W (30°C target)
  ├── DS18B20 ×3 ── Temperature sensors (OneWire)
  ├── Float Switch ── Water level detection
  ├── Solenoid Valve ── Auto water fill
  ├── ILI9341 TFT ── 2.4" status display
  ├── Buzzer ── Audio feedback
  └── 4× Buttons ── Drink selection
```

### Pump Direction Convention

Peristaltic pumps reverse direction by flipping the L298N H-bridge polarity.

| IN1 | IN2 | Motor Action |
|-----|-----|-------------|
| HIGH | LOW | Forward (dispense toward nozzle) |
| LOW | HIGH | Reverse (suck back / prime) |
| LOW | LOW | Stop |

---

## 3. Complete Components List (BOM)

### A) Core Electronics

| # | Component | Specification | Qty | Est. Cost |
|---|-----------|-------------|-----|-----------|
| 1 | ESP32 DevKit C V4 | ESP32-WROOM-32, 38-pin, USB-C or micro-USB | 1 | $7–10 |
| 2 | L298N Dual H-Bridge Motor Driver | 12V, 2A per channel, onboard 5V regulator | 2 | $3–5 ea |
| 3 | 12V DC Peristaltic Pump (food-grade) | 100–300 mL/min, self-priming, silicone tubing | 4 | $8–15 ea |
| 4 | DS18B20 Waterproof Temp Probe | Stainless steel probe, 1m cable, pre-wired | 3 | $3–5 ea |
| 5 | Solid State Relay SSR-40DA | 3–32V DC in, 24–480V AC out, 40A | 3 | $4–8 ea |
| 6 | Aluminium Heat Sink for SSR-40DA | Rated for 40A SSR — mandatory | 3 | $2–4 ea |
| 7 | Heating Element — Water | 220V 500W immersion/cartridge heater | 1 | $8–15 |
| 8 | Heating Element — Milk | 220V 300W immersion/cartridge heater | 1 | $6–12 |
| 9 | Heating Element — Decoction | 220V 200W immersion/cartridge heater | 1 | $5–10 |
| 10 | Thermal Fuse | 100°C (water), 70°C (milk), 45°C (decoction) | 3 | $0.50 ea |
| 11 | Float Switch (NO type) | 12V rated, normally-open | 1 | $2–4 |
| 12 | 12V Solenoid Valve NC (food-safe) | Normally Closed = fail-safe when unpowered | 1 | $7–12 |
| 13 | 12V 5A DC Power Supply | Powers all 12V components | 1 | $10–15 |
| 14 | ILI9341 2.4" SPI TFT Display | 240×320 pixels, 3.3V logic | 1 | $6–10 |
| 15 | Passive Buzzer 5V | 3–5V tone buzzer | 1 | $0.50 |
| 16 | Momentary Push Button 12mm | Panel-mount, momentary tactile | 4 | $0.50 ea |
| 17 | NPN Transistor BC547 or 2N2222 | General purpose NPN | 1 | $0.20 |

### B) Passive Components

| Component | Value | Purpose | Qty |
|-----------|-------|---------|-----|
| Resistor | 4.7 kΩ 1/4W | DS18B20 OneWire DATA line pull-up | 1 |
| Resistor | 10 kΩ 1/4W | Button pull-up ×4 (GPIO 34/35/36/39) | 4 |
| Resistor | 10 kΩ 1/4W | SSR input series protection ×3 | 3 |
| Resistor | 1 kΩ 1/4W | Transistor base resistor (fill valve) | 1 |
| Resistor | 330 Ω 1/4W | Buzzer series current limiter | 1 |
| Resistor | 33 Ω 1/4W | TFT backlight LED current limiter | 1 |
| Diode | 1N4007 | Flyback protection across solenoid coil | 1 |
| Capacitor | 100 µF 25V electrolytic | Bulk decoupling on 12V supply rail | 2 |
| Capacitor | 100 nF ceramic | Bypass near ESP32 3.3V | 4 |
| Screw terminal blocks | 2-pin 5mm pitch | All wire terminations | 14+ |
| Prototype PCB / perfboard | ≥ 10×10 cm | Mount ESP32, resistors, breakouts | 1 |
| JST-XH 2/3-pin connectors | — | Pump motor quick-disconnect | 8 |
| DuPont jumper wires | M-F, F-F | Connecting ESP32 to modules | 1 set |
| Heat-shrink tubing | Assorted 2–6mm | Insulate all solder joints | 1 pack |
| Cable ties | 100mm and 200mm | Cable management inside enclosure | 1 pack |

### C) Mechanical / Enclosure

| Component | Specification | Qty |
|-----------|-------------|-----|
| Metal enclosure | Min. 220×180×100mm, IP54 or better | 1 |
| Food-grade silicone tubing | 3–4mm ID, 6mm OD — buy ~12 m total | 12 m |
| Liquid containers / chambers | Stainless steel or food-safe plastic | 3 |
| Pump mounting brackets | 3D-print or metal bracket | 4 |
| Stainless steel drip tray | Under dispense nozzles | 1 |
| M3 stainless bolts, nuts, standoffs | PCB and bracket mounting | 1 pack |
| Quick-connect fittings | Match tubing OD for container inlets | 8 |

### D) Safety / Mains Electrical

> ⚠️ These components are MANDATORY. Do not skip any of them.

| Component | Specification | Qty |
|-----------|-------------|-----|
| GFCI / RCD 30mA circuit breaker | Protects against electric shock | 1 |
| Mains panel switch | SPST, 10A 250V, panel-mount | 1 |
| IEC C14 mains inlet | With integrated fuse holder | 1 |
| 5A slow-blow fuse | Machine inlet protection | 2 (1 spare) |
| 3-core mains cable | 1.5mm² minimum, L/N/E | 1.5 m |
| Cable glands | For mains cable entry into enclosure | 2 |
| Warning label | "230V inside — unplug before opening" | 1 |

### E) Budget Summary

| Category | Estimated Cost (USD) |
|----------|---------------------|
| Core electronics | $60–100 |
| Heaters + SSRs + heat sinks | $30–60 |
| Pumps ×4 | $32–60 |
| Display | $6–10 |
| Enclosure + mechanical | $20–40 |
| Safety/mains components | $15–25 |
| Passives, wire, misc | $10–20 |
| **TOTAL** | **~$173–315 USD** |

---

## 4. GPIO Pin Assignment Table

**Board:** ESP32 DevKit C V4 (ESP32-WROOM-32, 38-pin)

| GPIO | I/O | Connected To | Notes |
|------|-----|-------------|-------|
| 2 | OUT | L298N #1 IN4 — Coffee pump direction B | Moved from GPIO13 to free SPI MOSI |
| 4 | OUT | Fill valve transistor base [via 1kΩ] | Safe at boot — stays LOW. GPIO5 avoided (HIGH at boot) |
| 12 | OUT | TFT DC (Data/Command) | LOW=command; LOW at boot is safe (display in reset) |
| 13 | OUT | TFT MOSI | SPI data line |
| 14 | OUT | TFT SCK + L298N #1 IN3 Coffee pump A | Shared; TFT_CS deselects display when coffee pump runs |
| 15 | OUT | TFT CS (chip select) | Active LOW. HIGH at boot = deselected = safe |
| 0 | OUT | TFT RST | Shared with BOOT button. Pulsed after boot only |
| 16 | OUT | L298N #2 IN3 — Hot Water pump direction A | |
| 17 | OUT | L298N #2 IN4 — Hot Water pump direction B | |
| 18 | OUT | SSR #1 (+) [via 10kΩ] — Water heater | |
| 19 | OUT | SSR #2 (+) [via 10kΩ] — Milk heater | |
| 21 | OUT | SSR #3 (+) [via 10kΩ] — Decoction heater | |
| 22 | INOUT | DS18B20 DATA bus (all 3 sensors) | 4.7kΩ pull-up to 3.3V |
| 23 | IN | Float switch Wire A | INPUT_PULLUP. LOW=water present, HIGH=empty |
| 25 | OUT | L298N #1 IN1 — Milk pump direction A | |
| 26 | OUT | L298N #1 IN2 — Milk pump direction B | |
| 27 | OUT | Buzzer (+) [via 330Ω] | |
| 32 | OUT | L298N #2 IN1 — Tea pump direction A | |
| 33 | OUT | L298N #2 IN2 — Tea pump direction B | |
| 34 | IN | Button 1 — Milk | INPUT ONLY. Needs 10kΩ external pull-up |
| 35 | IN | Button 2 — Coffee | INPUT ONLY. Needs 10kΩ external pull-up |
| 36 | IN | Button 3 — Tea | INPUT ONLY. Needs 10kΩ external pull-up |
| 39 | IN | Button 4 — Hot Water | INPUT ONLY. Needs 10kΩ external pull-up |
| 3V3 | PWR | DS18B20 VCC ×3, TFT VCC, pull-up refs | |
| GND | GND | All module grounds → common star point | |

> **Avoid completely:** GPIO 5 (HIGH at boot), GPIO 6–11 (internal flash), GPIO 1/3 (UART0), GPIO 12 (boot LOW strapping — used only for TFT DC, safe because display ignores commands during reset).

---

## 5. Full Circuit Diagram

### 5.1 System Overview

```
══════════════════════════════════════════════════════════════
  230V AC MAINS SIDE
══════════════════════════════════════════════════════════════

  [Wall Outlet 230V L/N/E]
          │
  [GFCI/RCD 30mA]  ← Electric shock protection — MANDATORY
          │
  [IEC C14 Inlet + 5A Slow-blow Fuse]
          │
  [Panel Power Switch]
          │
          ├──[Thermal Fuse 100°C]──►[SSR#1 AC]──► Water Heater 500W ──► Neutral
          ├──[Thermal Fuse  70°C]──►[SSR#2 AC]──► Milk  Heater 300W ──► Neutral
          └──[Thermal Fuse  45°C]──►[SSR#3 AC]──► Decoct Heater200W ──► Neutral

  Mains Earth ──► Metal enclosure chassis (mandatory grounding)

══════════════════════════════════════════════════════════════
  12V DC SIDE
══════════════════════════════════════════════════════════════

  12V 5A PSU
   (+)─────┬────────── L298N #1  +12V
           ├────────── L298N #2  +12V
           ├────────── Solenoid Valve (+) via BC547 transistor
           └──[100µF cap]── GND
   (-)──────────────── ★ GND STAR POINT ★

══════════════════════════════════════════════════════════════
  3.3V SIDE (from ESP32)
══════════════════════════════════════════════════════════════

  ESP32 3V3
   ├──► DS18B20 #0 VCC  (Water container sensor)
   ├──► DS18B20 #1 VCC  (Milk container sensor)
   ├──► DS18B20 #2 VCC  (Decoction container sensor)
   ├──[4.7kΩ]──► GPIO22 (OneWire pull-up)
   ├──[10kΩ]───► GPIO34 (Button 1 pull-up)
   ├──[10kΩ]───► GPIO35 (Button 2 pull-up)
   ├──[10kΩ]───► GPIO36 (Button 3 pull-up)
   ├──[10kΩ]───► GPIO39 (Button 4 pull-up)
   ├──► TFT VCC
   └──[33Ω]────► TFT LED (backlight)
```

### 5.2 L298N Motor Driver #1 (Milk + Coffee)

```
  12V PSU (+) ────────── L298N #1  +12V
  GND Star    ────────── L298N #1  GND
              [ENA jumper: INSTALL]  [ENB jumper: INSTALL]

  GPIO25 ──────────────── IN1 ──┐
  GPIO26 ──────────────── IN2 ──┤──► OUT1/OUT2 ──► Milk Pump  terminals
  
  GPIO14 ──────────────── IN3 ──┐  (also TFT SCK — shared, safe)
  GPIO2  ──────────────── IN4 ──┤──► OUT3/OUT4 ──► Coffee Pump terminals
```

### 5.3 L298N Motor Driver #2 (Tea + Hot Water)

```
  12V PSU (+) ────────── L298N #2  +12V
  GND Star    ────────── L298N #2  GND
              [ENA jumper: INSTALL]  [ENB jumper: INSTALL]

  GPIO32 ──────────────── IN1 ──┐
  GPIO33 ──────────────── IN2 ──┤──► OUT1/OUT2 ──► Tea Pump      terminals
  
  GPIO16 ──────────────── IN3 ──┐
  GPIO17 ──────────────── IN4 ──┤──► OUT3/OUT4 ──► Hot Water Pump terminals
```

### 5.4 Solid State Relays (×3, identical)

```
  DC control side:
    ESP32 GPIO18 ──[10kΩ]──► SSR#1 (+)    SSR#1 (−) ──► GND Star
    ESP32 GPIO19 ──[10kΩ]──► SSR#2 (+)    SSR#2 (−) ──► GND Star
    ESP32 GPIO21 ──[10kΩ]──► SSR#3 (+)    SSR#3 (−) ──► GND Star

  AC load side:
    Mains Live ──[Thermal Fuse 100°C]──► SSR#1 AC-IN
                                         SSR#1 AC-OUT ──► Water Heater ──► Neutral

    Mains Live ──[Thermal Fuse  70°C]──► SSR#2 AC-IN
                                         SSR#2 AC-OUT ──► Milk Heater  ──► Neutral

    Mains Live ──[Thermal Fuse  45°C]──► SSR#3 AC-IN
                                         SSR#3 AC-OUT ──► Decoct Heater ──► Neutral

  Mount each SSR flat on aluminium heat sink with thermal paste.
  SSRs need airflow — do NOT enclose them in a sealed box.
```

### 5.5 DS18B20 Temperature Sensors (OneWire bus)

```
  ESP32 3V3 ──┬──[4.7kΩ]──┬──── ESP32 GPIO22
              │             │
              │   ┌─────────┤ (all DATA wires joined at GPIO22)
              │   │         │
           VCC│  DATA  DS18B20 #0  (Water container — target 80°C)
           VCC│  DATA  DS18B20 #1  (Milk container   — target 60°C)
           VCC│  DATA  DS18B20 #2  (Decoction         — target 30°C)
              │
  All VCC ──► ESP32 3V3
  All GND ──► GND Star

  Sensor mounting:
    #0 → Submerged in water tank, away from heater element
    #1 → Submerged in milk container, away from heater element
    #2 → Submerged in decoction container, away from heater element
```

### 5.6 Fill Solenoid Valve (NPN Transistor Driver)

```
  ESP32 GPIO4 ──[1kΩ]──► BC547 Base
                          BC547 Emitter ──────────────────► GND Star
                          BC547 Collector ──► Solenoid (−)
  12V PSU (+) ─────────────────────────► Solenoid (+)
  
  1N4007 diode: Anode ──► BC547 Collector
                Cathode ──► 12V line
  (flyback diode — MANDATORY to prevent transistor damage)

  Valve is Normally Closed:
    GPIO4 LOW  = transistor OFF = valve CLOSED  (safe default, fail-safe)
    GPIO4 HIGH = transistor ON  = valve OPEN    (fills water tank)
```

### 5.7 Water Level Float Switch

```
  ESP32 GPIO23 ──── Float Switch terminal A
  GND Star     ──── Float Switch terminal B

  GPIO23 configured as INPUT_PULLUP:
    Internal pull-up holds GPIO23 HIGH when switch is open (tank empty)
    When float rises (tank full), switch closes → GPIO23 pulled to GND → LOW

  Firmware: LOW = water OK,  HIGH = no water / refill needed
```

### 5.8 Drink Select Buttons (×4)

```
  3.3V ──[10kΩ]──┬── GPIO34  ← B1 Milk
                  └── Button1 one terminal ──► GND

  3.3V ──[10kΩ]──┬── GPIO35  ← B2 Coffee
                  └── Button2 one terminal ──► GND

  3.3V ──[10kΩ]──┬── GPIO36  ← B3 Tea
                  └── Button3 one terminal ──► GND

  3.3V ──[10kΩ]──┬── GPIO39  ← B4 Hot Water
                  └── Button4 one terminal ──► GND

  Active LOW: button pressed = GPIO reads LOW.
  GPIO 34–39 are INPUT-ONLY on ESP32 — external pull-ups are required.
```

### 5.9 Buzzer

```
  GPIO27 ──[330Ω]──► Buzzer (+) (longer lead)
  GND Star  ────────► Buzzer (−) (shorter lead)
```

### 5.10 ILI9341 2.4" SPI TFT Display

```
  TFT Pin   ──► Connection
  ─────────────────────────────────────────────────────
  VCC        ──► ESP32 3V3
  GND        ──► GND Star
  CS         ──► GPIO15  (active LOW chip select)
  RESET      ──► GPIO0   (LOW pulse resets display; after boot only)
  DC / RS    ──► GPIO12  (LOW=command, HIGH=data)
  SDI/MOSI   ──► GPIO13  (SPI data from ESP32)
  SCK        ──► GPIO14  (SPI clock — also Coffee pump IN3, safe)
  LED        ──[33Ω]──► ESP32 3V3  (always-on backlight)
  SDO/MISO   ──  Leave unconnected (display is write-only)
```

### 5.11 Hot Water to Decoction Container Plumbing

```
  Water Tank ──► Pump 3 (Motor 3, Hot Water pump)
                    │
                    └──► Y-pipe splitter
                              │
                    ┌─────────┴────────┐
                    ↓                  ↓
            Coffee Decoction    Tea Decoction
            Container inlet     Container inlet

  At startup (Phase 2), Pump 3 runs for 8 seconds per container,
  pushing 80°C water from the water tank into both decoction containers.
  This pre-heats and hydrates the decoction before the decoction heater starts.

  If no Y-pipe: connect Pump 3 to a 2-position manual valve.
  Run Coffee fill, switch valve, run Tea fill.
  (The firmware fills Coffee first, then Tea, sequentially.)
```

---

## 6. Wiring Connection Tables

### L298N #1 Complete Pin Table

| L298N #1 Pin | Wire To | Notes |
|-------------|---------|-------|
| +12V | 12V PSU (+) | Motor supply |
| GND | GND Star | Common ground |
| +5V (out) | Optional → ESP32 5V | Onboard 7805, max 1A |
| ENA | Jumper installed | Always enabled |
| ENB | Jumper installed | Always enabled |
| IN1 | GPIO 25 | Milk pump direction A |
| IN2 | GPIO 26 | Milk pump direction B |
| IN3 | GPIO 14 | Coffee pump direction A (shared with TFT SCK) |
| IN4 | GPIO 2 | Coffee pump direction B |
| OUT1 | Milk pump wire (+) | |
| OUT2 | Milk pump wire (−) | |
| OUT3 | Coffee pump wire (+) | |
| OUT4 | Coffee pump wire (−) | |

### L298N #2 Complete Pin Table

| L298N #2 Pin | Wire To | Notes |
|-------------|---------|-------|
| +12V | 12V PSU (+) | |
| GND | GND Star | |
| ENA | Jumper installed | |
| ENB | Jumper installed | |
| IN1 | GPIO 32 | Tea pump direction A |
| IN2 | GPIO 33 | Tea pump direction B |
| IN3 | GPIO 16 | Hot Water pump direction A |
| IN4 | GPIO 17 | Hot Water pump direction B |
| OUT1 | Tea pump wire (+) | |
| OUT2 | Tea pump wire (−) | |
| OUT3 | Hot Water pump wire (+) | |
| OUT4 | Hot Water pump wire (−) | |

### SSR Pin Table (each of the 3 modules)

| SSR Pin | Wire To |
|---------|---------|
| DC+ (control) | GPIO via 10kΩ resistor |
| DC− (control) | GND Star |
| AC1 (load) | Mains Live via thermal fuse |
| AC2 (load) | Heater element lead |
| Heater other lead | Mains Neutral |
| SSR body | Aluminium heat sink (with thermal paste) |

### TFT Display Pin Table

| TFT Board Pin | Wire To | Notes |
|-------------|---------|-------|
| VCC | ESP32 3V3 | 3.3V only — NOT 5V |
| GND | GND Star | |
| CS | GPIO 15 | |
| RESET | GPIO 0 | |
| DC/RS | GPIO 12 | |
| SDI (MOSI) | GPIO 13 | |
| SCK | GPIO 14 | Shared with Coffee IN3 |
| LED | 3.3V via 33Ω | |
| SDO (MISO) | Not connected | |

---

## 7. Display Layout

```
╔══════════════════════════╗  ← y=0
║  ▓  Lyra Coffee  ▓▓▓▓▓  ║  Title bar (navy background, cyan text)
╠══════════════════════════╣  ← y=28
║ WATER                    ║  ← y=38 label (grey)
║ 79.8 / 80 C  █████████░ ║  ← y=50 temperature + progress bar
║                          ║
║ MILK                     ║  ← y=78 label
║ 58.7 / 60 C  ████████░░ ║  ← y=90 temperature + progress bar
║                          ║
║ DECOCTION                ║  ← y=118 label
║ 29.2 / 30 C  █████████  ║  ← y=130 temperature + progress bar
╠ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ╣  ← y=155
║ STATUS                   ║  ← y=162 label
║ READY            (green) ║  ← y=180 large status text
║ Select a drink           ║  ← y=204 sub-text
╠ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ╣  ← y=250
║ [MILK][COFFEE][TEA ][HW] ║  ← button guide
║   B1    B2     B3   B4   ║
╚══════════════════════════╝  ← y=320
```

**Status text colours:**

| State | Text | Colour |
|-------|------|--------|
| Initialising | Initialising | Yellow |
| Heating water | Heating Water | Yellow |
| Filling decoction | Filling Coffee/Tea | Sky Blue |
| Heating milk/decoction | Heating Milk / Decoct | Yellow |
| Ready | READY | Green |
| Dispensing | Drink name + phase | Cyan / Yellow |
| Error | NO WATER / Error | Red |

---

## 8. Startup Sequence (Detailed)

```
 POWER ON
    │
    ├─ TFT initialises: draws title bar, temp rows, menu bar
    ├─ TFT: "Initialising / Please wait..."
    │
    ▼
 ┌─── S_CHECK_WATER ───────────────────────────────────────────┐
 │  Read GPIO23 (float switch)                                  │
 │    Float switch HIGH (open) = no water → ERROR beep          │
 │    → TFT: "NO WATER / Refill reservoir!"                     │
 │    → Wait 10 s → retry (loop until water detected)           │
 │    Float switch LOW (closed) = water present → proceed       │
 └──────────────────────────────────────────────────────────────┘
    │ water OK
    ▼
 ┌─── S_FILLING ────────────────────────────────────────────────┐
 │  TFT: "Filling / water tank..."                               │
 │  GPIO4 HIGH → opens solenoid valve                           │
 │  Wait until GPIO23 goes LOW (float switch triggers)          │
 │  GPIO4 LOW  → closes solenoid valve                          │
 │  Wait FILL_SETTLE_MS (2 s) for liquid to settle              │
 │  Timeout 30 s → S_ERROR_FILL (restart after 30 s)            │
 └──────────────────────────────────────────────────────────────┘
    │ filled OK
    ▼
 ┌─── S_HEAT_WATER (Phase 1) ───────────────────────────────────┐
 │  TFT: "Heating Water / Target: 80C"                           │
 │  GPIO18 HIGH → Water heater SSR ON                           │
 │  Poll DS18B20 #0 every 2 s                                    │
 │  TFT temperature row updates live                             │
 │  Wait until Water temp ≥ 78.5°C (80°C − 1.5°C hysteresis)    │
 └──────────────────────────────────────────────────────────────┘
    │ water at 80°C
    ▼
 ┌─── S_FILL_DECOCTIONS (Phase 2) ──────────────────────────────┐
 │  PURPOSE: Pre-fill decoction containers with hot water        │
 │  so decoctions are hydrated before their heaters start.       │
 │                                                               │
 │  Step A — Coffee container fill:                              │
 │    TFT: "Filling Coffee / Decoction..."                       │
 │    Motor 3 FORWARD for FILL_COFFEE_HOT_MS (8 s)              │
 │    Hot water flows: Tank → Pump3 → Y-pipe → Coffee container  │
 │    Water heater continues to regulate during fill             │
 │                                                               │
 │  Brief pause (500 ms)                                         │
 │                                                               │
 │  Step B — Tea container fill:                                 │
 │    TFT: "Filling Tea / Decoction..."                          │
 │    Motor 3 FORWARD for FILL_TEA_HOT_MS (8 s)                 │
 │    Hot water flows: Tank → Pump3 → Y-pipe → Tea container     │
 └──────────────────────────────────────────────────────────────┘
    │ both containers filled with hot water
    ▼
 ┌─── S_HEAT_MILK_DECOCT (Phase 3) ─────────────────────────────┐
 │  Step A — Milk heater:                                        │
 │    700 ms stagger delay                                        │
 │    TFT: "Heating Milk / Target: 60C"                          │
 │    GPIO19 HIGH → Milk heater SSR ON                           │
 │    Wait until Milk temp ≥ 58.5°C                              │
 │    (Water heater kept regulated during this wait)             │
 │                                                               │
 │  Step B — Decoction heater:                                   │
 │    700 ms stagger delay                                        │
 │    TFT: "Heating Decoct / Target: 30C"                        │
 │    GPIO21 HIGH → Decoction heater SSR ON                      │
 │    Wait until Decoct temp ≥ 28.5°C                            │
 │    (Water + Milk heaters kept regulated during this wait)     │
 └──────────────────────────────────────────────────────────────┘
    │ all chambers at target
    ▼
 ┌─── S_READY ──────────────────────────────────────────────────┐
 │  Triple ascending beep                                        │
 │  TFT: "READY / Select a drink"                                │
 │  Every 2 s: re-read all 3 DS18B20 sensors                     │
 │             regulate all 3 heaters (bang-bang ±1.5°C)         │
 │             update all 3 TFT temperature rows                 │
 │  Poll buttons GPIO34/35/36/39 every 50 ms                     │
 │  Serial commands: 1/2/3/4 dispense, t=temps, r=restart        │
 └──────────────────────────────────────────────────────────────┘
```

---

## 9. Dispense Sequences

### Milk / Coffee Decoction / Tea Decoction (Pumps 0–2)

```
  Button press detected
       │
       ├─ TFT: "<Drink Name> / Priming..."
       ├─ Beep
       │
       ▼
  ┌── PHASE 1: PRIME (5 seconds) ─────────────────────────┐
  │  Motor REVERSE for PRIME_MS (5000 ms)                  │
  │  Sucks liquid back slightly to clear air from line.    │
  │  Prevents a stale / air-burst first drop.              │
  └────────────────────────────────────────────────────────┘
       │
       ▼
  ┌── PHASE 2: DISPENSE (3–7 seconds) ────────────────────┐
  │  Motor FORWARD for DISP_xxx_MS                         │
  │    Milk:   7000 ms  (7 s)                              │
  │    Coffee: 3000 ms  (3 s)                              │
  │    Tea:    3000 ms  (3 s)                              │
  │  Liquid flows from container → pump → nozzle → cup     │
  └────────────────────────────────────────────────────────┘
       │
       ▼
  ┌── PHASE 3: PURGE / ANTI-DRIP (5 seconds) ─────────────┐
  │  Motor REVERSE for PURGE_MS (5000 ms)                  │
  │  Sucks liquid back from nozzle into the tube.          │
  │  Prevents post-dispense dripping.                       │
  └────────────────────────────────────────────────────────┘
       │
       └─ Motor stopped → TFT: "READY / Select a drink"
```

### Hot Water (Pump 3)

```
  Button 4 pressed
    → Beep → Motor 3 forward 5 s → Motor stop → READY
  (No prime or purge — water doesn't drip significantly)
```

---

## 10. Temperature Control System

### Operating Targets

| Chamber | Sensor Index | GPIO | Heater Power | Target | Thermal Fuse |
|---------|-------------|------|-------------|--------|-------------|
| Water | 0 | 18 (SSR#1) | 500W | 80°C | 100°C |
| Milk | 1 | 19 (SSR#2) | 300W | 60°C | 70°C |
| Decoction | 2 | 21 (SSR#3) | 200W | 30°C | 45°C |

### Bang-Bang Control with Hysteresis

```
  Heater turns ON when:  temp < (target − 1.5°C)
  Heater turns OFF when: temp > (target + 1.5°C)

  Example — Water (target 80°C):
    Heater ON  when temp falls below 78.5°C
    Heater OFF when temp rises above 81.5°C
    Steady-state oscillation: 78.5–81.5°C band
```

### Thermal Runaway Protection

```
  If any sensor reads (target + 5.0°C) or more:
    → ALL three heaters immediately cut OFF
    → Serial: "[!!! SAFETY] THERMAL RUNAWAY — all heaters OFF."
    → Machine stays in READY state but heaters won't turn back on
      until ESP32 is restarted
  
  This protects against:
    - Sensor disconnect (DS18B20 returns -127°C — checked separately)
    - Heater element stuck ON (SSR welded closed)
    - Runaway due to software bug
```

### DS18B20 Sensor Discovery

Before first use, identify each sensor's unique ROM address:

1. Set `#define SCAN_SENSORS 1` in `include/config.h`
2. Flash firmware: `pio run --target upload`
3. Open serial monitor at 115200 baud
4. Note down the 3 printed addresses
5. Copy each address to `config.h`:

```c
#define SENSOR_WATER_ADDR   { 0x28, 0xFF, ... }  // sensor in water tank
#define SENSOR_MILK_ADDR    { 0x28, 0xFF, ... }  // sensor in milk container
#define SENSOR_DECOCT_ADDR  { 0x28, 0xFF, ... }  // sensor in decoction container
```

6. Set `#define SCAN_SENSORS 0` and reflash

---

## 11. Software Setup

### Prerequisites

1. Install [VS Code](https://code.visualstudio.com/)
2. Install [PlatformIO IDE extension](https://platformio.org/install/ide?install=vscode)
3. Open the `Lyra Coffee Machine` folder in VS Code

### Project Files

```
Lyra Coffee Machine/
├── platformio.ini          ← Build config (board, libraries, TFT flags)
├── include/
│   └── config.h            ← ALL pin & timing constants — edit here
├── src/
│   └── main.cpp            ← Firmware state machine
├── docs/
│   ├── COMPLETE_BUILD_GUIDE.md   ← This document
│   ├── components_list.md
│   ├── wiring_diagram.md
│   └── generate_pdf.ps1    ← PDF export script
└── README.md
```

### Build and Flash

```powershell
# Build only
pio run

# Build and flash
pio run --target upload

# Monitor serial output
pio device monitor

# Build + flash + monitor in one
pio run --target upload ; pio device monitor
```

### Serial Commands (115200 baud, during READY state)

| Command | Action |
|---------|--------|
| `1` | Dispense Milk |
| `2` | Dispense Coffee Decoction |
| `3` | Dispense Tea Decoction |
| `4` | Dispense Hot Water |
| `t` | Print all 3 temperatures to serial |
| `r` | Restart ESP32 |

### Library Dependencies (auto-installed by PlatformIO)

| Library | Version | Purpose |
|---------|---------|---------|
| `paulstoffregen/OneWire` | ^2.3.7 | DS18B20 communication |
| `milesburton/DallasTemperature` | ^3.11.0 | DS18B20 temperature reading |
| `bodmer/TFT_eSPI` | ^2.5.43 | ILI9341 TFT display driver |

---

## 12. Mechanical Assembly

### Step-by-Step Assembly Order

**Step 1 — Prepare containers**
- Drill inlet/outlet holes in each container matching tubing OD
- Install food-safe bulkhead fittings
- Mount heating element inside each container (bottom area, not touching walls)
- Mount DS18B20 sensor probe inside each container (away from heater, below minimum liquid level)
- Install thermal fuse physically against or near the heater element

**Step 2 — Mount pumps**
- Attach pump mounting brackets to enclosure floor or side wall
- Install all 4 peristaltic pumps; label each (Milk, Coffee, Tea, HotWater)
- Connect silicone tubing: container outlet → pump inlet, pump outlet → dispense nozzle or decoction container inlet

**Step 3 — Hot water plumbing (critical)**
```
  Water Tank → Pump 3 (Hot Water Motor) → Y-pipe splitter
                                              ├── Branch A → Coffee Decoction container
                                              └── Branch B → Tea Decoction container
  
  ALSO connect:
  Water Tank → Pump 3 → Hot Water nozzle (Button 4 dispense)
  
  Note: Pump 3 is used for both startup filling (branches to decoctions)
  and normal hot water dispense (to nozzle). Use a 3-way fitting or
  a check-valve arrangement to direct flow appropriately.
  
  Simplest approach: use a manual 3-way valve and set it to
  "decoction fill" mode before first startup, then switch to
  "nozzle" mode for normal operation.
```

**Step 4 — Electrical — Low voltage (12V/3.3V) first**
- Build the ESP32 circuit on perfboard
- Wire all L298N modules
- Wire all buttons with pull-up resistors
- Wire DS18B20 sensors on OneWire bus
- Wire TFT display
- Wire buzzer
- Wire fill valve transistor circuit
- Connect 12V PSU

**Step 5 — Test low-voltage circuits BEFORE mains wiring**
- Flash firmware with `SCAN_SENSORS=1` to confirm DS18B20s are found
- Test all 4 buttons via serial monitor
- Test all 4 pumps via serial commands `1`/`2`/`3`/`4`
- Verify TFT shows "Initialising" on boot
- Test fill valve opens/closes with GPIO4

**Step 6 — Electrical — Mains wiring**
- Wire GFCI/RCD breaker
- Wire IEC C14 inlet and fuse
- Wire panel switch
- Wire thermal fuses to heater elements
- Wire SSR AC sides to heaters
- Wire SSR DC sides to ESP32
- Earth chassis
- Double-check all mains connections — have a qualified electrician review if unsure

**Step 7 — Integration test**
- Power on machine
- Observe TFT startup sequence
- Confirm water fill happens
- Observe temperature rising on display
- Confirm startup fills decoction containers with hot water
- Test all 4 drink buttons

---

## 13. Testing Procedure

### Pre-Power Tests (multimeter checks)

| Test | Expected | Pass Criteria |
|------|----------|--------------|
| 12V PSU polarity | (+) = Red terminal | 12.0–12.5V |
| Mains L-to-N voltage | 230V AC | 220–240V |
| Fuse continuity | Through fuse | 0Ω |
| Heater element resistance | Water 500W | ~97Ω |
| Thermal fuse continuity | Before tripping | 0Ω |
| Chassis to mains Earth | 0Ω | < 1Ω |
| RCD test button | Trips RCD | Trips immediately |

### Firmware Tests (serial monitor)

```
Command '1' → Milk pump:    reverses 5s, forwards 7s, reverses 5s
Command '2' → Coffee pump:  reverses 5s, forwards 3s, reverses 5s
Command '3' → Tea pump:     reverses 5s, forwards 3s, reverses 5s
Command '4' → Hot Water:    forwards 5s only
Command 't' → Shows all 3 temperatures
```

### Full Startup Test

1. Fill water tank manually
2. Power on machine
3. Watch serial output and TFT
4. Confirm TFT progresses through:
   - "Initialising" → "Filling water tank" → "Heating Water" → "Filling Coffee Decoction" → "Filling Tea Decoction" → "Heating Milk" → "Heating Decoct" → "**READY**"
5. Place cups under nozzles
6. Press each button in turn — confirm correct pump runs correct sequence

---

## 14. Safety Guidelines

> **⚠️ This project involves 230V AC mains electricity and hot liquids up to 80°C. Non-compliance with safety requirements can cause fire, electrocution, or burns.**

### Mandatory Safety Requirements

1. **GFCI/RCD 30mA** — Install upstream of the machine. This is non-negotiable. It is the primary protection against fatal electric shock.

2. **Thermal fuses** — Install one in series with EACH heater element. These are one-shot hardware protection against heater runaway if the software fails.

3. **SSR heat sinks** — Each SSR generates ~1W per amp of load. Without heat sinks they will overheat and fail, possibly welding closed and leaving the heater permanently ON.

4. **Earthing/Grounding** — Connect the metal chassis to mains Earth. This ensures a fuse blows (not a person) if a live wire touches the chassis.

5. **Flyback diode** — The 1N4007 across the solenoid valve coil is mandatory. Without it, transistor turn-off generates a voltage spike that will destroy the BC547.

6. **Physical separation** — Keep 230V wiring and 12V/3.3V wiring on opposite sides of the enclosure. Use cable clamps to prevent mains wires from moving and potentially touching low-voltage circuitry.

7. **Fuse sizing** — Use the specified 5A slow-blow fuse. Do not substitute a higher-rated fuse; it defeats the purpose.

8. **Food safety** — Use only food-grade silicone tubing, food-safe container materials (stainless steel or BPA-free plastic), and food-grade lubricant on pump heads.

9. **Qualified review** — If you are not confident about your mains wiring, have a qualified electrician review it before powering on.

### Operational Safety

- Never open the machine while it is plugged in
- Always turn off the panel switch before refilling containers
- Allow heaters to cool before maintenance
- Label the machine: "230V inside — dangerous voltage present"
- Do not leave the machine unattended during first power-on tests

---

## 15. Troubleshooting

| Symptom | Likely Cause | Solution |
|---------|-------------|---------|
| Display stays blank | TFT wiring error | Check GPIO12/13/14/15 connections; verify 3.3V on TFT VCC |
| "NO WATER" at startup | Float switch wiring | Check GPIO23; float switch should pull GPIO23 to GND when UP |
| Water fills indefinitely | Float switch not triggering | Test float switch continuity when manually lifted |
| Pump runs but no liquid | Tubing not connected or airlock | Prime tubes manually; check tube routing |
| Pump runs wrong direction | IN1/IN2 swapped | Swap OUT1/OUT2 connections at the L298N terminal |
| Temperature reads -127°C | DS18B20 disconnected | Check data wire, 4.7kΩ pull-up, and VCC/GND |
| Temperature reads 85°C constantly | DS18B20 power issue | Use 3.3V not 5V; check GND connection |
| Heater never turns on | SSR wiring error | Verify GPIO18/19/21 going HIGH; measure SSR DC input voltage |
| Heater stays on permanently | SSR welded shut (overheated) | Replace SSR; ensure heat sink is properly mounted |
| Thermal fuse blown | Heater overran temperature | Replace thermal fuse; investigate root cause (sensor failure?) |
| ESP32 resets on button press | Button not debounced | 50ms delay is in firmware; check for shorts |
| Decoction not filling at startup | Pump 3 tubing not routed to Y-pipe | Check plumbing; confirm Pump 3 outlet connects to Y-splitter |
| TFT display garbled | MOSI/SCK swapped or CS not connected | Check GPIO13 (MOSI), GPIO14 (SCK), GPIO15 (CS) |

---

## 16. Adjusting Timings & Temperatures

Edit `include/config.h` — no changes to `src/main.cpp` needed.

### Dispense Volumes

Calibrate by running each pump and weighing the output in a cup:

```c
#define PRIME_MS          5000UL   // Prime/purge duration (all pumps)
#define PURGE_MS          5000UL   // Anti-drip purge duration
#define DISP_MILK_MS      7000UL   // Increase to dispense more milk
#define DISP_COFFEE_MS    3000UL   // Increase for more coffee decoction
#define DISP_TEA_MS       3000UL   // Increase for more tea decoction
#define DISP_WATER_MS     5000UL   // Increase for more hot water
```

Rule of thumb: 1 second ≈ 3–5 mL for a typical 100 mL/min peristaltic pump.

### Hot Water Pre-fill Volumes

```c
#define FILL_COFFEE_HOT_MS    8000UL  // Seconds of hot water into Coffee container
#define FILL_TEA_HOT_MS       8000UL  // Seconds of hot water into Tea container
```

Increase if containers are larger. Decrease if they overflow.

### Temperature Targets

```c
#define TARGET_WATER_C     80.0f   // Raise for hotter water (max ~95°C safe)
#define TARGET_MILK_C      60.0f   // Lower for cooler milk (min ~55°C for safety)
#define TARGET_DECOCT_C    30.0f   // Raise slightly if decoction needs to stay warm
#define HYSTERESIS_C        1.5f   // Tighten to 0.5f for tighter control (slower)
```

> After changing temperatures, update your thermal fuses accordingly.  
> Thermal fuse should always be rated ~10°C above the target.

---

*Lyra Coffee Machine — Build Guide v1.0*  
*Generated from project source: `e:\Lyra Coffee Machine\`*
