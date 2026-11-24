/*
 * MediLink AI — ESP32 + PN532 NFC Smart Patient Management System
 * Hardware: ESP32 + PN532 NFC Module (Red / Blue Board)
 * 
 * =====================================================================
 * PN532 DIP SWITCH CONFIGURATION (Very Important!)
 * Look at the tiny 2-switch toggle on your PN532 board:
 * 
 * For I2C Mode (Recommended - only 4 wires):
 *   Switch 1 (SEL0) = ON  (or 1)
 *   Switch 2 (SEL1) = OFF (or 0)
 * 
 * For SPI Mode:
 *   Switch 1 (SEL0) = OFF (or 0)
 *   Switch 2 (SEL1) = ON  (or 1)
 * =====================================================================
 * 
 * WIRING (I2C Mode - Recommended):
 *   PN532          ESP32
 *   -----          -----
 *   VCC      <->   5V or 3V3 (PN532 has onboard 3.3V regulator)
 *   GND      <->   GND
 *   SDA      <->   GPIO 21 (Default ESP32 I2C SDA)
 *   SCL      <->   GPIO 22 (Default ESP32 I2C SCL)
 *   
 *   Optional:
 *   LED (+)  <->   GPIO 2  (via 220 ohm resistor to GND)
 *   Buzzer   <->   GPIO 4  (Active buzzer, (-) to GND)
 * 
 * REQUIRED ARDUINO LIBRARIES:
 *   Install via Arduino IDE > Sketch > Include Library > Manage Libraries:
 *   1. "Adafruit PN532" by Adafruit
 *   2. "ArduinoJson" by Benoit Blanchon (version 6.x)
 *   3. "ESP32" board package in Board Manager
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_PN532.h>

// =====================================================================
// USER CONFIGURATION — Modify before uploading
// =====================================================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";      // Your Wi-Fi name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";  // Your Wi-Fi password
const char* SERVER_IP     = "192.168.1.100";        // Your PC's local IP (run 'ipconfig')
const int   SERVER_PORT   = 5000;
const char* SCAN_ENDPOINT = "/api/hardware/scan";
// =====================================================================

// Pin definitions
#define PN532_IRQ   (-1)  // Set to -1 when using polling (no IRQ wire needed)
#define PN532_RESET (-1)  // Set to -1 if RST not wired
#define LED_PIN     2     // Optional indicator LED
#define BUZZER_PIN  4     // Optional active buzzer

// Initialize PN532 using hardware I2C (Wire on GPIO 21 & 22)
Adafruit_PN532 nfc(PN532_IRQ, PN532_RESET);

// State variables
bool writeMode = false;
String pendingWriteId = "";
unsigned long lastScanTime = 0;
const unsigned long SCAN_COOLDOWN_MS = 3000; // 3 seconds between scans

// Feedback helpers
void beep(int count, int durationMs = 100) {
  for (int i = 0; i < count; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    digitalWrite(LED_PIN, HIGH);
    delay(durationMs);
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(LED_PIN, LOW);
    if (i < count - 1) delay(100);
  }
}

const char* getWiFiStatusName(wl_status_t status) {
  switch (status) {
    case WL_NO_SSID_AVAIL: return "Network not found (SSID not available - check if 5GHz vs 2.4GHz)";
    case WL_CONNECT_FAILED: return "Authentication failed (Wrong password or WPA3 incompatibility)";
    case WL_CONNECTION_LOST: return "Connection lost";
    case WL_DISCONNECTED: return "Disconnected / DHCP timeout";
    case WL_IDLE_STATUS: return "Idle status";
    default: return "Unknown status";
  }
}

void scanNearbyNetworks() {
  Serial.println("[WiFi] Scanning visible 2.4GHz networks...");
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

  int n = WiFi.scanNetworks();
  if (n <= 0) {
    Serial.println("[WiFi] No 2.4GHz networks detected. Check if your router/hotspot is 2.4GHz.");
  } else {
    Serial.print("[WiFi] Found ");
    Serial.print(n);
    Serial.println(" networks:");
    for (int i = 0; i < n; ++i) {
      Serial.print("   - \"");
      Serial.print(WiFi.SSID(i));
      Serial.print("\" (Signal: ");
      Serial.print(WiFi.RSSI(i));
      Serial.println(" dBm)");
    }
  }
}

void connectWiFi() {
  Serial.print("[WiFi] Connecting to: \"");
  Serial.print(WIFI_SSID);
  Serial.println("\"...");

  // Scan first so we know what networks are actually visible
  scanNearbyNetworks();

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) { // 20 seconds
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WiFi] ✅ Connected successfully!");
    Serial.print("[WiFi] ESP32 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    wl_status_t status = WiFi.status();
    Serial.println("[WiFi] ❌ Connection failed!");
    Serial.print("[WiFi] Reason: ");
    Serial.println(getWiFiStatusName(status));
    Serial.println("[WiFi] TIP: If on Campus/College WiFi, use a Mobile Hotspot instead (ESP32 cannot bypass login portals).");
  }
}

// Read patient ID from NTAG2xx (NTAG213 / NTAG215) starting from page 4
String readPatientIdFromNTAG() {
  uint8_t data[32] = {0};
  String patientId = "";

  // Read 4 pages (pages 4, 5, 6, 7) = 16 bytes. Format "MLP-26-000001" is 13 bytes.
  for (uint8_t page = 4; page < 8; page++) {
    uint8_t buffer[4];
    if (nfc.ntag2xx_ReadPage(page, buffer)) {
      for (int i = 0; i < 4; i++) {
        char c = (char)buffer[i];
        if (c == 0 || c == 0xFF) break;
        patientId += c;
      }
    } else {
      break;
    }
  }

  patientId.trim();
  if (patientId.startsWith("MLP-26-") && patientId.length() >= 13) {
    return patientId.substring(0, 13);
  }
  return "";
}

// Write patient ID to NTAG2xx starting from page 4
bool writePatientIdToNTAG(String pid) {
  uint8_t pageBuffer[4];
  int len = pid.length();

  for (int p = 0; p < 4; p++) {
    for (int b = 0; b < 4; b++) {
      int charIdx = p * 4 + b;
      pageBuffer[b] = (charIdx < len) ? (uint8_t)pid[charIdx] : 0x00;
    }
    if (!nfc.ntag2xx_WritePage(4 + p, pageBuffer)) {
      return false;
    }
  }
  return true;
}

// Send HTTP POST to MediLink Server
void sendNfcScanToServer(String patientId) {
  if (!WiFi.isConnected()) {
    Serial.println("[HTTP] WiFi lost. Reconnecting...");
    connectWiFi();
    if (!WiFi.isConnected()) return;
  }

  String url = String("http://") + SERVER_IP + ":" + SERVER_PORT + SCAN_ENDPOINT;
  Serial.print("[HTTP] POST ");
  Serial.println(url);

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);

  StaticJsonDocument<128> doc;
  doc["patientId"] = patientId;
  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);

  if (httpCode == 200 || httpCode == 201) {
    String resp = http.getString();
    Serial.print("[HTTP] Success (HTTP ");
    Serial.print(httpCode);
    Serial.println("): " + resp);
    beep(1, 150);
  } else {
    Serial.print("[HTTP] Error response code: ");
    Serial.println(httpCode);
    beep(3, 80);
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  Serial.println();
  Serial.println("============================================");
  Serial.println("  MediLink AI — ESP32 + PN532 NFC Reader    ");
  Serial.println("============================================");

  // Initialize PN532 over I2C
  Wire.begin(); // Uses GPIO 21 (SDA) and GPIO 22 (SCL) on ESP32
  nfc.begin();

  uint32_t versiondata = nfc.getFirmwareVersion();
  if (!versiondata) {
    Serial.println("[ERROR] Didn't find PN532 board!");
    Serial.println("Check: 1) DIP Switches: Switch 1=ON, Switch 2=OFF (I2C mode)");
    Serial.println("       2) Wiring: SDA->GPIO 21, SCL->GPIO 22, VCC->5V/3.3V, GND->GND");
    while (1) {
      beep(1, 200);
      delay(800);
    }
  }

  Serial.print("[OK] Found PN532 chip! Firmware ver: ");
  Serial.print((versiondata >> 16) & 0xFF, DEC);
  Serial.print('.');
  Serial.println((versiondata >> 8) & 0xFF, DEC);

  // Configure PN532 to read RFID / NFC tags
  nfc.SAMConfig();

  // Connect to Wi-Fi
  connectWiFi();

  Serial.println();
  Serial.println("Ready! Serial Commands:");
  Serial.println("  WRITE:MLP-26-000001  — Program NFC card with ID");
  Serial.println("  SCAN                 — Return to normal scan mode");
  Serial.println("============================================");
  beep(2, 80);
}

void loop() {
  // Check for serial commands
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.startsWith("WRITE:")) {
      pendingWriteId = cmd.substring(6);
      pendingWriteId.trim();
      writeMode = true;
      digitalWrite(LED_PIN, HIGH);
      Serial.print("[CMD] WRITE mode active. Tap NFC tag to write: ");
      Serial.println(pendingWriteId);
    } else if (cmd == "SCAN") {
      writeMode = false;
      pendingWriteId = "";
      digitalWrite(LED_PIN, LOW);
      Serial.println("[CMD] SCAN mode active.");
    }
  }

  // Look for NFC card
  uint8_t success;
  uint8_t uid[] = {0, 0, 0, 0, 0, 0, 0};
  uint8_t uidLength;

  // Poll for card (timeout 50ms)
  success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 50);

  if (success) {
    unsigned long now = millis();
    if (now - lastScanTime < SCAN_COOLDOWN_MS) {
      return; // Cooldown between taps
    }
    lastScanTime = now;

    Serial.print("[NFC] Card detected! UID Length: ");
    Serial.print(uidLength, DEC);
    Serial.print(" UID: ");
    nfc.PrintHex(uid, uidLength);

    if (writeMode && pendingWriteId.length() > 0) {
      Serial.print("[WRITE] Writing ID: ");
      Serial.println(pendingWriteId);
      if (writePatientIdToNTAG(pendingWriteId)) {
        Serial.println("[WRITE] Success! Patient ID programmed.");
        beep(2, 100);
        writeMode = false;
        pendingWriteId = "";
        digitalWrite(LED_PIN, LOW);
      } else {
        Serial.println("[WRITE] Write failed. Ensure tag is NTAG213/215/216.");
        beep(3, 50);
      }
    } else {
      // Normal scan mode
      String patientId = readPatientIdFromNTAG();
      if (patientId.length() > 0) {
        Serial.print("[NFC] Read Patient ID: ");
        Serial.println(patientId);
        sendNfcScanToServer(patientId);
      } else {
        Serial.println("[NFC] Tag is blank or not programmed yet. Use WRITE:MLP-26-000001 to program.");
        beep(2, 50);
      }
    }
  }
}
