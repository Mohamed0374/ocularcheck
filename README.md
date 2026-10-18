# OcularCheck AI

Mobile healthcare platform for early screening of ocular disease — **Glaucoma**, **Cataract**, and **Diabetic Retinopathy** (plus Normal) — from retinal fundus images. The monorepo contains a Flutter mobile app (patient and doctor roles), a NestJS backend API, and a Python AI inference service; features include AI retinal scans with camera quality guidance, medication & appointment reminders (push), GPS clinic finder with appointment booking, downloadable PDF reports, doctor review of AI results, and in-app chat — all with Arabic (RTL) / English (LTR) localization, text-to-speech guided UI, and light/dark modes.

## ⚠️ Medical disclaimer

> AI output in OcularCheck AI is a **preliminary assessment** and does **not replace a professional clinical diagnosis**. It is a screening aid only. Every surface that shows a result (app screen, PDF report, notification text) carries this disclaimer, and results must be confirmed by a qualified doctor.

## Tech stack

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

## Monorepo layout

```
ocularcheck/
├── AGENTS.md                  # rules for OpenCode (created in P1-T2)
├── OCULARCHECK_PLAN.md        # master plan — single source of truth
├── README.md
├── docs/                      # ADRs, API docs, diagrams, threat model
│   └── adr/                   # architecture decision records
├── design/                    # Stitch export (DESIGN.md + screens) — reference only
├── mobile/                    # Flutter app
├── backend/                   # NestJS API
├── ai-service/                # FastAPI inference + training notebooks
├── infra/                     # docker-compose, nginx, deployment configs
└── .github/workflows/         # CI pipelines
```

## Getting started

_Coming in later phases._ This repo is currently an empty-but-structured skeleton (created in P1-T1). Framework scaffolding for `mobile/`, `backend/`, and `ai-service/` (P1-T3, P1-T4) and the local Docker environment (P1-T5) arrive in later phases — the step-by-step workflow lives in the master plan.

## Master plan

The single source of truth for scope, architecture, engineering standards, and the 17-phase roadmap is **[OCULARCHECK_PLAN.md](OCULARCHECK_PLAN.md)**.

## License

**TBD — all rights reserved until a license is chosen.**
