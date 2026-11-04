# 🏥 VisionCare EMR v2.0 — Comprehensive System Documentation
### Luna Eye Hospital • Enterprise Offline Ophthalmic Electronic Medical Record & CDS System

---

## 📑 Table of Contents
1. [Executive Summary & Clinical Scope](#1-executive-summary--clinical-scope)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Database Architecture & Schema](#4-database-architecture--schema)
5. [Core Clinical & Administrative Modules](#5-core-clinical--administrative-modules)
   - [5.1 User Authentication & Role-Based Access Control (RBAC)](#51-user-authentication--role-based-access-control-rbac)
   - [5.2 Patient Registration & Queue Management](#52-patient-registration--queue-management)
   - [5.3 Triage & Nursing Vital Signs](#53-triage--nursing-vital-signs)
   - [5.4 Specialized Ophthalmic Consultations (12 Core Sections)](#54-specialized-ophthalmic-consultations-12-core-sections)
   - [5.5 Clinical Decision Support (CDS) & Safety Guards](#55-clinical-decision-support-cds--safety-guards)
   - [5.6 Bilingual Patient Handout & Pictographic Schedule Generator](#56-bilingual-patient-handout--pictographic-schedule-generator)
   - [5.7 Pharmacy & Inventory Management](#57-pharmacy--inventory-management)
   - [5.8 Billing, Cashier Desk & Thermal POS Receipt Printing](#58-billing-cashier-desk--thermal-pos-receipt-printing)
   - [5.9 Inpatient Admissions & Ward Management](#59-inpatient-admissions--ward-management)
   - [5.10 Investigations & Laboratory Tracking](#510-investigations--laboratory-tracking)
   - [5.11 Audit Trails, Security & System Logs](#511-audit-trails-security--system-logs)
6. [Hardware Integrations](#6-hardware-integrations)
   - [6.1 ESC/POS Thermal Receipt Printing (80mm / 58mm)](#61-escpos-thermal-receipt-printing-80mm--58mm)
   - [6.2 Local AI Voice Dictation Engine (Faster-Whisper)](#62-local-ai-voice-dictation-engine-faster-whisper)
7. [API Specification & Data Contracts](#7-api-specification--data-contracts)
8. [Standalone Packaging & Deployment Pipeline](#8-standalone-packaging--deployment-pipeline)
9. [Local Area Network (LAN) & Multi-Station Topology](#9-local-area-network-lan--multi-station-topology)
10. [Backup, Disaster Recovery & Maintenance](#10-backup-disaster-recovery--maintenance)

---

## 1. Executive Summary & Clinical Scope

**VisionCare EMR** is an enterprise-grade, offline-first Electronic Medical Record (EMR), Clinical Decision Support (CDS), Practice Management, and Point-of-Sale (POS) system engineered specifically for **Luna Eye Hospital** (Minna, Niger State, Nigeria).

Ophthalmic practices feature unique clinical requirements that general hospital software cannot accommodate:
- **Bilateral Ocular Documentation**: Independent documentation of Right Eye (OD) and Left Eye (OS) for visual acuity, slit lamp findings, lens staging, intraocular pressure (IOP), and funduscopy.
- **High-Throughput Clinical Workflows**: Fast patient turnover requiring 1-click clinical presets, keyboard shortcut navigation, and voice dictation.
- **Safety Criticality**: Real-time safeguards against contraindications (e.g., prescribing topical beta-blockers to asthmatic patients or unsupervised topical steroids in corneal ulcers).
- **Patient Diversity & Literacy**: Northern Nigerian patient demographics require discharge instructions in both **English and Hausa**, complemented by pictographic dosing schedules (Morning, Afternoon, Evening, Bedtime) for elderly and low-literacy patients.
- **100% Offline Resilience**: Complete immunity to municipal internet outages and power interruptions via a zero-cloud standalone architecture operating over local Wi-Fi or Ethernet LAN.

---

## 2. High-Level Architecture

The system operates as a client-server architecture packaged into a single binary executable or run directly from source.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   HOSPITAL LAN CLIENTS                                  │
│   (Reception Desk, Consultation Rooms 1-3, Optometry Suite, Pharmacy, Cashier Desk)   │
│                                                                                         │
│     Google Chrome / Microsoft Edge / Safari (Any PC, Mac, iPad, Android Tablet)        │
│                                           │                                             │
└───────────────────────────────────────────┼─────────────────────────────────────────────┘
                                            │ HTTP / WebSocket (Port 80 / 3200 / 8765)
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           CENTRAL SERVER / MAIN CLINIC PC                               │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │                    VisionCare-EMR.exe (Standalone Runtime)                        │  │
│  │                                                                                   │  │
│  │  ┌──────────────────────────┐             ┌────────────────────────────────────┐  │  │
│  │  │   Vite React Frontend    │             │   Express.js REST & WS Engine      │  │  │
│  │  │   - High-Density UI      │ ◄──────────►│   - Auth & Session Middleware      │  │  │
│  │  │   - 12-Section Chart     │             │   - CDS & Audit Interceptors       │  │  │
│  │  │   - Bilingual Generator  │             │   - Hardware ESC/POS Print Proxy   │  │  │
│  │  └──────────────────────────┘             └──────────────────┬─────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┼────────────────────┘  │
│                                                                 │                       │
│                                  ┌──────────────────────────────┴────────────────────┐  │
│                                  ▼                                                   ▼  │
│                     ┌───────────────────────────┐         ┌──────────────────────────┐  │
│                     │   SQLite 3 Relational DB  │         │  Faster-Whisper AI Scribe │  │
│                     │   (luna_eye_hospital.db)  │         │  (Port 8765 WebSocket)   │  │
│                     │   - PRAGMA journal_mode=WAL│         │  - CPU/CUDA Offline STT  │  │
│                     │   - Foreign Key Integrity │         │  - Zero External Traffic │  │
│                     └───────────────────────────┘         └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### Frontend Architecture
- **Framework**: React 19 with TypeScript.
- **Bundler & Dev Server**: Vite 8 / Rolldown compiler with Hot Module Replacement (HMR).
- **Styling**: Tailored Vanilla CSS Design System with curated medical tokens:
  - Deep Navy / Slate neutral surfaces (`#0f172a`, `#1e293b`, `#f8fafc`).
  - Royal Blue primary accents (`#2563eb`, `#1d4ed8`).
  - Emerald Green positive & discharge accents (`#059669`, `#10b981`).
  - Amber / Red clinical alert boundaries (`#f59e0b`, `#ef4444`).
- **Icons**: Lucide React.
- **Voice Integration**: Native Web Audio API with downsampling to 16kHz PCM mono for real-time WebSocket streaming.
- **Hardware Communication**:
  - WebUSB API for direct thermal printer connection.
  - Raw TCP Socket relay via Node.js backend on Port 9100.

### Backend Architecture
- **Server Runtime**: Node.js v18/v20 with TypeScript.
- **Web Framework**: Express.js with custom async route handlers and JSON validation schemas.
- **Real-Time Layer**: `ws` WebSocket server for live dictation streaming and cross-station clinical triage status updates.
- **Database Engine**: Embedded `sqlite3` driver with write-ahead logging (`WAL`), foreign keys enforced, and parameterized SQL queries preventing SQL injection.
- **Security & Crypto**: `bcryptjs` password hashing, token/cookie-based session validation, and strict sanitization.

### Standalone Packaging
- **Packager**: `pkg` (node18-win-x64 target).
- **Binary Output**: Single-file standalone executable `packaged-release/VisionCare-EMR.exe` (approx. 61.7 MB).
- **Daemon Controller**: VBScript launchers (`start-visioncare-silent.vbs`, `StopVisionCareEMR.vbs`) for background execution without command prompt consoles.

---

## 4. Database Architecture & Schema

The underlying database `luna_eye_hospital.db` is organized into normalized relational tables:

```
  ┌──────────────┐         ┌──────────────┐         ┌────────────────────┐
  │   patients   │1       *│    visits    │1       1│   consultations    │
  │--------------│─────────│--------------│─────────│--------------------│
  │ id (PK)      │         │ id (PK)      │         │ id (PK)            │
  │ file_number  │         │ patient_id FK│         │ visit_id FK        │
  │ full_name    │         │ visit_date   │         │ va_od_unaided_dv   │
  │ phone, dob   │         │ status       │         │ iop_od, iop_os     │
  │ allergies    │         │ queue_type   │         │ as_cornea_od...    │
  └──────────────┘         └──────┬───────┘         │ diagnosis_primary  │
                                  │                 │ plan_followup_date │
                                  │                 └────────────────────┘
                   ┌──────────────┴──────────────┬──────────────────────┐
                   │1                           *│1                    *│
                   ▼                             ▼                      ▼
          ┌─────────────────┐           ┌─────────────────┐    ┌─────────────────┐
          │     triage      │           │    invoices     │    │  prescriptions  │
          │-----------------│           │-----------------│    │-----------------│
          │ id (PK)         │           │ id (PK)         │    │ id (PK)         │
          │ visit_id FK     │           │ visit_id FK     │    │ visit_id FK     │
          │ bp_systolic     │           │ total_amount    │    │ drug_name       │
          │ bp_diastolic    │           │ amount_paid     │    │ dosage, freq    │
          │ pulse_rate      │           │ payment_status  │    │ duration, route │
          │ temperature     │           │ receipt_number  │    │ dispensed_qty   │
          └─────────────────┘           └─────────────────┘    └─────────────────┘
```

### Key Tables Summary
| Table Name | Purpose & Contents |
|---|---|
| `users` | Staff credentials, roles (`admin`, `doctor`, `optometrist`, `nurse`, `cashier`, `pharmacy`), full names, and active status. |
| `patients` | Master patient demographic index, file number (`#0023/26/LEH`), NIN, phone, allergies, and emergency contacts. |
| `visits` | Clinical encounter records, stage lifecycle (`registered` ➔ `triaged` ➔ `consulting` ➔ `completed`), and queue timestamps. |
| `triage` | Pre-consultation vitals (Blood pressure, pulse, temperature, weight, triage notes). |
| `consultations` | Full 12-section ophthalmic clinical chart (VA, Slit Lamp, Refraction, Funduscopy, CVF, Pachymetry, Investigations, Diagnosis, Plan, Surgery). |
| `prescriptions` | Line items prescribed in Section 9 (Drug name, strength, frequency, duration, route, instructions). |
| `invoices` & `invoice_items` | Financial billing transactions, service charges, drug costs, payment status, and cashier attribution. |
| `inventory_items` | Pharmacy formulary, batch numbers, pack sizes, stock on hand, reorder thresholds, and unit prices. |
| `audit_logs` | Tamper-evident trail tracking every login, chart modification, prescription edit, invoice creation, and receipt reprint. |

---

## 5. Core Clinical & Administrative Modules

### 5.1 User Authentication & Role-Based Access Control (RBAC)
- Multi-user authentication protecting clinical records.
- Session timeout and secure password hashing.
- Role-based route and permission enforcement:
  - **Doctor / Consultant**: Full chart write access, surgical advising, prescription authorization, completeness audit override.
  - **Optometrist**: Refraction, visual acuity, slit lamp exam, confrontation fields, spectacle prescription.
  - **Ophthalmic Nurse**: Triage vitals intake, dilation drop tracking, pre-op counselor notes.
  - **Cashier / Billing**: Invoice collection, thermal receipt issuance, payment reconciliations.
  - **Pharmacist**: Prescription dispensing verification, drug stock balance adjustments.
  - **Administrator**: User provisioning, role assignment, audit log inspection, AI voice model configuration.

### 5.2 Patient Registration & Queue Management
- **Searchable Patient Master**: Instant lookup by File Number, Patient Name, Phone Number, or National Identity Number (NIN).
- **Auto-Incrementing File Number Generator**: Follows standard hospital convention (e.g., `#0023/26/LEH`).
- **Live Waiting Queue**: Real-time counter showing patients waiting at Triage, Consultation, Pharmacy, and Cashier.

### 5.3 Triage & Nursing Vital Signs
- Fast recording of:
  - Blood Pressure (Systolic & Diastolic) with automated AHA hypertension classification (Normal, Elevated, Stage 1, Stage 2, Hypertensive Crisis).
  - Pulse rate (bpm) with tachycardia/bradycardia flags.
  - Body temperature (°C) with pyrexia warnings.
  - Body weight (kg).
- Triage flags directly sync to the Doctor's consultation screen via the **`VIEW TRIAGE`** popover modal.

---

### 5.4 Specialized Ophthalmic Consultations (12 Core Sections)

The Consultations module contains a comprehensive, 12-part clinical chart accessible in both **Tabbed** mode and **Continuous Scrollspy** mode:

```
[ CONSULTATION ACTION RIBBON ] 
◄ [VIEW TRIAGE] [VIEW HISTORY] [PRINT SUMMARY] [PATIENT LEAFLET] [DOWNLOAD PDF] | [TABBED][CONTINUOUS] [Alt+1..9] | [SAVE DRAFT] [FINALIZE VISIT] ►
```

#### Section Breakdown:
1. **Section A: History & Chief Complaint**:
   - Chief complaint with voice dictation (`<VoiceInputWrapper>`).
   - History of Present Illness (HPI).
   - Ocular, Medical, Drug, Allergy, and Family History.
2. **Section B: Vital Signs Review**:
   - Baseline review of triage metrics with 1-click historical compare.
3. **Section 1: Visual Acuity (VA)**:
   - Bilateral Distance Vision (DV) and Near Vision (NV) (Unaided & Aided).
   - Pinhole (PH) recording.
   - **"Normal Distance & Near Baseline" 1-Click Preset**: Populates `6/6 OD/OS` and `N6 NV` in one click.
   - Single-eye Quick-Stamp chips (`6/6 & N6 OD` / `6/6 & N6 OS`).
4. **Section 2: Ocular Examination**:
   - Bilateral Slit Lamp Biomicroscopy: Lids, Conjunctiva, Cornea, Anterior Chamber (Depth, Cells, Flare), Iris, Lens Staging (NS 1-4+, Cortical, PSC, Pseudophakic), Vitreous.
   - Intraocular Pressure (IOP): Non-contact Tonometer / Goldmann Applanation with time of measurement.
   - **"Normal Exam Preset" Chip**: Populates physiological findings and normotensive 14 mmHg IOP bilaterally.
5. **Section 3: Refraction**:
   - Manifest refraction for glasses prescription: Sphere, Cylinder, Axis, Near Add, Prism, Pupillary Distance (PD).
6. **Section 4: Dilated Funduscopy**:
   - Mydriatic agent logging (Tropicamide 1%, Cyclopentolate), time instilled, pupillary adequacy.
   - Posterior segment evaluation: Optic Disc Cup-to-Disc Ratio (CDR 0.1-1.0), Margins, Color, Macula, AV ratio, Retina periphery.
   - **"Normal Fundus Preset" Chip**: Sets distinct margins, 0.3 CDR, healthy macula reflex.
7. **Section 5: Confrontation Visual Fields (CVF)**:
   - Rapid four-quadrant peripheral field assessment (Full vs. Defect OD/OS).
8. **Section 6: Pachymetry**:
   - Central Corneal Thickness (CCT in µm) with IOP correction factor.
9. **Section 7: Investigations**:
   - Fasting/Random Blood Sugar (FBS/RBS), HbA1c, Retrovirology Screening (RVS).
   - Ophthalmic Special Tests (OCT Macula/RNFL, Visual Field Humphrey HFA, B-Scan Ultrasonography).
10. **Section 8: Clinical Diagnosis**:
    - Primary Clinical Diagnosis (Standardized Ophthalmic ICD list).
    - Secondary diagnosis, differential diagnosis, and clinical severity staging (Mild / Moderate / Severe).
11. **Section 9: Treatment Plan & Regimens**:
    - Spectacle prescription details.
    - Prescription Regimen Presets with Automated Safety Guard.
    - Follow-Up Date Quick-Pill Calculator with Sunday-skipping logic.
12. **Section 10: Surgery & Admission**:
    - Surgical procedure scheduling (Cataract SICS/Phaco, Trabeculectomy, Pterygium excision).
    - Surgeon assignment, urgency (Elective/Urgent/Emergency), pre-op counseling log, and ward admission orders.

---

### 5.5 Clinical Decision Support (CDS) & Safety Guards

To protect patients and maintain clinical quality, VisionCare EMR integrates multiple automated decision support engines:

#### 1. Automated Ophthalmic Drug Safety & Contraindication Guard
- Evaluates prescribed medications against the patient's documented medical history and allergies in real time.
- **Rules Enforced**:
  - **Beta-Blocker Contraindication**: If patient history contains *Asthma, COPD, or Bradycardia* and the doctor prescribes *Timolol (0.5% or 0.25%)*, an urgent alert is triggered with a 1-click substitution recommendation to *Betaxolol 0.25%* (cardioselective) or *Latanoprost 0.005%* (prostaglandin analog).
  - **Steroid Shield Guard**: If the cornea has an epithelial ulcer/defect and a topical steroid (*Prednisolone*, *Dexamethasone*) is prescribed without broad-spectrum antibiotic cover, an alert warns of corneal melting risk.
  - **Allergy Guard**: Cross-references penicillin, sulfa, and ciprofloxacin allergies against active pharmaceutical ingredients.

#### 2. Standard Prescription Regimen Presets (`OPHTHALMIC_REGIMENS`)
- One-click smart population of standard protocols:
  - *Post-Operative Cataract Protocol*: G. Tobramycin 0.3% QDS (10 days) + G. Prednisolone Acetate 1% QDS (4 weeks) + G. Nepafenac 0.1% TDS (3 weeks).
  - *Dry Eye Protocol*: G. Carboxymethylcellulose 0.5% QDS (1 month) + Night Lubricating Eye Gel (Carbomer 0.2%) Nocte (1 month).
  - *Primary Open Angle Glaucoma Protocol*: G. Latanoprost 0.005% Nocte (1 month) + G. Timolol 0.5% BD (1 month).
  - *Microbial Keratitis Protocol*: G. Moxifloxacin 0.5% 2-hourly + G. Ciprofloxacin 0.3% 2-hourly.
  - *Allergic Conjunctivitis Protocol*: G. Olopatadine 0.1% BD (1 month) + G. Fluorometholone 0.1% TDS taper (2 weeks).

#### 3. Follow-Up Date Quick-Pill Calculator (`FOLLOW_UP_PILLS`)
- Instant calculation of review dates: `+1 Week`, `+2 Weeks`, `+1 Month`, `+3 Months`, and `SOS`.
- **Sunday-Skipping Clinical Intelligence**: Outpatient clinics do not operate on Sundays. If a calculated date falls on Sunday, the calculator automatically shifts it to **Monday morning** and displays the adjusted target days and calendar weekday name.
- Links directly to the **Outpatient Follow-Up Scheduler** modal with notes synced to reception checkout receipts.

#### 4. Consultation Completeness Auditor
- Acts as a pre-discharge quality gate before finalizing an encounter:
  - **Critical Checks**: Flags blank chief complaints or missing primary diagnoses.
  - **Recommended Checks**: Encourages documentation of baseline visual acuity, IOP, and follow-up plans.
  - Provides a **Clinical Override** option with audit logging for acute emergency cases.

---

### 5.6 Bilingual Patient Handout & Pictographic Schedule Generator

Northern Nigerian clinic operations serve diverse linguistic demographics. VisionCare EMR features an integrated **Patient Leaflet Generator**:
- **Smart Dosing Slot Parser (`getDropDosingSlots`)**:
  - Automatically translates medical frequencies (`QDS`, `TDS`, `BD`, `NOCTE`, `MANE`) into intuitive pictographic time slots:
    - 🌅 **Morning / Safiya** (08:00 AM)
    - ☀️ **Afternoon / Rana** (01:00 PM)
    - 🌇 **Evening / Yamma** (06:00 PM)
    - 🌙 **Bedtime / Dare** (09:00 PM)
  - Automatically differentiates between eye drops (`1 Drop / Ɗigo 1`) and ointments/gels (`1 Line / Layi 1`).
- **Interactive Multi-Language Switching**:
  - `Bilingual (EN + HA)`: Dual English and Hausa instructions side-by-side.
  - `English Only`: Full English instructions.
  - `Hausa (Harshen Hausa)`: Pure Hausa instructions.
- **Illustrated 2x2 Ocular Care Guidelines**:
  1. 💧 **5-Minute Spacing Rule / Dokar Minti Biyar**: Waiting 5 minutes between different bottles.
  2. 🧼 **Clean Hands & Bottle Tip / Wanke Hannaye da Tsabta**: Hand hygiene; preventing dropper tip contact with lashes or skin.
  3. 👁️ **Punctal Occlusion / Matse Kusurwar Ido**: Pressing the tear duct for 2 minutes to minimize systemic absorption.
  4. 🚨 **Emergency Warning / Gargadin Gaggawa**: Red-flag symptoms (severe pain, sudden vision loss, acute redness) demanding immediate clinic return.
- **Dedicated Print Isolation**: `#leaflet-print-area` prints clean patient handouts on standard A4 thermal or laser printers without exposing clinician-internal chart notes.

---

### 5.7 Pharmacy & Inventory Management
- Real-time inventory tracking for ophthalmic drops, ointments, surgical packs, consumables, and spectacles.
- Expiration date monitoring and low-stock threshold alerts.
- Automatic inventory decrementing upon cashier payment confirmation.

### 5.8 Billing, Cashier Desk & Thermal POS Receipt Printing
- Consolidated billing for consultations, diagnostic tests, medications, surgical procedures, and optical eyewear.
- Support for split payments, cash, POS card payments, and bank transfers.
- Cryptographically stamped receipt reprinting with strict supervisor audit authorization.

### 5.9 Inpatient Admissions & Ward Management
- Inpatient bed assignment and bed occupancy tracking.
- Ward round progress charting and daily nursing observation logs.
- Automated discharge summary compiling surgical notes, medications, and follow-up schedules.

### 5.10 Investigations & Laboratory Tracking
- Electronic test requisitioning directly from Section 7 of the consultation workspace.
- Diagnostic result entry with abnormal range flags.
- Real-time result availability badges notifying clinicians in the consultation queue.

### 5.11 Audit Trails, Security & System Logs
- Immutable audit logging tracking every transaction, user access, and medical record change.
- Tracks `user_id`, IP address, action type, timestamp, and entity affected.
- Exportable audit reports for administrative governance.

---

## 6. Hardware Integrations

### 6.1 ESC/POS Thermal Receipt Printing (80mm / 58mm)
VisionCare EMR bypasses standard, slow browser print dialogs by transmitting direct ESC/POS binary control streams to thermal receipt printers.

- **Supported Protocols**:
  - **Network TCP Socket**: Sends raw ESC/POS bytes over Port 9100 directly to the printer's LAN IP address.
  - **WebUSB API**: Native browser USB device claim and bulk transfer endpoints for cashier USB printers.
  - **Browser Fallback**: Automatic failover to standard HTML printable slips if hardware is offline.
- **Printer Formatting Engine (`src/utils/escpos.ts`)**:
  - Initializes printer with `ESC @`.
  - Double-width / double-height bold headers for Luna Eye Hospital banner.
  - Left/Right column alignment formatting for itemized billing rows.
  - Generates ASCII dashed dividers.
  - Appends partial/full paper cut command (`GS V 66 0`).

### 6.2 Local AI Voice Dictation Engine (Faster-Whisper)
- **Engine**: Local Python microservice executing `faster-whisper` (CTranslate2 implementation).
- **Communication Protocol**: WebSocket on `ws://localhost:8765/ws/transcribe`.
- **Audio Capture Pipeline**:
  - Captures microphone input via `navigator.mediaDevices.getUserMedia`.
  - Creates an `AudioContext` with an `AudioWorklet` or `ScriptProcessorNode`.
  - Downsamples native 44.1kHz/48kHz audio to **16,000 Hz, 16-bit PCM mono**.
  - Streams binary chunks over the WebSocket.
- **Privacy & Performance**:
  - **Zero Cloud Leakage**: Audio data never leaves the hospital server computer.
  - High transcription speed (<300ms latency) on standard CPUs with optional CUDA GPU acceleration.

---

## 7. API Specification & Data Contracts

The server exposes RESTful endpoints with consistent JSON envelope structures:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Core API Groups

| Endpoint Route | Method | Description |
|---|---|---|
| `/api/auth/login` | `POST` | Authenticate staff credentials; yields user profile and session cookie. |
| `/api/auth/logout` | `POST` | Terminate active user session. |
| `/api/patients` | `GET` | Search and retrieve patient records with query filters. |
| `/api/patients` | `POST` | Register a new patient and allocate hospital file number. |
| `/api/consultations/:visitId` | `GET` | Fetch full 12-section ophthalmic consultation chart for a visit. |
| `/api/consultations/:visitId` | `PUT` | Save draft or update clinical consultation record. |
| `/api/consultations/:visitId/finalize`| `POST` | Execute Completeness Audit, lock chart, and route to billing. |
| `/api/billing/invoices` | `POST` | Generate patient invoice from prescribed medications and tests. |
| `/api/billing/invoices/:id/pay` | `POST` | Record payment, trigger thermal print, and decrement inventory. |
| `/api/inventory` | `GET` | Retrieve pharmacy inventory list and stock balances. |
| `/api/reports/financial` | `GET` | Generate date-ranged financial revenue summaries. |
| `/api/voice/status` | `GET` | Check availability and warmup status of the Faster-Whisper service. |

---

## 8. Standalone Packaging & Deployment Pipeline

VisionCare EMR includes an automated single-command build pipeline configured in `scripts/release-standalone.cjs` and `package.json`:

```bash
npm run release:standalone
```

### Build Pipeline Execution Stages:
1. **Process Teardown**: Detects and terminates any active background `VisionCare-EMR.exe` processes to unlock Windows file handles.
2. **Frontend Compilation**: Executes `npm run build` (`tsc -b && vite build`) to generate the optimized production web assets in `dist/`.
3. **Backend Compilation**: Runs `npx tsc -p tsconfig.json` inside the `server/` directory to compile backend TypeScript to ECMAScript.
4. **Binary Packaging**: Invokes `pkg -t node18-win-x64 -o packaged-release/VisionCare-EMR.exe server/package.json` to pack the Node runtime and server code into a self-contained Windows executable.
5. **Asset Synchronization**: Copies `dist/`, `voice_config.json`, and the native SQLite3 binary (`node_sqlite3.node`) into `packaged-release/`.

---

## 9. Local Area Network (LAN) & Multi-Station Topology

VisionCare EMR is designed to run on a central host server with multiple clinical client machines connected across the hospital Wi-Fi or Ethernet switch.

### Network Configuration Matrix

| Machine / Station | Hardware | Access URL | Primary Responsibilities |
|---|---|---|---|
| **Main Server Station** | Desktop PC (Core i5+, 8GB+ RAM) | `http://localhost:3200` | Hosts database, runs executable, manages AI dictation. |
| **Reception Desk** | Laptop / Desktop | `http://[SERVER-IP]:3200` | Patient registration, search, queue dispatch. |
| **Consultation Room 1-3** | Doctor / Optometrist PCs | `http://[SERVER-IP]:3200` | 12-section eye exam, voice dictation, prescription leaflets. |
| **Nursing Station** | Laptop / Tablet | `http://[SERVER-IP]:3200` | Vitals intake, triage queuing, pupillary dilation tracking. |
| **Pharmacy Station** | Desktop / Tablet | `http://[SERVER-IP]:3200` | Medication dispensing, inventory stock receiving. |
| **Cashier / POS** | POS PC + Thermal Printer | `http://[SERVER-IP]:3200` | Invoice collection, ESC/POS silent receipt printing. |

### Firewall Rule
To allow LAN workstations to connect to the central server, the following port rule is configured:
```powershell
netsh advfirewall firewall add rule name="VisionCare EMR Web" dir=in action=allow protocol=TCP localport=80,3200,3201,3202,8765
```

---

## 10. Backup, Disaster Recovery & Maintenance

### Daily Database Backup
All hospital records reside in the single relational file:
👉 **`luna_eye_hospital.db`** (or in `packaged-release/luna_eye_hospital.db`).

- **Daily Backup Procedure**:
  1. Insert a designated external USB backup drive into the server PC.
  2. Copy `luna_eye_hospital.db` into a date-stamped folder on the USB drive (e.g., `Backups/LEH_2026-10-18.db`).
  3. Store off-site or in a secure fireproof location.

### Recovery Procedure
- If the server computer suffers an operating system failure:
  1. Copy the `Luna Eyes Hospital` directory onto any replacement Windows PC.
  2. Restore the latest `luna_eye_hospital.db` into the directory.
  3. Run `start-visioncare-silent.vbs`.
  4. Clinic operations resume immediately with zero record loss.

---

*Documentation Version 2.0 • Luna Eye Hospital • Minna, Niger State, Nigeria*
