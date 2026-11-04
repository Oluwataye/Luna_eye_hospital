# Graph Report - Luna Eyes Hospital  (2026-11-04)

## Corpus Check
- 151 files · ~206,484 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 42 file(s) not represented in the graph (top: .css 24, .bat 8, .vbs 5)

## Summary
- 1063 nodes · 2228 edges · 67 communities (46 shown, 21 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 56 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e8d59045`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- Patient
- User
- with
- server/index.ts
- Consultations.tsx
- validation.ts
- ThermalPrinterModal.tsx
- ErrorBoundary
- main.cjs
- electron-builder.yml
- whisper_service.py
- compilerOptions
- devDependencies
- dependencies
- compilerOptions
- Footer
- compilerOptions
- pre-push-check.cjs
- release-standalone.cjs
- scripts
- auth.usecase.ts
- insurance.ts
- server/package.json
- tag-release.cjs
- network-setup.cjs
- eslint.config.js
- ref_path
- check_users.cjs
- package.json
- 🏥 VisionCare EMR v2.0 — Comprehensive System Documentation
- redis.ts
- useBillingDraft.ts
- useGlobalDictationHotkey.ts
- dependencies
- vite
- express
- check_transactions.cjs
- zodToOpenAPI
- distributedLoginLimiter
- electron
- sanitizeObject
- scripts
- ActivityTimeline.tsx
- 🏥 VisionCare EMR — Ultimate Setup & Networking Guide
- check_patients.js
- @types/cors
- pkg
- useLiveVoiceWebSocket.ts
- tsconfig.json
- start-visioncare.sh
- stop-visioncare.sh
- NotificationPanel.tsx
- Luna Eye Hospital - Developer Deployment Notes
- CLAUDE.md
- GEMINI.md
- constants.ts
- executeTransactionInsert

## God Nodes (most connected - your core abstractions)
1. `react` - 73 edges
2. `useNotification()` - 60 edges
3. `lucide-react` - 50 edges
4. `useAuth()` - 42 edges
5. `LoadingSpinner()` - 39 edges
6. `api` - 37 edges
7. `App()` - 35 edges
8. `formatDateStandard()` - 31 edges
9. `react-router-dom` - 26 edges
10. `Patient` - 24 edges

## Surprising Connections (you probably didn't know these)
- `Layout()` --calls--> `Footer()`  [EXTRACTED]
  src/App.tsx → src/components/Footer.tsx
- `HotkeyActivator()` --calls--> `useGlobalDictationHotkey()`  [EXTRACTED]
  src/App.tsx → src/hooks/useGlobalDictationHotkey.ts
- `App()` --calls--> `Billing()`  [EXTRACTED]
  src/App.tsx → src/pages/Billing.tsx
- `AdminOverrideModal()` --calls--> `useNotification()`  [EXTRACTED]
  src/components/AdminOverrideModal.tsx → src/context/NotificationContext.tsx
- `PrintConsultation()` --calls--> `Footer()`  [EXTRACTED]
  src/components/PrintConsultation.tsx → src/components/Footer.tsx

## Import Cycles
- None detected.

## Communities (67 total, 21 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.05
Nodes (114): RFC-4180, lucide-react, react, react-router-dom, api, API_BASE_URL, _pending, request() (+106 more)

### Community 1 - "Patient"
Cohesion: 0.06
Nodes (12): express, FamilyController, getParam(), PatientController, FamilyRepositorySqlite, PatientRepositorySqlite, Family, Patient (+4 more)

### Community 2 - "User"
Cohesion: 0.08
Nodes (12): jsonwebtoken, jsonwebtoken@^9.0.3, AuthController, parseCookies(), UserRepositorySqlite, User, IUserRepository, createAuthMiddleware() (+4 more)

### Community 3 - "with"
Cohesion: 0.05
Nodes (39): name, runs-on, steps, default, description, required, type, GITHUB_TOKEN (+31 more)

### Community 4 - "server/index.ts"
Cohesion: 0.05
Nodes (30): ALL_IPS, allowedOrigins, apiRouter, app, authController, authMiddleware, authUseCase, broadcastToClients() (+22 more)

### Community 5 - "Consultations.tsx"
Cohesion: 0.12
Nodes (21): LiveTranscribePanel(), LiveTranscribePanelProps, QuickRecordPanel(), QuickRecordPanelProps, SpeechRecognitionErrorEvent, SpeechRecognitionEvent, SpeechRecognitionInstance, useSpeechRecognition() (+13 more)

### Community 6 - "validation.ts"
Cohesion: 0.11
Nodes (22): AdminPasswordSchema, AuditLogQuerySchema, BillingSearchQuerySchema, CategoryQuerySchema, ChangePasswordSchema, CreateFamilySchema, CreatePatientSchema, CreateTransactionSchema (+14 more)

### Community 7 - "ThermalPrinterModal.tsx"
Cohesion: 0.16
Nodes (26): Props, ThermalPrinterModal(), Billing(), BillingSession, createDefaultSession(), buildEscposReceipt(), centerText(), encodeAscii() (+18 more)

### Community 8 - "ErrorBoundary"
Cohesion: 0.22
Nodes (3): ErrorBoundary, Props, State

### Community 9 - "main.cjs"
Cohesion: 0.11
Nodes (20): additionalData, { app, BrowserWindow, Tray, Menu }, cleanUp(), fs, getFreePort(), gotTheLock, http, isPortFree() (+12 more)

### Community 10 - "electron-builder.yml"
Cohesion: 0.09
Nodes (22): appId, directories, output, extraResources, filter, from, to, files (+14 more)

### Community 11 - "whisper_service.py"
Cohesion: 0.14
Nodes (8): clean_clinical_text(), get_hardware_info(), health(), list_models(), load_engine(), stream_transcribe(), switch_model(), transcribe()

### Community 12 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 13 - "devDependencies"
Cohesion: 0.10
Nodes (21): nodemon, tsx, @types/bcryptjs, @types/compression, @types/express, @types/jsonwebtoken, @types/multer, @types/node-cron (+13 more)

### Community 14 - "dependencies"
Cohesion: 0.11
Nodes (18): compression, cors, express-rate-limit, helmet, node-cron, sqlite3, @types/ws, ws (+10 more)

### Community 15 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, ignoreDeprecations, module, moduleResolution (+9 more)

### Community 16 - "Footer"
Cohesion: 0.16
Nodes (13): Footer(), PrintConsultation(), PrintConsultationProps, PrintDischarge(), PrintDischargeProps, PrintInvestigation(), PrintInvestigationProps, fmt() (+5 more)

### Community 17 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 18 - "pre-push-check.cjs"
Cohesion: 0.21
Nodes (12): args, checkBranchEligibility(), checkEnvironmentBypass(), { execSync }, fs, getChangedFiles(), getTargetPushInfo(), isDryRun (+4 more)

### Community 19 - "release-standalone.cjs"
Cohesion: 0.21
Nodes (12): EXE_PATH, { execSync }, fs, main(), path, RELEASE_DIR, ROOT_DIR, run() (+4 more)

### Community 20 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, dev, dev:all, electron:build, electron:build-exe, electron:start, lint (+5 more)

### Community 21 - "auth.usecase.ts"
Cohesion: 0.33
Nodes (5): bcryptjs, bcryptjs@^3.0.3, bcrypt, db, sqlite3

### Community 22 - "insurance.ts"
Cohesion: 0.05
Nodes (46): multer, server, startAudioCleanupJob(), multer@^2.1.1, insuranceRouter, LEGAL_TRANSITIONS, LOCKED_STATUSES, REASON_REQUIRED (+38 more)

### Community 23 - "server/package.json"
Cohesion: 0.15
Nodes (12): dotenv, zod, author, bin, dotenv@^17.4.2, zod@^4.4.3, description, keywords (+4 more)

### Community 24 - "tag-release.cjs"
Cohesion: 0.21
Nodes (11): bumpJsonVersion(), checkCleanWorkingTree(), { execSync }, fs, main(), parseVersion(), path, PKG_PATH (+3 more)

### Community 25 - "network-setup.cjs"
Cohesion: 0.20
Nodes (6): configureAppServer(), { execSync }, fs, getLanIp(), os, path

### Community 26 - "eslint.config.js"
Cohesion: 0.15
Nodes (12): eslint@^10.2.1, @eslint/js@^10.0.1, eslint-plugin-react-hooks@^7.1.1, eslint-plugin-react-refresh@^0.5.2, globals@^17.5.0, typescript-eslint@^8.58.2, eslint, @eslint/js (+4 more)

### Community 27 - "ref_path"
Cohesion: 0.18
Nodes (8): db, dbPath, path, sqlite3, db, dbPath, path, sqlite3

### Community 28 - "check_users.cjs"
Cohesion: 0.40
Nodes (4): db, dbPath, path, sqlite3

### Community 29 - "package.json"
Cohesion: 0.13
Nodes (20): devDependencies, concurrently@^10.0.6, cross-env@^10.1.0, electron-builder@^26.8.1, @types/node@^24.12.2, @types/react@^19.2.14, @types/react-dom@^19.2.3, typescript@~6.0.2 (+12 more)

### Community 30 - "🏥 VisionCare EMR v2.0 — Comprehensive System Documentation"
Cohesion: 0.05
Nodes (41): 10. Backup, Disaster Recovery & Maintenance, 1. Automated Ophthalmic Drug Safety & Contraindication Guard, 1. Executive Summary & Clinical Scope, 2. High-Level Architecture, 2. Standard Prescription Regimen Presets (`OPHTHALMIC_REGIMENS`), 3. Follow-Up Date Quick-Pill Calculator (`FOLLOW_UP_PILLS`), 3. Technology Stack, 4. Consultation Completeness Auditor (+33 more)

### Community 32 - "useBillingDraft.ts"
Cohesion: 0.36
Nodes (7): BillingDraft, CartItem, clearBillingDraft(), EMPTY_DRAFT, loadBillingDraft(), saveDraft(), useBillingDraft()

### Community 33 - "useGlobalDictationHotkey.ts"
Cohesion: 0.29
Nodes (5): DEFAULT_HOTKEY, HOTKEY_STORAGE_KEY, HotkeyConfig, loadHotkeyConfig(), useGlobalDictationHotkey()

### Community 34 - "dependencies"
Cohesion: 0.33
Nodes (6): dependencies, lucide-react@^1.14.0, react@^19.2.5, react-hook-form@^7.75.0, react-router-dom@^7.14.2, react-hook-form

### Community 35 - "vite"
Cohesion: 0.40
Nodes (4): vite@^8.0.10, @vitejs/plugin-react@^6.0.1, vite, @vitejs/plugin-react

### Community 37 - "check_transactions.cjs"
Cohesion: 0.40
Nodes (4): db, dbPath, path, sqlite3

### Community 38 - "zodToOpenAPI"
Cohesion: 0.67
Nodes (4): getOpenAPIDoc(), mapQueryParameters(), registerSwaggerDocs(), zodToOpenAPI()

### Community 39 - "distributedLoginLimiter"
Cohesion: 0.70
Nodes (5): apiLimiter, distributedLoginLimiter(), getClientIp(), isLocalhost(), loginLimiter

### Community 40 - "electron"
Cohesion: 0.50
Nodes (3): { contextBridge, ipcRenderer }, electron@^42.3.3, electron

### Community 41 - "sanitizeObject"
Cohesion: 0.50
Nodes (4): deepClone(), sanitizeInput(), sanitizeObject(), sanitizeString()

### Community 42 - "scripts"
Cohesion: 0.50
Nodes (4): scripts, build, dev, start

### Community 44 - "🏥 VisionCare EMR — Ultimate Setup & Networking Guide"
Cohesion: 0.05
Nodes (38): 1. How It Works, 1. Supported Connection Types, 1. The One-Command Rebuild, 2. How to Configure Your Printer, 2. Publishing an Official Station Release, 2. The Push-to-Talk Hotkey, 3. Customizing the Hotkey & AI Settings, Daily Backup Method (Recommended): (+30 more)

### Community 47 - "pkg"
Cohesion: 0.67
Nodes (3): pkg, assets, targets

### Community 61 - "NotificationPanel.tsx"
Cohesion: 0.25
Nodes (5): react-dom@^19.2.5, react-dom, Notification, NotificationPanelProps, TooltipProps

### Community 62 - "Luna Eye Hospital - Developer Deployment Notes"
Cohesion: 0.29
Nodes (6): CRITICAL: Refreshing Changes, Full System Architecture & Module Reference, Improved Development Workflow, Luna Eye Hospital - Developer Deployment Notes, Mandatory Deployment Sequence, Verification

### Community 67 - "executeTransactionInsert"
Cohesion: 0.67
Nodes (3): executeTransactionInsert(), checkDone(), logAudit()

## Knowledge Gaps
- **1 isolated node(s):** `RFC-4180`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 470 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `electron` connect `electron` to `main.cjs`, `package.json`?**
  _High betweenness centrality (0.306) - this node is a cross-community bridge._
- **What connects `RFC-4180` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.053113175094599244 - nodes in this community are weakly interconnected._
- **Why does `react` connect `App.tsx` to `useBillingDraft.ts`, `useGlobalDictationHotkey.ts`, `dependencies`, `Consultations.tsx`, `ThermalPrinterModal.tsx`, `ErrorBoundary`, `ActivityTimeline.tsx`, `Footer`, `useLiveVoiceWebSocket.ts`, `NotificationPanel.tsx`, `useDebounce.ts`, `package.json`?**
  _High betweenness centrality (0.196) - this node is a cross-community bridge._
- **Should `Patient` be split into smaller, more focused modules?**
  _Cohesion score 0.05962059620596206 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App.tsx` to `dependencies`, `Consultations.tsx`, `ThermalPrinterModal.tsx`, `package.json`, `NotificationPanel.tsx`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Should `User` be split into smaller, more focused modules?**
  _Cohesion score 0.08292682926829269 - nodes in this community are weakly interconnected._