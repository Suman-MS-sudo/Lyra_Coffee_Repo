#include <Arduino.h>
#include <max6675.h>

#define RELAY_ON  LOW
#define RELAY_OFF HIGH

// --- Thermocouple shared SPI pins ---
const int CLK = 18;
const int DO  = 19;
const int CS1 =  5;  // Water sensor
const int CS2 = 16;  // Milk sensor
const int CS3 = 17;  // Decoction sensor

// --- Relay pins ---
const int RELAY_WATER  = 21;  // Heater 1
const int RELAY_MILK   = 22;  // Heater 2
const int RELAY_DECOCT = 23;  // Heater 3

// --- Target temperatures ---
const float TARGET_WATER  = 92.0f;
const float TARGET_MILK   = 60.0f;
const float TARGET_DECOCT = 75.0f;
const float HYSTERESIS    =  3.0f;  // re-heat when temp drops below (target - 3)

// --- MAX6675 objects ---
MAX6675 sensorWater (CLK, CS1, DO);
MAX6675 sensorMilk  (CLK, CS2, DO);
MAX6675 sensorDecoct(CLK, CS3, DO);

// --- Heater states ---
bool heaterWater  = false;
bool heaterMilk   = false;
bool heaterDecoct = false;

unsigned long lastRead = 0;

void controlHeater(int pin, bool& state, float temp, float target, const char* name) {
  if (temp <= 0) {
    // sensor fault — turn off heater for safety
    if (state) {
      digitalWrite(pin, RELAY_OFF);
      state = false;
      Serial.printf("[%s] SENSOR FAULT — heater OFF\n", name);
    }
    return;
  }

  if (state && temp >= target) {
    digitalWrite(pin, RELAY_OFF);
    state = false;
    Serial.printf("[%s] %.1fC reached %.0fC — OFF\n", name, temp, target);
  } else if (!state && temp < target - HYSTERESIS) {
    digitalWrite(pin, RELAY_ON);
    state = true;
    Serial.printf("[%s] %.1fC below %.0fC — ON\n", name, temp, target - HYSTERESIS);
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(RELAY_WATER,  OUTPUT); digitalWrite(RELAY_WATER,  RELAY_OFF);
  pinMode(RELAY_MILK,   OUTPUT); digitalWrite(RELAY_MILK,   RELAY_OFF);
  pinMode(RELAY_DECOCT, OUTPUT); digitalWrite(RELAY_DECOCT, RELAY_OFF);

  delay(500);
  Serial.println("=== 3 Channel Temp Controller ===");
  Serial.printf("Water  target: %.0fC  GPIO%d\n", TARGET_WATER,  RELAY_WATER);
  Serial.printf("Milk   target: %.0fC  GPIO%d\n", TARGET_MILK,   RELAY_MILK);
  Serial.printf("Decoct target: %.0fC  GPIO%d\n", TARGET_DECOCT, RELAY_DECOCT);
}

void loop() {
  if (millis() - lastRead >= 2000) {
    lastRead = millis();

    float tempWater  = sensorWater.readCelsius();
    float tempMilk   = sensorMilk.readCelsius();
    float tempDecoct = sensorDecoct.readCelsius();

    Serial.printf("\nWater:  %.1fC / %.0fC  Heater:%s\n",
      tempWater,  TARGET_WATER,  heaterWater  ? "ON" : "OFF");
    Serial.printf("Milk:   %.1fC / %.0fC  Heater:%s\n",
      tempMilk,   TARGET_MILK,   heaterMilk   ? "ON" : "OFF");
    Serial.printf("Decoct: %.1fC / %.0fC  Heater:%s\n",
      tempDecoct, TARGET_DECOCT, heaterDecoct ? "ON" : "OFF");

    controlHeater(RELAY_WATER,  heaterWater,  tempWater,  TARGET_WATER,  "Water");
    controlHeater(RELAY_MILK,   heaterMilk,   tempMilk,   TARGET_MILK,   "Milk");
    controlHeater(RELAY_DECOCT, heaterDecoct, tempDecoct, TARGET_DECOCT, "Decoct");
  }
}
