/*
 * MediLink AI — ESP32 NFC Smart Patient Management System
 * Hardware: ESP32 + MFRC522 NFC Reader + NTAG213 NFC Cards
 * Features:
 *   1. Default SCAN mode: Reads NFC card → HTTP POST to /api/hardware/scan
 *   2. Serial WRITE mode: Command 'WRITE:MLP-26-000001' programs NTAG213 card
 *   3. LED + Buzzer feedback for status
 * 
 * Wiring:
 *   MFRC522 → ESP32:
 *     SDA (SS)  → GPIO 5
 *     SCK       → GPIO 18
 *     MOSI      → GPIO 23
 *     MISO      → GPIO 19
 *     RST       → GPIO 22
 *     GND       → GND
 *     3.3V      → 3.3V
 *   LED         → GPIO 2  (via 220Ω resistor)
 *   Buzzer      → GPIO 4
 *
 * Required Libraries (install via Arduino Library Manager):
 *   - MFRC522 by GithubCommunity
 *   - ArduinoJson by Benoit Blanchon
 *   - ESP32 board package
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>

// =====================================================================
// USER CONFIGURATION — Modify these values before uploading
// =====================================================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";      // Replace with your Wi-Fi SSID
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";  // Replace with your Wi-Fi password
const char* SERVER_IP     = "192.168.1.100";        // Replace with your PC's local IP
const int   SERVER_PORT   = 5000;
const char* SCAN_ENDPOINT = "/api/hardware/scan";
// =====================================================================

// Pin definitions
#define SS_PIN    5    // MFRC522 SDA/SS pin
#define RST_PIN   22   // MFRC522 RST pin
#define LED_PIN   2    // Status LED
#define BUZZER_PIN 4   // Active buzzer

// MFRC522 instance
MFRC522 mfrc522(SS_PIN, RST_PIN);
MFRC522::MIFARE_Key key;

// State
bool writeMode = false;
String pendingWriteId = "";
unsigned long lastScanTime = 0;
const unsigned long SCAN_COOLDOWN_MS = 3000; // 3 seconds between scans

// =====================================================================
// SETUP
// =====================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  // Initialize pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  Serial.println();
  Serial.println("============================================");
  Serial.println(" MediLink AI — NFC Smart Patient System");
  Serial.println("============================================");

  // Initialize SPI and MFRC522
  SPI.begin();
  mfrc522.PCD_Init();
  delay(100);

  // Check MFRC522
  byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
  if (version == 0x00 || version == 0xFF) {
    Serial.println("[ERROR] MFRC522 not detected! Check wiring.");
    errorBlink(5);
  } else {
    Serial.print("[OK] MFRC522 initialized. Firmware v");
    Serial.println(version, HEX);
  }

  // Connect to Wi-Fi
  connectWiFi();

  Serial.println();
  Serial.println("Ready! Commands:");
  Serial.println("  WRITE:<PatientID>  — Program NFC card (e.g., WRITE:MLP-26-000001)");
  Serial.println("  SCAN               — Return to scan mode");
  Serial.println("  STATUS             — Show connection status");
  Serial.println("============================================");
  Serial.println("Waiting for NFC card...");

  // Default keys for MFRC522
  for (byte i = 0; i < 6; i++) key.keyByte[i] = 0xFF;

  successBeep(1);
}

// =====================================================================
// MAIN LOOP
// =====================================================================
void loop() {
  // Handle serial commands
  handleSerialCommands();

  // Check if a new NFC card is present
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  // Cooldown check to prevent repeated scans
  unsigned long now = millis();
  if (now - lastScanTime < SCAN_COOLDOWN_MS) {
    mfrc522.PICC_HaltA();
    return;
  }
  lastScanTime = now;

  // Get card UID as hex string
  String uid = getCardUID();
  Serial.print("[NFC] Card UID: ");
  Serial.println(uid);

  if (writeMode && pendingWriteId.length() > 0) {
    // WRITE MODE: Program the NFC card
    writePatientIdToCard(pendingWriteId);
  } else {
    // SCAN MODE: Read and POST to server
    String patientId = readPatientIdFromCard();
    if (patientId.length() > 0) {
      Serial.print("[NFC] Patient ID read: ");
      Serial.println(patientId);
      sendNfcScanToServer(patientId);
    } else {
      Serial.println("[NFC] Card has no MediLink data or is blank.");
      errorBeep(1);
    }
  }

  // Halt card & stop crypto
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}

// =====================================================================
// SERIAL COMMAND HANDLER
// =====================================================================
void handleSerialCommands() {
  if (!Serial.available()) return;

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();

  if (cmd.startsWith("WRITE:")) {
    String id = cmd.substring(6);
    id.trim();
    if (id.length() > 0) {
      pendingWriteId = id;
      writeMode = true;
      Serial.println("[CMD] WRITE mode active. Present NFC card to program.");
      Serial.print("[CMD] Will write: ");
      Serial.println(id);
      digitalWrite(LED_PIN, HIGH); // Solid LED in write mode
    } else {
      Serial.println("[CMD] Error: No Patient ID provided. Format: WRITE:MLP-26-000001");
    }
  } else if (cmd == "SCAN") {
    writeMode = false;
    pendingWriteId = "";
    digitalWrite(LED_PIN, LOW);
    Serial.println("[CMD] SCAN mode active. Waiting for NFC cards...");
  } else if (cmd == "STATUS") {
    Serial.println("----- MediLink Status -----");
    Serial.print("WiFi: ");
    Serial.println(WiFi.isConnected() ? WiFi.localIP().toString() : "Disconnected");
    Serial.print("Mode: ");
    Serial.println(writeMode ? "WRITE" : "SCAN");
    if (writeMode) {
      Serial.print("Pending ID: ");
      Serial.println(pendingWriteId);
    }
    Serial.print("Server: http://");
    Serial.print(SERVER_IP);
    Serial.print(":");
    Serial.println(SERVER_PORT);
    Serial.println("---------------------------");
  } else if (cmd.length() > 0) {
    Serial.print("[CMD] Unknown command: ");
    Serial.println(cmd);
    Serial.println("[CMD] Valid commands: WRITE:<ID>, SCAN, STATUS");
  }
}

// =====================================================================
// WRITE PATIENT ID TO NTAG213
// NTAG213 uses NDEF-compatible page writes (Page 4 onwards = user data)
// =====================================================================
void writePatientIdToCard(String patientId) {
  Serial.print("[WRITE] Writing \"");
  Serial.print(patientId);
  Serial.println("\" to NTAG213...");

  // NTAG213 user memory starts at page 4
  // Each page is 4 bytes, max 36 bytes of user data (pages 4-12)
  // We write the patientId as plain UTF-8 text

  int len = patientId.length();
  if (len > 36) {
    Serial.println("[WRITE] Error: Patient ID too long (max 36 chars).");
    errorBeep(2);
    return;
  }

  // Pad to multiple of 4 bytes
  byte dataBuffer[40] = {0};
  for (int i = 0; i < len; i++) {
    dataBuffer[i] = (byte)patientId[i];
  }

  // Write pages 4 through (4 + ceil(len/4))
  int pages = (len + 3) / 4;
  bool success = true;

  for (int p = 0; p < pages; p++) {
    byte pageData[4];
    pageData[0] = dataBuffer[p * 4];
    pageData[1] = dataBuffer[p * 4 + 1];
    pageData[2] = dataBuffer[p * 4 + 2];
    pageData[3] = dataBuffer[p * 4 + 3];

    MFRC522::StatusCode status = (MFRC522::StatusCode)mfrc522.MIFARE_Ultralight_Write(4 + p, pageData, 4);
    if (status != MFRC522::STATUS_OK) {
      Serial.print("[WRITE] Failed at page ");
      Serial.print(4 + p);
      Serial.print(": ");
      Serial.println(mfrc522.GetStatusCodeName(status));
      success = false;
      break;
    }
  }

  if (success) {
    Serial.println("[WRITE] ✅ Success! Patient ID written to card.");
    successBeep(2);
    writeMode = false;
    pendingWriteId = "";
    digitalWrite(LED_PIN, LOW);
    Serial.println("[WRITE] Returned to SCAN mode.");
  } else {
    Serial.println("[WRITE] ❌ Write failed. Try again.");
    errorBeep(3);
  }
}

// =====================================================================
// READ PATIENT ID FROM NTAG213
// =====================================================================
String readPatientIdFromCard() {
  // Read pages 4 through 12 (36 bytes max)
  String result = "";

  for (int p = 4; p <= 12; p++) {
    byte buffer[18];
    byte bufSize = sizeof(buffer);

    MFRC522::StatusCode status = mfrc522.MIFARE_Read(p, buffer, &bufSize);
    if (status != MFRC522::STATUS_OK) {
      break;
    }

    // Read 4 bytes per page
    for (int b = 0; b < 4; b++) {
      if (buffer[b] == 0x00) goto done; // Null terminator
      result += (char)buffer[b];
    }
  }
done:

  // Validate MediLink format: MLP-26-XXXXXX
  if (result.startsWith("MLP-26-") && result.length() == 13) {
    return result;
  }

  return ""; // Invalid or blank card
}

// =====================================================================
// SEND NFC SCAN TO SERVER
// =====================================================================
void sendNfcScanToServer(String patientId) {
  if (!WiFi.isConnected()) {
    Serial.println("[HTTP] WiFi not connected. Reconnecting...");
    connectWiFi();
    if (!WiFi.isConnected()) {
      Serial.println("[HTTP] Reconnect failed. Scan not sent.");
      errorBeep(2);
      return;
    }
  }

  String url = String("http://") + SERVER_IP + ":" + SERVER_PORT + SCAN_ENDPOINT;
  Serial.print("[HTTP] POST ");
  Serial.println(url);

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000); // 5 second timeout

  // Build JSON payload
  StaticJsonDocument<128> doc;
  doc["patientId"] = patientId;
  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);

  if (httpCode == 200 || httpCode == 201) {
    String response = http.getString();
    Serial.print("[HTTP] ✅ Success (HTTP ");
    Serial.print(httpCode);
    Serial.println(")");
    Serial.print("[HTTP] Response: ");
    Serial.println(response);

    // Parse response
    StaticJsonDocument<256> respDoc;
    DeserializationError err = deserializeJson(respDoc, response);
    if (!err) {
      const char* name = respDoc["patientName"] | "Unknown";
      Serial.print("[HTTP] Patient: ");
      Serial.println(name);
    }
    successBeep(1);
    flashLed(3, 150);
  } else if (httpCode == 404) {
    Serial.println("[HTTP] ❌ Patient not found on server.");
    errorBeep(2);
  } else {
    Serial.print("[HTTP] ❌ Error. HTTP code: ");
    Serial.println(httpCode);
    errorBeep(2);
  }

  http.end();
}

// =====================================================================
// WI-FI CONNECTION
// =====================================================================
void connectWiFi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.print(WIFI_SSID);
  Serial.print("...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
    flashLed(1, 200);
  }

  if (WiFi.isConnected()) {
    Serial.println();
    Serial.print("[WiFi] ✅ Connected! IP: ");
    Serial.println(WiFi.localIP());
    successBeep(2);
    flashLed(3, 100);
  } else {
    Serial.println();
    Serial.println("[WiFi] ❌ Connection failed. Running in offline mode.");
    errorBeep(3);
  }
}

// =====================================================================
// UTILITY FUNCTIONS
// =====================================================================
String getCardUID() {
  String uid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(mfrc522.uid.uidByte[i], HEX);
    if (i < mfrc522.uid.size - 1) uid += ":";
  }
  uid.toUpperCase();
  return uid;
}

void flashLed(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(delayMs);
    digitalWrite(LED_PIN, LOW);
    if (i < times - 1) delay(delayMs);
  }
}

void successBeep(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    if (i < times - 1) delay(100);
  }
  digitalWrite(LED_PIN, LOW);
}

void errorBeep(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(300);
    digitalWrite(BUZZER_PIN, LOW);
    if (i < times - 1) delay(100);
  }
  flashLed(times, 200);
}

void errorBlink(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(500);
    digitalWrite(LED_PIN, LOW);
    delay(500);
  }
}
