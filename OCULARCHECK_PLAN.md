# OcularCheck AI — Master Project Plan

> **Purpose of this file:** the single source of truth for building OcularCheck AI step by step with OpenCode CLI (in VS Code) and Claude.
> Keep it in the repo root. Tick the checkboxes as you finish tasks.

---

## 0. How we will work (the workflow)

Every task in this plan has an ID like `P3-T2` and one of two types:

| Type | Meaning | What happens |
|---|---|---|
| 🤖 **[CODE]** | Code to be written by OpenCode | You tell Claude: *"Give me the prompt for P3-T2"*. Claude gives you a complete prompt. You paste it in OpenCode, review the diff, run the checks, commit. |
| 🧑 **[MANUAL]** | Something only you can do (installs, accounts, consoles, keys, devices) | You tell Claude: *"Give me the manual steps for P0-T4"*. Claude gives click-by-click steps (URL → login → exact button). |

**Loop for each coding task**

1. Create a branch: `git switch -c feat/p3-t2-short-name`
2. Paste the prompt into OpenCode. Use **Plan mode first** (read-only), approve the plan, then switch to Build mode.
3. Review every changed file (do not blindly accept).
4. Run the quality gate (see §4.4). All must pass.
5. Commit with Conventional Commits, push, open a PR (or merge locally if solo), tick the box here.
6. Come back to Claude with the result (or the error) and ask for the next task.

**One phase = one OpenCode session.** Start a fresh session per phase to keep context clean. `AGENTS.md` (created in P1) is what keeps OpenCode consistent across sessions.

> ⚠️ UI labels in third-party consoles (Firebase, Google Cloud, Kaggle…) change over time. If a button name differs from the steps Claude gives you, send Claude a screenshot and it will adapt.

---

## 1. Product scope

Mobile healthcare platform for early screening of ocular disease (Glaucoma, Cataract, Diabetic Retinopathy, plus Normal) from retinal fundus images.

**Roles:** Patient, Doctor.

**Features (from the spec)**
- Auth + roles (Patient / Doctor)
- AI retinal scan: real-time camera quality guidance → preprocessing → classification + confidence → **mandatory medical disclaimer**
- Accessibility & localization: Text-to-Speech guided UI, Arabic (RTL) / English (LTR), Dark / Light mode
- Patient: dashboard, medication & appointment reminders (push), GPS clinic finder, appointment booking with nearest doctor, downloadable PDF report, scan history/trends
- Doctor: patient queue, scan review (Confirm / Modify AI result), in-app chat (telemedicine)

### 1.1 Honest constraints (read these once)
1. **Phone cameras cannot photograph the retina** on their own. Real fundus images come from a fundus camera or a clip-on ophthalmoscope adapter. Our app therefore supports **(a)** camera capture through such an adapter and **(b)** upload of images from a clinic's fundus camera. The quality-check feature works on whatever image source is used.
2. **This is a screening aid, not a medical device.** Never present results as a diagnosis. Disclaimer is mandatory everywhere a result is shown (screen, PDF, notifications text).
3. **Model quality depends on data.** We will report sensitivity/specificity per class and reject non-fundus images instead of guessing.
4. **Health data is sensitive.** Treat everything as personal health information (Egypt Personal Data Protection Law No. 151 of 2020; GDPR if EU users). Consent, minimization, deletion on request, audit logs.

---

## 2. Technology decisions

> These are the recommended defaults. If you want a different stack, say so **before P1** — after that, changing it is expensive.

| Layer | Choice | Why |
|---|---|---|
| Mobile | **Flutter (Dart)**, Android first, iOS later | One codebase, excellent RTL/localization, camera/TTS/notification plugins, good testability |
| State mgmt | **Riverpod** | Compile-safe DI + state, easy to test |
| Navigation | **go_router** | Declarative, deep links, role-based redirects |
| Networking | **Dio** + interceptors | Token refresh, logging, certificate pinning later |
| Models | **freezed + json_serializable** | Immutable, generated, equatable |
| Backend API | **NestJS (TypeScript)** | Modular, DI built-in (SOLID-friendly), guards, pipes, WebSocket gateway |
| Database | **PostgreSQL** (+ PostGIS or Haversine for geo) via **Prisma** | Relational data, migrations, type safety |
| Cache / jobs | **Redis + BullMQ** | Reminder scheduling, rate-limit store |
| AI service | **Python FastAPI + ONNX Runtime** (model trained in PyTorch) | Separate service, independent scaling, fast CPU inference |
| Realtime chat | **Socket.IO** (NestJS gateway) + REST history | Simple, reliable, works with auth guards |
| Push | **Firebase Cloud Messaging** + local notifications | Reminders and chat |
| File storage | **S3-compatible bucket** (Cloudflare R2 / AWS S3 / MinIO local) | Retinal images never stored in the DB; signed URLs |
| PDF | Generated **server-side** (pdfkit) | Consistent, signed, includes disclaimer, no client tampering |
| Maps | **Google Maps SDK + Places API** (or OpenStreetMap as free alternative) | Clinic finder |
| CI | **GitHub Actions** | Lint, test, build, audit on every PR |
| Containers | **Docker + docker-compose** | Reproducible local env |

### 2.1 Repository layout (monorepo)

```
ocularcheck/
├── AGENTS.md                  # rules for OpenCode (created in P1)
├── OCULARCHECK_PLAN.md        # this file
├── docs/                      # ADRs, API docs, diagrams, threat model
├── design/                    # Stitch export (DESIGN.md + screens) — reference only
├── mobile/                    # Flutter app
├── backend/                   # NestJS API
├── ai-service/                # FastAPI inference + training notebooks
├── infra/                     # docker-compose, nginx, deployment configs
└── .github/workflows/
```

---

## 3. Architecture & SOLID

### 3.1 Flutter — Clean Architecture, feature-first

```
mobile/lib/
├── core/            # theme, l10n, router, network, error, utils, di
├── shared/          # reusable widgets (buttons, cards, disclaimer banner)
└── features/
    └── <feature>/            # auth, scan, dashboard, reminders, clinics, appointments, doctor, chat, reports, settings
        ├── domain/           # entities, repository INTERFACES, use cases (pure Dart, no Flutter imports)
        ├── data/             # DTOs, data sources (remote/local), repository IMPLEMENTATIONS, mappers
        └── presentation/     # screens, widgets, Riverpod notifiers/controllers
```
**Dependency rule:** `presentation → domain ← data`. Domain imports nothing from the other two.

### 3.2 NestJS — modular, layered

```
backend/src/
├── common/          # filters, guards, interceptors, pipes, decorators
├── config/          # typed, validated env config
├── infrastructure/  # prisma, redis, storage, fcm, ai-client (implementations behind interfaces)
└── modules/
    └── <module>/    # auth, users, scans, clinics, appointments, reminders, chat, reports, notifications, audit
        ├── <module>.controller.ts   # HTTP only: parse, delegate, respond
        ├── <module>.service.ts      # business logic (use-case level)
        ├── dto/                     # validated input/output
        ├── ports/                   # interfaces the service depends on
        └── <module>.module.ts
```

### 3.3 SOLID — how it is applied here (and what reviewers should check)

| Principle | Concrete rule in this project |
|---|---|
| **S** — Single Responsibility | One use case per class (`LoginUseCase`, `SubmitScanUseCase`). Controllers do HTTP only; services do business rules; repositories do persistence only. Widgets render; controllers hold state. |
| **O** — Open/Closed | New diagnosis class or new notification channel = **add** a class/strategy, not edit a switch statement. Use strategy/registry for classifiers, report sections, notification channels. |
| **L** — Liskov | Any `ScanRepository` implementation (remote, fake, cached) must be substitutable with no caller changes. Fakes in tests honor the same contract (same errors, same nullability). |
| **I** — Interface Segregation | Small ports: `TokenStorage`, `ImageClassifier`, `FileStorage`, `PushSender`. No "god" `ApiService`. |
| **D** — Dependency Inversion | High-level code depends on abstractions. Riverpod providers (Flutter) and Nest DI tokens (backend) bind interfaces → implementations in **one** composition root. |

**Other practices (mandatory):** DRY but not premature abstraction · KISS/YAGNI · composition over inheritance · immutability · explicit error types (`Result<T, Failure>` on mobile, typed exceptions + global filter on backend) · no business logic in UI · no `dynamic`/`any` · small functions · meaningful names · no magic strings (constants/enums) · every public behavior has a test.

---

## 4. Engineering standards

### 4.1 Git
- `main` is always releasable. Work in `feat/…`, `fix/…`, `chore/…` branches.
- **Conventional Commits:** `feat(scan): add quality check use case`.
- Small PRs (one task = one PR). Never commit secrets, `.env`, keystores, datasets, model weights > 100 MB (use Git LFS or external storage).

### 4.2 Code style
- **Dart:** `very_good_analysis` (or `flutter_lints` strict) · `dart format` · no analyzer warnings.
- **TypeScript:** `strict: true`, ESLint + Prettier, no `any`.
- **Python:** `ruff` + `black` + `mypy`, type hints everywhere.

### 4.3 Testing targets
| Layer | Tool | Target |
|---|---|---|
| Flutter domain/use cases | `flutter_test`, `mocktail` | ≥ 90% |
| Flutter widgets | widget tests + golden tests for key screens (EN/AR, light/dark) | critical screens |
| Flutter integration | `integration_test` | login → scan → result, booking, chat |
| Backend | Jest unit + Supertest e2e (against a test Postgres in Docker) | ≥ 80% services |
| AI service | pytest (contract + image-quality gate tests) | all endpoints |

### 4.4 Quality gate (must pass before every commit)
```bash
# mobile
cd mobile && dart format --set-exit-if-changed . && flutter analyze && flutter test
# backend
cd backend && npm run lint && npm run test && npm run build
# ai-service
cd ai-service && ruff check . && mypy . && pytest
```

### 4.5 Documentation
- **ADR** (Architecture Decision Record) in `docs/adr/` for each major decision (1 page each).
- OpenAPI/Swagger auto-generated by NestJS at `/api/docs` (dev only).

### 4.6 Ready-to-paste `AGENTS.md` (created in P1-T2)

```markdown
# OcularCheck AI — Agent Rules

## Project
Mobile (Flutter) + Backend (NestJS) + AI service (FastAPI). Monorepo. See OCULARCHECK_PLAN.md.

## Non-negotiable rules
1. Follow Clean Architecture + SOLID as described in OCULARCHECK_PLAN.md §3. Domain layer has no framework imports.
2. Depend on interfaces (ports); bind implementations only in the composition root (Riverpod providers / Nest modules).
3. Never use `dynamic` (Dart) or `any` (TS). Strict typing everywhere.
4. Never hardcode secrets, URLs, or user-facing strings. Config via env; strings via l10n (EN + AR, ARB files).
5. All UI must support RTL/LTR, light/dark, large text, and Semantics labels.
6. Any screen/PDF showing an AI result MUST include the medical disclaimer widget/section.
7. Every new behavior ships with tests. Do not delete or weaken tests to make them pass.
8. Validate all external input (DTOs with class-validator on backend). Never trust the client.
9. Never log tokens, passwords, or medical data (PII). Use structured logging.
10. Work only on the task described in the prompt. Do not refactor unrelated code. Ask when unclear.
11. Before finishing: run the quality gate (plan §4.4) and report the results.
12. Use Conventional Commits. Do not commit unless asked.

## Commands
- Mobile: `cd mobile && flutter analyze && flutter test`
- Backend: `cd backend && npm run lint && npm test && npm run build`
- AI: `cd ai-service && ruff check . && pytest`

## Design source
`design/stitch_eyeguard_ai_healthcare_platform/` (tokens in visionary_precision/DESIGN.md). Match colors, radii (cards 24px, inputs 8px, pill buttons), Inter (EN) / Cairo (AR).
```

---

## 5. Data model (initial)

```
User(id, email, password_hash, role[PATIENT|DOCTOR], full_name, locale, created_at)
PatientProfile(user_id, dob, sex, diabetes, hypertension, family_history_glaucoma, notes, consent_at)
DoctorProfile(user_id, license_no, specialty, clinic_id, verified_at)
Scan(id, patient_id, image_key, ai_label, ai_confidence, ai_probs_json, quality_score,
     status[AI_ONLY|SENT|CONFIRMED|MODIFIED], model_version, created_at)
ScanReview(id, scan_id, doctor_id, final_label, notes, created_at)
Clinic(id, name, address, lat, lng, phone)
Appointment(id, patient_id, doctor_id, clinic_id, starts_at, status, reason)
Reminder(id, patient_id, type[MEDICATION|APPOINTMENT], title, schedule(rrule/time), active)
Conversation(id, patient_id, doctor_id) · Message(id, conversation_id, sender_id, body, sent_at, read_at)
DeviceToken(id, user_id, fcm_token, platform)
RefreshToken(id, user_id, token_hash, family_id, expires_at, revoked_at)
AuditLog(id, actor_id, action, entity, entity_id, ip, created_at)
```

## 6. API surface (initial, versioned `/api/v1`)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `/auth/login` · `/auth/refresh` · `/auth/logout` |
| Me | `GET/PATCH /me` · `PUT /me/medical-history` · `POST /me/device-token` · `DELETE /me` (data deletion) |
| Scans | `POST /scans` (multipart) · `GET /scans` · `GET /scans/:id` · `POST /scans/:id/send` |
| Doctor | `GET /doctor/queue` · `POST /doctor/scans/:id/review` |
| Clinics | `GET /clinics/nearby?lat&lng&radius` |
| Appointments | `GET/POST /appointments` · `PATCH /appointments/:id` · `GET /doctors/:id/slots` |
| Reminders | CRUD `/reminders` |
| Chat | `GET /conversations` · `GET /conversations/:id/messages` · WebSocket `/chat` |
| Reports | `GET /scans/:id/report.pdf` |
| AI (internal) | `POST /v1/predict` · `POST /v1/quality` on ai-service (not public) |

---

## 7. Roadmap

### PHASE 0 — Environment setup  *(mostly manual)*
**Goal:** a machine where every tool runs.

- [ ] **P0-T1 🧑 Install core tools** — Git, VS Code, Node.js (current LTS), Docker Desktop, Python 3.11+, Java JDK 17, Android Studio (SDK + emulator), Flutter SDK. *(Claude gives OS-specific steps: Windows via `winget`, macOS via `brew`.)*
- [ ] **P0-T2 🧑 Verify toolchain** — `flutter doctor`, `node -v`, `docker --version`, `python --version`, create an Android emulator (Pixel, latest stable API).
- [ ] **P0-T3 🧑 VS Code extensions** — Dart, Flutter, ESLint, Prettier, Prisma, Docker, Python, GitLens, Error Lens, Thunder Client (or REST Client).
- [ ] **P0-T4 🧑 Install OpenCode CLI** and connect a model provider (login/API key). Verify by running `opencode` in an empty folder.
- [ ] **P0-T5 🧑 GitHub** — create a private repo `ocularcheck`, set up SSH key or GitHub CLI login, clone locally.
- [ ] **P0-T6 🧑 Accounts to create now (free tiers)** — Firebase, Google Cloud (Maps), Kaggle, Cloudflare (R2) or AWS (S3). *(Keys are created later, in the phase that needs them.)*
- [ ] **P0-T7 🧑 Copy design files** — unzip the Stitch export into `design/` in the repo.

**Done when:** `flutter doctor` is green for Android, Docker runs `hello-world`, OpenCode answers in the repo folder.

---

### PHASE 1 — Repo scaffold, rules, CI
**Goal:** empty-but-professional skeleton.

- [ ] **P1-T1 🤖** Create monorepo folders, root `.gitignore`, `.editorconfig`, `README.md`, `LICENSE` choice placeholder, `docs/adr/0001-tech-stack.md`.
- [ ] **P1-T2 🤖** Create `AGENTS.md` from §4.6 (adapt if needed).
- [ ] **P1-T3 🤖** Scaffold `backend/` (NestJS, TS strict, ESLint, Prettier, Jest) and `ai-service/` (FastAPI, ruff, mypy, pytest) with a `/health` endpoint each.
- [ ] **P1-T4 🤖** Scaffold `mobile/` (Flutter, org id `com.ocularcheck.app`, analyzer rules, folder structure from §3.1).
- [ ] **P1-T5 🤖** `infra/docker-compose.yml`: Postgres(+PostGIS), Redis, MinIO, backend, ai-service; `.env.example` files for each.
- [ ] **P1-T6 🤖** GitHub Actions: lint + test + build for each package, dependency audit, secret scanning (gitleaks).
- [ ] **P1-T7 🧑** Enable on GitHub: branch protection on `main` (require PR + passing checks), Dependabot, secret scanning.

**Done when:** CI is green on a first PR; `docker compose up` starts all services.

---

### PHASE 2 — Backend foundation
**Goal:** a production-shaped API core, no features yet.

- [ ] **P2-T1 🤖** Typed + validated config module (fail fast on missing env).
- [ ] **P2-T2 🤖** Prisma setup, first migration (User, PatientProfile, DoctorProfile), seed script.
- [ ] **P2-T3 🤖** Global validation pipe, exception filter (consistent error JSON), request-id logging (pino), response envelope.
- [ ] **P2-T4 🤖** API versioning `/api/v1`, Swagger (dev only), health/readiness endpoints.
- [ ] **P2-T5 🤖** Unit + e2e test setup with a Dockerized test DB.

---

### PHASE 3 — Authentication & authorization
**Goal:** secure login for two roles.

- [ ] **P3-T1 🤖** Register/Login: **argon2id** hashing, email normalization, role selection (doctor accounts require later verification flag).
- [ ] **P3-T2 🤖** JWT access token (short, ~15 min) + **rotating refresh tokens** stored hashed with token-family reuse detection.
- [ ] **P3-T3 🤖** `JwtAuthGuard`, `RolesGuard`, `@Roles()` decorator, `@CurrentUser()`.
- [ ] **P3-T4 🤖** `/me` endpoints, medical-history upsert, consent timestamp, account deletion.
- [ ] **P3-T5 🤖** Tests: happy paths, wrong password, expired/reused refresh token, role denial.

---

### PHASE 4 — Flutter foundation
**Goal:** theme, localization, routing, networking ready.

- [ ] **P4-T1 🤖** Design tokens from `DESIGN.md` → `ThemeData` light + dark (Material 3), typography Inter/Cairo.
- [ ] **P4-T2 🧑** Add fonts (Inter, Cairo) — download from Google Fonts, place in `mobile/assets/fonts/`.
- [ ] **P4-T3 🤖** Localization: `l10n.yaml`, `app_en.arb`, `app_ar.arb`, locale switch with RTL, persisted setting.
- [ ] **P4-T4 🤖** Core: Result/Failure types, Dio client + auth interceptor (attach token, refresh on 401, single-flight), `TokenStorage` port with `flutter_secure_storage` implementation.
- [ ] **P4-T5 🤖** go_router with auth + role redirects; app shell with bottom nav (patient) and doctor shell.
- [ ] **P4-T6 🤖** Shared widgets: `PrimaryButton` (pill), `AppCard` (24px), `StatusChip`, `DisclaimerBanner`, `AppTextField`, loading/error/empty states. Golden tests EN/AR × light/dark.

---

### PHASE 5 — Auth & onboarding UI
- [ ] **P5-T1 🤖** Onboarding slides (3 screens from design) + "seen" flag.
- [ ] **P5-T2 🤖** Login / Register screens with role toggle, validation, error mapping.
- [ ] **P5-T3 🤖** Medical history setup screen → `PUT /me/medical-history`, consent checkbox.
- [ ] **P5-T4 🤖** Auth feature tests (use cases with fakes, widget tests).
- [ ] **P5-T5 🧑** Run on emulator + a real phone; verify EN/AR and dark mode.

---

### PHASE 6 — AI service  *(the core differentiator)*
**Goal:** a real classifier behind a clean API, with honest evaluation.

- [ ] **P6-T1 🧑 Get datasets** — Kaggle: download **ODIR-5K** (Normal, Diabetes, Glaucoma, Cataract …) and optionally **APTOS 2019 / EyePACS** (DR grading). Read each dataset's license. Do **not** commit data to Git.
- [ ] **P6-T2 🧑 Open Google Colab (GPU runtime)** and mount Drive for data/checkpoints.
- [ ] **P6-T3 🤖** Training notebook/scripts: data audit, patient-level train/val/test split (no leakage), preprocessing (circular crop, resize, CLAHE/Ben Graham), augmentation, class imbalance handling.
- [ ] **P6-T4 🤖** Model: transfer learning (EfficientNet-B0 or ResNet50), 4 classes (Normal / Glaucoma / Cataract / DR), calibration (temperature scaling) so "confidence" is meaningful.
- [ ] **P6-T5 🤖** Evaluation report: per-class sensitivity/specificity/AUC, confusion matrix, failure analysis → `docs/model-card.md` (limitations, intended use, data sources).
- [ ] **P6-T6 🤖** Export to **ONNX**, version it (`model_version`), checksum.
- [ ] **P6-T7 🤖** FastAPI inference: `POST /v1/predict`, `POST /v1/quality`; **quality gate** (blur via Laplacian variance, exposure, fundus-circle detection, out-of-distribution rejection → "not a retinal image").
- [ ] **P6-T8 🤖** Tests: contract tests, bad-image tests, performance budget (e.g., < 2 s on CPU).

**Done when:** model card published, API rejects non-fundus images, and predictions are reproducible.

---

### PHASE 7 — Scan feature (backend + mobile)
- [ ] **P7-T1 🤖 Backend:** `ScanModule` — multipart upload (type/size limits), store image via `FileStorage` port (S3/MinIO), call `ImageClassifier` port (HTTP client to ai-service), persist `Scan`.
- [ ] **P7-T2 🧑** Create the storage bucket (R2/S3) + access keys; put values in `backend/.env`.
- [ ] **P7-T3 🤖 Backend:** signed-URL image access, ownership checks (patient sees only own scans), list/detail endpoints, audit log.
- [ ] **P7-T4 🤖 Mobile domain/data:** `Scan` entity, `ScanRepository`, `SubmitScanUseCase`, `GetScansUseCase`.
- [ ] **P7-T5 🤖 Mobile real-time quality check:** camera stream analysis (brightness, sharpness, framing circle) in an **isolate** (no UI jank), guidance messages, capture enabled only when good.
- [ ] **P7-T6 🤖 Mobile UI:** scan screen, upload from gallery, analysis progress, result screen (confidence, per-class bars, `DisclaimerBanner`).
- [ ] **P7-T7 🧑** Test on a **real device** (emulator camera is not representative); test with sample fundus images from the dataset.

---

### PHASE 8 — Patient dashboard, history & trends
- [ ] **P8-T1 🤖** Dashboard aggregation endpoint (latest scan, today's reminders, next appointment, health score rule documented in ADR).
- [ ] **P8-T2 🤖** Dashboard UI (score ring, latest result, tip card, schedule, next appointment, "Start New Scan" button).
- [ ] **P8-T3 🤖** History & trends screen (list + chart over time).

---

### PHASE 9 — Reminders & push notifications
- [ ] **P9-T1 🧑 Firebase setup** — create project, add Android app (package `com.ocularcheck.app`), download `google-services.json`, enable Cloud Messaging; create a service-account key for the backend. *(Detailed click-path on request.)*
- [ ] **P9-T2 🤖** Mobile: `firebase_core` + `firebase_messaging`, device token registration, notification permission flow (Android 13+).
- [ ] **P9-T3 🤖** Backend: `PushSender` port + FCM implementation, `DeviceToken` management.
- [ ] **P9-T4 🤖** Reminder CRUD + BullMQ scheduler (timezone-aware), repeating schedules, retries.
- [ ] **P9-T5 🤖** Mobile: reminders UI + local notifications as offline fallback (`flutter_local_notifications`, exact-alarm permission handling).
- [ ] **P9-T6 🧑** Test: background, killed-app, and device-reboot cases on a real phone; battery-optimization settings per vendor.

---

### PHASE 10 — Clinics, GPS & booking
- [ ] **P10-T1 🧑 Google Maps** — create a Cloud project, enable *Maps SDK for Android* + *Places API*, create an API key, **restrict it** to the Android package + SHA-1. *(Detailed steps on request.)*
- [ ] **P10-T2 🤖** Backend: `Clinic` table, seed real clinics (CSV import), `GET /clinics/nearby` (PostGIS/Haversine), pagination.
- [ ] **P10-T3 🤖** Mobile: location permission flow, map + list, nearest clinic, directions deep link.
- [ ] **P10-T4 🤖** Backend: doctor availability slots, `Appointment` CRUD, double-booking prevention (DB constraint + transaction).
- [ ] **P10-T5 🤖** Mobile: booking flow with "closest doctor" suggestion, confirmation, auto-create appointment reminder.

---

### PHASE 11 — Doctor module
- [ ] **P11-T1 🤖** Backend: queue endpoint (filters, pagination), review endpoint (Confirm / Modify with note), `ScanReview`, audit log, notify patient.
- [ ] **P11-T2 🤖** Doctor verification flag (admin-approved) — only verified doctors can review.
- [ ] **P11-T3 🤖** Mobile doctor UI: queue, scan detail with zoomable image, AI result vs. final result, confirm/modify form.
- [ ] **P11-T4 🧑** Create a test doctor + patient pair and run the full loop on two devices/emulators.

---

### PHASE 12 — Chat / telemedicine
- [ ] **P12-T1 🤖** Backend: conversations/messages (REST history, cursor pagination), Socket.IO gateway with JWT handshake auth, per-conversation authorization, rate limiting.
- [ ] **P12-T2 🤖** Delivery/read receipts, offline → FCM push for new message.
- [ ] **P12-T3 🤖** Mobile chat UI (bubbles, reconnect logic, optimistic send, scan attachment reference).
- [ ] **P12-T4 🧑** Test with two emulators simultaneously + airplane-mode reconnect.

---

### PHASE 13 — PDF clinical reports
- [ ] **P13-T1 🤖** Backend report service (pdfkit): patient info, scan image, AI result + confidence, doctor review (if any), **disclaimer**, report ID + timestamp; EN/AR (Arabic shaping + RTL font embedding).
- [ ] **P13-T2 🤖** Mobile: download/share (`share_plus`, `open_filex`), caching, error states.
- [ ] **P13-T3 🧑** Open PDFs in a real phone viewer; check Arabic text renders correctly.

---

### PHASE 14 — Accessibility & localization completion
- [ ] **P14-T1 🤖** `VoiceGuide` service (port + `flutter_tts` implementation): speaks screen titles, quality-check guidance, results (EN/AR voices), user toggle in settings.
- [ ] **P14-T2 🤖** Semantics audit: labels, focus order, min touch target 48dp, contrast AA+, text scale up to 200%.
- [ ] **P14-T3 🤖** Complete AR translations review; plural/number/date formatting via `intl`.
- [ ] **P14-T4 🧑** Test with **TalkBack** on a real Android phone (Settings → Accessibility → TalkBack), in Arabic and English.

---

### PHASE 15 — Testing, performance & release prep
- [ ] **P15-T1 🤖** Fill coverage gaps to targets in §4.3; add integration tests (login→scan→result, booking, chat).
- [ ] **P15-T2 🤖** Performance pass: image compression before upload, list virtualization, startup time, Flutter DevTools profile.
- [ ] **P15-T3 🤖** Error monitoring (Sentry) with PII scrubbing; backend metrics endpoint (Prometheus).
- [ ] **P15-T4 🧑** Beta test with 3–5 real users (including one Arabic-speaking and one accessibility user); collect feedback.
- [ ] **P15-T5 🤖** Fix list from beta feedback.

---

### PHASE 16 — Deployment
- [ ] **P16-T1 🧑** Choose hosting (e.g., Railway/Render/Fly.io or a VPS), managed Postgres + Redis, bucket, domain + HTTPS.
- [ ] **P16-T2 🤖** Production Dockerfiles (multi-stage, non-root user), prod compose/config, DB migration step in CD.
- [ ] **P16-T3 🤖** GitHub Actions CD: deploy backend + ai-service on tag; build signed Android release (AAB) as artifact.
- [ ] **P16-T4 🧑** Generate the **upload keystore**, store it + passwords in a password manager (never in Git); add as GitHub secrets.
- [ ] **P16-T5 🧑** Distribute via **Firebase App Distribution** or Play Console *Internal testing*.

---

### PHASE 17 — 🔒 Security hardening  *(final phase)*
**Goal:** verify and harden against **OWASP MASVS / MASTG** (mobile) and **OWASP ASVS / API Top 10** (backend).

**17A. Threat model first**
- [ ] **P17-T1 🤖** `docs/threat-model.md` (STRIDE): assets (retinal images, PHI, tokens), actors, trust boundaries, abuse cases.

**17B. Mobile**
- [ ] **P17-T2 🤖** Secure storage audit: tokens only in Keystore/Keychain-backed storage; nothing sensitive in SharedPreferences/logs/cache; clear on logout.
- [ ] **P17-T3 🤖** **Certificate pinning** (Dio) with pin rotation strategy + backup pin.
- [ ] **P17-T4 🤖** Android hardening: `allowBackup=false`, `usesCleartextTraffic=false`, network security config, `FLAG_SECURE` on scan/result/chat screens (blocks screenshots/recents preview), exported-components audit, deep-link validation.
- [ ] **P17-T5 🤖** Root/jailbreak + debugger/emulator detection (policy: warn vs. block), optional **biometric / PIN app lock**, session timeout.
- [ ] **P17-T6 🤖** Release build: `--obfuscate --split-debug-info`, R8/ProGuard, upload symbols to Sentry; verify no API keys/secrets in the binary (`strings`/`apktool` check).
- [ ] **P17-T7 🤖** Play Integrity API check (backend-verified) for sensitive endpoints.

**17C. Backend / API**
- [ ] **P17-T8 🤖** `helmet`, strict CORS, rate limiting (login, refresh, upload, chat), brute-force lockout, request size limits, input sanitization.
- [ ] **P17-T9 🤖** Authorization audit (OWASP API1/BOLA): every resource query scoped by owner/role; negative tests per endpoint.
- [ ] **P17-T10 🤖** Upload hardening: magic-byte validation, re-encode images (strip EXIF/GPS), AV scan hook, private bucket + short-lived signed URLs.
- [ ] **P17-T11 🤖** Refresh-token reuse detection test, JWT key rotation (`kid`), secrets from env/secret manager only, 2FA option for doctors (TOTP).
- [ ] **P17-T12 🤖** Encryption: TLS 1.2+ only, DB + bucket encryption at rest, field-level encryption for most sensitive fields, encrypted backups with restore test.
- [ ] **P17-T13 🤖** Privacy features: data export, account deletion (cascade + object storage purge), consent log, retention policy, audit-log review screen for admin.

**17D. Pipeline & verification**
- [ ] **P17-T14 🤖** CI security: `npm audit`/`pip-audit`/`flutter pub outdated`, CodeQL or Semgrep (SAST), gitleaks, container scan (Trivy), SBOM.
- [ ] **P17-T15 🧑 Dynamic testing** — run **OWASP ZAP** against the staging API; use **MobSF** (static+dynamic) on the release APK; review findings with Claude and fix.
- [ ] **P17-T16 🧑** Check app against the **MASVS checklist** (L1 minimum, L2 for storage/network/resilience), tick each item in `docs/masvs-checklist.md`.
- [ ] **P17-T17 🧑** Pre-launch: Play Store data-safety form, privacy policy + terms (health-data wording), incident response contact, backup restore drill.

**Done when:** no High/Critical findings open, MASVS-L1 fully passed, threat-model mitigations all linked to tests.

---

## 8. Progress tracker

| Phase | Name | Status |
|---|---|---|
| 0 | Environment setup | ☐ |
| 1 | Scaffold, rules, CI | ☐ |
| 2 | Backend foundation | ☐ |
| 3 | Auth & authorization | ☐ |
| 4 | Flutter foundation | ☐ |
| 5 | Auth & onboarding UI | ☐ |
| 6 | AI service | ☐ |
| 7 | Scan feature | ☐ |
| 8 | Dashboard & history | ☐ |
| 9 | Reminders & push | ☐ |
| 10 | Clinics, GPS, booking | ☐ |
| 11 | Doctor module | ☐ |
| 12 | Chat | ☐ |
| 13 | PDF reports | ☐ |
| 14 | Accessibility & l10n | ☐ |
| 15 | Testing & performance | ☐ |
| 16 | Deployment | ☐ |
| 17 | Security hardening | ☐ |

## 9. Risk register

| Risk | Mitigation |
|---|---|
| Phone camera can't capture a usable retinal image | Support adapter hardware + gallery upload; quality gate rejects bad images; state limitation in onboarding |
| Model overfits / poor real-world accuracy | Patient-level splits, external test set, calibration, model card, clinician review before any claim |
| Regulatory exposure (medical device rules) | Position as screening aid, disclaimers everywhere, doctor-in-the-loop; get legal advice before public launch |
| PHI breach | Phase 17 + least privilege + encryption + audit logs from day one (don't wait for P17 for basics: hashing, validation, ownership checks are built in P2–P3) |
| AI-generated code drift | `AGENTS.md`, small tasks, mandatory review + quality gate, tests required |
| Scope creep | Anything not in this file goes to `docs/backlog.md` until the current phase is done |

---

## 10. How to start

1. Tell Claude your **operating system** (Windows / macOS / Linux) and confirm or change the stack in §2.
2. Say: **"Give me the manual steps for P0-T1."**
3. After Phase 0 is green, say: **"Give me the prompt for P1-T1."**
