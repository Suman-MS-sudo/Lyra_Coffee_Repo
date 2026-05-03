# Lyra Coffee Machine — Project Documentation

## Overview

A DIY ESP32-controlled coffee/tea/milk vending machine with 4 peristaltic pumps, 3 independently temperature-controlled heater chambers, automatic water filling, and physical drink selector buttons.

## Drinks Menu

| Button | Drink | Motor | Sequence |
|--------|-------|-------|----------|
| 1 | Milk Only | Motor 1 | Reverse 5 s → Forward 7 s → Reverse 5 s |
| 2 | Coffee Decoction | Motor 2 | Reverse 5 s → Forward 3 s → Reverse 5 s |
| 3 | Tea Decoction | Motor 3 | Reverse 5 s → Forward 3 s → Reverse 5 s |
| 4 | Hot Water | Motor 4 | Forward 5 s |

**Reverse before / after dispense** — the initial reverse primes/clears the line; the final reverse sucks liquid back to prevent dripping after dispensing.

---

## Project File Structure

```
Lyra Coffee Machine/
├── platformio.ini          ← Build configuration
├── include/
│   └── config.h            ← ALL pin & timing constants (edit here)
├── src/
│   └── main.cpp            ← Firmware state machine
├── docs/
│   ├── components_list.md  ← Full bill of materials
│   └── wiring_diagram.md   ← Wiring reference tables
└── README.md               ← This file
```

---

## Quick Start

### 1 — Install toolchain

Install [VS Code](https://code.visualstudio.com/) + [PlatformIO IDE extension](https://platformio.org/install/ide?install=vscode).

### 2 — Discover DS18B20 sensor addresses

Each DS18B20 has a unique 8-byte ROM address. You **must** find these before the machine works correctly.

1. Open `include/config.h` and set `#define SCAN_SENSORS 1`
2. Connect all three DS18B20 sensors to `GPIO 22`  
3. Flash with: `pio run --target upload`
4. Open serial monitor (`pio device monitor`) at 115200 baud
5. Copy the three printed addresses into `config.h`:
   - `SENSOR_WATER_ADDR`  → sensor in the water chamber
   - `SENSOR_MILK_ADDR`   → sensor in the milk chamber
   - `SENSOR_DECOCT_ADDR` → sensor in the decoction chamber
6. Set `#define SCAN_SENSORS 0` and reflash

> The firmware currently uses index-based access (`getTempCByIndex`). Physical sensor order on the bus may vary. Use index 0/1/2 during testing and confirm by warming each container individually while watching the serial output.

### 3 — Power on sequence

```
Power ON
  └─ Check water level
      ├─ No water  → Error beep, retry every 10 s
      └─ Has water → Open fill valve until float switch closes
                      └─ Heat chamberssequentially:
                            Water (80 °C) → Milk (60 °C) → Decoction (30 °C)
                              └─ All ready → Triple ascending beep → READY
```

### 4 — Using the machine

- Press **Button 1–4** to dispense the matching drink.
- During heating, watch the serial monitor for temperature progress.
- Serial commands (connect USB, 115200 baud):  
  `1` / `2` / `3` / `4` → dispense  
  `t` → print temperatures  
  `r` → restart

---

## Temperature Targets

| Chamber | Target | Hysteresis band | Notes |
|---------|--------|-----------------|-------|
| Water | 80 °C | ±1.5 °C | Hot water dispense; also used in coffee & tea mixes |
| Milk | 60 °C | ±1.5 °C | Warm milk dispense |
| Decoction | 30 °C | ±1.5 °C | Keeps brewed coffee/tea decoction warm |

Temperature is maintained with **bang-bang (on/off) control** with a 1.5 °C hysteresis deadband.  
A **thermal runaway guard** cuts all heaters if any sensor reads more than 5 °C above its target.

---

## Heater Startup Sequence

The three heaters start **one at a time** to avoid large simultaneous AC inrush current:

1. Water heater turns ON → firmware waits until 80 °C is reached
2. Milk heater turns ON (700 ms stagger) → waits for 60 °C
3. Decoction heater turns ON (700 ms stagger) → waits for 30 °C

All previous heaters are actively regulated while waiting for the next one.

---

## Safety Notes

> ⚠️ This build involves **mains (220–240 V AC) electricity and hot liquids**. Construction must comply with local electrical codes and food safety regulations.

- Use **Solid State Relays (SSR)** to switch heaters — never connect heaters directly to ESP32 pins.
- Mount each SSR on an **aluminium heat sink**; SSRs dissipate ~1 W per amp of load.
- Fit a **thermal fuse** (rated ~10 °C above the target) in series with each heater element.
- Install a **GFCI / RCD 30 mA** circuit breaker on the mains supply — mandatory for any water-adjacent electrical installation.
- Keep the 220 V wiring **physically separated** from the 12 V/3.3 V low-voltage wiring.
- Use **food-grade silicone tubing** with your peristaltic pumps.
- Ground the metal chassis.

---

## Adjusting Timings

All timings are in `include/config.h`. No need to touch `src/main.cpp`.

```c
#define PRIME_MS        5000UL   // Reverse before dispense
#define PURGE_MS        5000UL   // Reverse after dispense
#define DISP_MILK_MS    7000UL   // Milk dispense time
#define DISP_COFFEE_MS  3000UL   // Coffee decoction time
#define DISP_TEA_MS     3000UL   // Tea decoction time
#define DISP_WATER_MS   5000UL   // Hot water time
```

Calibrate dispense times by weighing the output and adjusting these values.

---

## Future Enhancements (optional)

- Add a **0.96" OLED SSD1306 display** (I2C on GPIO 21/22) for status and temperature display
- Add **Wi-Fi** (ESP32 built-in) for remote monitoring via a web dashboard
- Implement **PID temperature control** (`arduino-libraries/PID`) for tighter precision
- Add a **cleaning cycle** button (cycles all pumps with water)
- Add a **cup sensor** (IR or weight cell) to prevent dispensing without a cup
