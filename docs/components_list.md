# Lyra Coffee Machine — Bill of Materials

## Main Components

| # | Component | Spec / Notes | Qty | Est. Cost (USD) |
|---|-----------|-------------|-----|-----------------|
| 1 | **ESP32 Dev Board** | ESP32-WROOM-32 / 38-pin or 30-pin dev module | 1 | $7–10 |
| 2 | **L298N Dual H-Bridge Motor Driver Module** | 12 V, 2 A per channel; leave ENA/ENB jumpers in place | 2 | $3–5 ea |
| 3 | **12 V DC Peristaltic Pump (food-grade)** | Silicone tubing, 100–300 mL/min flow, self-priming | 4 | $8–15 ea |
| 4 | **DS18B20 Waterproof Temperature Probe** | Stainless steel probe, 1 m cable, pre-wired | 3 | $3–5 ea |
| 5 | **Solid State Relay (SSR) 40 A** | 3–32 VDC input / 24–480 VAC output (e.g. SSR-40 DA) | 3 | $4–8 ea |
| 6 | **SSR Aluminium Heat Sink** | For 40 A SSR; mandatory — SSR gets hot under load | 3 | $2–4 ea |
| 7 | **Heating Element — Water (500 W)** | Immersion / cartridge heater; 220 V; 220 V 500 W for ~1 litre | 1 | $8–15 |
| 8 | **Heating Element — Milk (300 W)** | Immersion / cartridge heater; 220 V 300 W | 1 | $6–12 |
| 9 | **Heating Element — Decoction (200 W)** | Immersion / cartridge heater; 220 V 200 W | 1 | $5–10 |
| 10 | **Thermal Fuse** | Rated ~10 °C above target (100 °C for water, 70 °C for milk, 45 °C for decoction); series with each heater | 3 | $0.50–1 ea |
| 11 | **NC Float Switch (Liquid Level Sensor)** | Normally-Closed; closes when float rises (water present); 12 V rated | 1 | $2–4 |
| 12 | **12 V Solenoid Valve — Normally Closed** | Food-safe, NC (closes when power off = fail-safe) | 1 | $7–12 |
| 13 | **12 V 5 A DC Power Supply** | Powers L298N modules, pumps, solenoid valve | 1 | $10–15 |
| 14 | **5 V USB Power or 12 V→5 V Buck Module** | Supplies ESP32 (max 500 mA); many L298N modules have onboard 5 V reg | 1 | $2–5 |
| 15 | **Passive Buzzer 5 V** | 3–5 V tone buzzer | 1 | $0.50 |
| 16 | **Momentary Push Button 12 mm** | 4 for drinks + 1 optional stop/reset | 5 | $0.50 ea |

---

## Passive Electronics / Connectors

| Component | Value | Purpose | Qty |
|-----------|-------|---------|-----|
| Resistor | 4.7 kΩ, 1/4 W | DS18B20 OneWire pull-up (DATA → 3.3 V) | 3 |
| Resistor | 10 kΩ, 1/4 W | Button pull-up (BTN → 3.3 V) for GPIO 34–39 | 4 |
| Resistor | 330 Ω, 1/4 W | Buzzer series resistor | 1 |
| Resistor | 10 kΩ, 1/4 W | SSR input series protection | 3 |
| Diode | 1N4007 | Flyback diode across solenoid valve coil | 1 |
| Capacitor | 100 µF 25 V electrolytic | Bulk decoupling on 12 V supply rail | 2 |
| Capacitor | 100 nF ceramic | Bypass on 3.3 V / 5 V near ESP32 | 4 |
| Screw terminal block | 2-pin or 3-pin, 5 mm pitch | Motor, heater, valve connections | 12+ |
| Prototype PCB / perfboard | ≥ 10×10 cm | Mounting ESP32, resistors, connectors | 1 |
| JST-XH 2- and 3-pin connectors | — | Pump motor quick-disconnect | 8 |
| DuPont jumper wires | Male–Female, Female–Female | Prototyping | 1 set |
| Heat-shrink tubing | Assorted | Insulate all solder joints | 1 pack |
| Cable ties | — | Cable management | 1 pack |

---

## Mechanical / Enclosure

| Component | Notes | Qty |
|-----------|-------|-----|
| Enclosure / project box | Min. 200×150×80 mm; IP54 or better; metal preferred for EMI shielding | 1 |
| Food-grade silicone tubing | Match pump inner diameter (typically 3 mm or 4 mm ID, 6 mm OD) — buy extra (2–3 m per pump circuit) | 12 m |
| Liquid containers / chambers | Stainless steel or food-safe plastic tanks for water, milk, decoction | 3 |
| Pump mounting brackets | 3 D-print or buy; secure pumps to enclosure | 4 |
| M3 stainless bolts, nuts, standoffs | Mounting PCB, SSR, brackets | 1 pack |
| Drip tray | Stainless steel tray under dispense nozzles | 1 |

---

## Safety / Electrical

| Component | Notes | Qty |
|-----------|-------|-----|
| **GFCI / RCD 30 mA circuit breaker** | **MANDATORY** — protects against electric shock near water | 1 |
| Mains power switch (SPST) | Panel-mount, 10 A 250 V | 1 |
| Mains inlet with fuse holder | IEC C14 socket + 5 A fuse for the whole machine | 1 |
| Mains fuse 5 A (slow-blow) | Machine inlet protection | 2 (1 spare) |
| 3-core mains cable | Live / Neutral / Earth; 1.5 mm² minimum | 1.5 m |
| Cable glands | For mains cable entry into enclosure | 2 |
| Warning label sticker | "230 V inside — do not open while powered" | 1 |

---

## Optional Enhancements

| Component | Notes |
|-----------|-------|
| 0.96" OLED display SSD1306 (I2C) | Status + temperature display; wires to GPIO 21 (SDA) / GPIO 22 (SCL) |
| 16×2 or 20×4 I2C LCD | Alternative to OLED; same I2C pins |
| NPN transistor BC547 (+ 1 kΩ base resistor) | Alternative to relay for solenoid valve drive |
| 5 V relay module | Alternative to transistor for fill valve |
| Rotary encoder with button | Menu navigation for future UI |
| Load cell + HX711 | Weigh cup for closed-loop volume control |

---

## Estimated Total Cost

| Category | Estimate |
|----------|----------|
| Core electronics | $60–100 |
| Heaters + SSRs + heat sinks | $30–60 |
| Pumps (×4) | $32–60 |
| Enclosure + mechanical | $20–40 |
| Safety components | $15–25 |
| Misc passive / wire | $10–20 |
| **Total** | **~$167–305 USD** |

*Prices vary significantly by sourcing (AliExpress vs local supplier). Source SSRs and thermal fuses from reputable suppliers — counterfeit SSRs are a real hazard.*
