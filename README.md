# MediLink — Smart NFC Patient Health & AI Triage System

> **EPICS Project (FY 2026–2027)** | Hardware-Software Healthcare Prototype

MediLink bridges physical patient identification with instant digital healthcare workflows. By tapping an NFC-enabled patient ID card onto an ESP32 + PN532 hardware reader, doctors immediately view the patient's medical profile, scan history, and AI-generated clinical summaries on a real-time web dashboard.

---

## Key Features

* **Instant NFC Card Tap-to-Load:** Sub-second UID reading via PN532 NFC module and ESP32 microcontroller that automatically triggers patient lookup on the doctor's screen.
* **AI Clinical Assistant:** Automated summarization of longitudinal patient history, allergy/medication conflict alerts, and preliminary triage notes.
* **Real-Time Doctor Dashboard:** Responsive interface for viewing vitals, updating prescriptions, and registering new NFC cards on the spot.
* **RESTful Backend & Cloud Sync:** Secure API endpoints linking embedded hardware events with persistent patient records.

---

## System Architecture

```text
┌───────────────────┐     HTTP POST (UID)     ┌───────────────────────┐
│   PN532 NFC +     │ ──────────────────────► │   Backend REST API    │
│   ESP32 Firmware  │                         │   & Patient Database  │
└───────────────────┘                         └───────────┬───────────┘
                                                          │
                                             ┌────────────┴────────────┐
                                             ▼                         ▼
                                  ┌────────────────────┐    ┌────────────────────┐
                                  │   AI Summarizer &  │    │  Doctor Dashboard  │
                                  │   Triage Engine    │◄──►│    (Frontend UI)   │
                                  └────────────────────┘    └────────────────────┘
