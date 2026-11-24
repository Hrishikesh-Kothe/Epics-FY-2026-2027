# 🏥 MediLink AI — Smart NFC Patient Management & AI Medicine Assistance System

> **EPICS Project 2026** | AI + NFC + Real-time Healthcare System

[![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node.js%20%7C%20MongoDB%20%7C%20Gemini%20AI-blue)]
[![Hardware](https://img.shields.io/badge/Hardware-ESP32%20%2B%20MFRC522%20NFC-green)]
[![Auth](https://img.shields.io/badge/Auth-JWT%20%2B%20RBAC-orange)]

---

## 🚀 Quick Start (Full Demo in 5 Minutes)

### Prerequisites
- Node.js v18+
- MongoDB Community Server (running on port 27017)
- Git

### Step 1: Install Dependencies
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### Step 2: Configure Backend Environment
```bash
cd server
copy .env.example .env
```
Edit `server/.env` and fill in your values:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/medilink
JWT_SECRET=medilink_secret_2026
GEMINI_API_KEY=your_actual_gemini_api_key_here
```
> 💡 Get a free Gemini API key at [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
> The system works without a Gemini key (fallback explanations are provided), but AI features require it.

### Step 3: Start MongoDB
```bash
# Windows (if installed as service, it may already be running)
mongod
# Or start the MongoDB service from Windows Services
```

### Step 4: Start the Backend Server
```bash
cd server
npm run dev
```
Expected output:
```
[MongoDB] Connected to: mongodb://127.0.0.1:27017/medilink
[Seed] Demo doctor created: doctor@medilink.com / 123456
[Seed] Demo patient created: patient@medilink.com / 123456 (ID: MLP-26-000001)
[Seed] Demo admin created: admin@medilink.com / 123456
[Server] MediLink AI Server running on http://localhost:5000
```

### Step 5: Start the Frontend
```bash
# In a new terminal
cd client
npm run dev
```
Open: **http://localhost:5173**

---

## 🎯 Live Demo Flow

### As Doctor:
1. Click **"👨⚕️ Doctor"** demo button → Logged in as `Dr. Priya Sharma`
2. See the **"Waiting for NFC Card Tap..."** banner at the top
3. In the **Simulate NFC** bar, type `MLP-26-000001` and click **Tap**
4. → Patient profile (`Ramesh Kumar`) auto-loads in the Prescribe tab
5. Fill in Diagnosis + Medicines → Click **"Save & Run AI Analysis"**
6. → AI explanation, drug interaction alerts, and smart reminders are generated

### As Patient:
1. Click **"🧑🦳 Patient"** demo button → Logged in as `Ramesh Kumar`
2. See your **Digital NFC Card** with ID `MLP-26-000001`
3. View **Active Prescriptions** with AI-generated explanations
4. Check off **Daily Medicine Reminders**
5. Click **"🧠 AI Assistant"** → Chat with the AI about your medicines

### As Admin:
1. Click **"🔧 Admin"** demo button
2. View all registered patients, NFC scan logs, and system status

---

## 📁 Project Structure

```
EPICS/
├── server/                    # Node.js + Express + Socket.io Backend
│   ├── server.js              # Main server entry point (includes seed script)
│   ├── .env.example           # Environment variables template
│   ├── models/
│   │   ├── User.js            # User schema (Patient/Doctor/Admin)
│   │   ├── MedicalRecord.js   # Prescription & AI results schema
│   │   └── NfcScan.js         # NFC scan log schema
│   ├── middleware/
│   │   └── authMiddleware.js  # JWT verify + role guard
│   ├── services/
│   │   └── aiService.js       # Gemini 2.5 Flash AI integration
│   └── routes/
│       ├── authRoutes.js      # POST /register, POST /login, GET /me
│       ├── patientRoutes.js   # GET /patients, GET /by-id/:id
│       ├── recordRoutes.js    # POST /records (AI pipeline), GET /records
│       ├── hardwareRoutes.js  # POST /hardware/scan (NFC + Socket.io emit)
│       └── aiRoutes.js        # POST /ai/chat (Gemini chatbot)
│
├── client/                    # React (Vite) + Tailwind CSS Frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingLogin.jsx      # Unified login/signup + demo buttons
│   │   │   ├── DoctorDashboard.jsx   # NFC listener, prescribe form, OCR
│   │   │   ├── PatientDashboard.jsx  # Digital card, reminders, AI chatbot
│   │   │   └── AdminDashboard.jsx    # Overview tables + NFC scan logs
│   │   ├── context/
│   │   │   └── AuthContext.jsx       # JWT auth state management
│   │   └── api/
│   │       └── axios.js              # Configured Axios instance
│   └── ...
│
├── firmware/
│   └── medilink_nfc_esp.ino  # ESP32 + MFRC522 Arduino firmware
│
└── README.md
```

---

## 🔌 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | None | Register new user |
| POST | `/api/auth/login` | None | Login, get JWT |
| GET | `/api/auth/me` | JWT | Get current user |
| GET | `/api/patients` | Doctor/Admin | List all patients |
| GET | `/api/patients/by-id/:id` | Doctor/Admin | Get patient by NFC ID |
| GET | `/api/patients/profile` | Patient | Patient's own profile |
| POST | `/api/records` | Doctor | Create prescription (triggers AI) |
| GET | `/api/records/patient/:id` | JWT | Get patient's records |
| POST | `/api/hardware/scan` | None | NFC scan event (ESP32) |
| GET | `/api/hardware/stats` | None | NFC scan statistics |
| POST | `/api/ai/chat` | JWT | AI chatbot |
| GET | `/api/ai/status` | None | Check AI configuration |

---

## 🔧 ESP32 Firmware Setup

### Required Arduino Libraries
Install via **Arduino Library Manager** (`Tools > Manage Libraries`):
- **MFRC522** by GithubCommunity
- **ArduinoJson** by Benoit Blanchon

### Required Board Package
Add ESP32 board URL in Preferences:
```
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
```
Then: `Tools > Board > ESP32 Arduino > ESP32 Dev Module`

### Configure Wi-Fi & Server IP
Open `firmware/medilink_nfc_esp.ino` and edit:
```cpp
const char* WIFI_SSID     = "YourWiFiName";
const char* WIFI_PASSWORD = "YourWiFiPassword";
const char* SERVER_IP     = "192.168.1.xxx"; // Your PC's local IP
```

Find your PC's IP:
```powershell
ipconfig
# Look for IPv4 Address under your Wi-Fi adapter
```

### Wiring Diagram
```
ESP32          MFRC522
-----          -------
GPIO 5    ←→  SDA (SS)
GPIO 18   ←→  SCK
GPIO 23   ←→  MOSI
GPIO 19   ←→  MISO
GPIO 22   ←→  RST
GND       ←→  GND
3.3V      ←→  3.3V

GPIO 2    ←→  LED (anode, via 220Ω to GND)
GPIO 4    ←→  Buzzer (+)
GND       ←→  Buzzer (-)
```

### Serial Commands
Open Serial Monitor at **115200 baud**:
```
WRITE:MLP-26-000001   — Programs NFC card with patient ID
SCAN                  — Returns to default scan mode
STATUS                — Shows Wi-Fi + server info
```

---

## 🧠 AI Pipeline (on each prescription save)

```
Doctor saves prescription
         ↓
  1. generateMedicineExplanation()
     → Simple English explanation for elderly patients
         ↓
  2. checkDrugInteractions()
     → Compares new vs existing medications
         ↓
  3. generateSmartReminders()
     → Morning/Afternoon/Evening/Night schedule
         ↓
  Results stored in MedicalRecord + shown to Doctor + Patient
```

---

## 🔄 Real-Time NFC Flow

```
[ESP32 reads NTAG213 card]
         ↓
[HTTP POST /api/hardware/scan]
         ↓
[Server validates patientId]
         ↓
[Socket.io emits 'nfc_scanned' event]
         ↓
[Doctor Dashboard auto-loads patient profile]
```

---

## 👥 Demo Credentials

| Role | Email | Password | Patient ID |
|------|-------|----------|------------|
| Doctor | doctor@medilink.com | 123456 | — |
| Patient | patient@medilink.com | 123456 | MLP-26-000001 |
| Admin | admin@medilink.com | 123456 | — |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + Tailwind CSS v3 + Lucide Icons |
| Backend | Node.js + Express.js + Socket.io |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs + RBAC |
| AI | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| OCR | Tesseract.js (client-side) |
| Hardware | ESP32 + MFRC522 + NTAG213 NFC Cards |
| Real-time | Socket.io |

---

## 📝 Notes

- **Without Gemini API key**: The system still works with fallback explanations and reminders. Add your key in `.env` for full AI features.
- **Without MongoDB**: Install MongoDB Community Server and ensure it's running on port 27017.
- **Without ESP32 hardware**: Use the "Simulate NFC Tap" input on the Doctor Dashboard.
- **Patient ID format**: `MLP-26-XXXXXX` (sequential 6-digit number, e.g., `MLP-26-000001`).

---

*MediLink AI — EPICS Project 2026 | Powered by Google Gemini AI + Socket.io + NFC*
#   E p i c s - F Y - 2 0 2 6 - 2 0 2 7  
 