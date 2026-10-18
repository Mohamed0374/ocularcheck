# ADR-0001: Technology stack

**Status:** Accepted
**Date:** 2026-10-18

## Context

OcularCheck AI is a multi-service healthcare platform (mobile app, backend API, AI inference service) that must support Arabic RTL/LTR, health-data sensitivity, and solo-developer productivity. Plan §2 fixed recommended defaults but asked that the decision be recorded formally before Phase 1, after which changing it becomes expensive.

## Decision

Use the stack below, layer by layer:

| Layer | Choice | Why (one line) | Alternative considered — why not chosen |
|---|---|---|---|
| Mobile app | Flutter (Dart) | One codebase with first-class RTL/localization, camera/TTS/notification plugins, and good testability. | React Native — weaker tooling story for fine-grained camera-stream processing and RTL typography fidelity. |
| State management | Riverpod | Compile-safe DI + state, easy to test without widgets. | Bloc — more boilerplate and stream ceremony for the same testability, no compile-safe dependency injection. |
| Navigation | go_router | Declarative routes with deep links and role-based redirects. | Raw Navigator 2.0 API — verbose, error-prone, and would reimplement deep-link/redirect logic by hand. |
| Networking | Dio + interceptors | Centralized token refresh, logging, and later certificate pinning. | `http` package — no interceptor mechanism; token refresh would be duplicated at every call site. |
| Backend API | NestJS (TypeScript) | Opinionated modularity, built-in DI (SOLID-friendly), guards/pipes, WebSocket gateway. | Express/Fastify — unopinionated; we would rebuild structure, validation, and DI ourselves. |
| Database | PostgreSQL (+ PostGIS or Haversine for geo) via Prisma | Relational fits the data model, real migrations, type-safe client. | MongoDB — document store clashes with relational domain rules (booking uniqueness, FK-cascades, audit joins). |
| Cache / jobs | Redis + BullMQ | Timezone-aware reminder scheduling and rate-limit store out of the box. | In-process timers / in-memory queues — lost on restart, no retries or delayed jobs across instances. |
| AI service | Python FastAPI + ONNX Runtime (model trained in PyTorch) | Separate service with independent scaling and fast CPU inference. | Serving the model inside the NestJS backend or via Flask — no separation of concerns, slower CPU inference (Flask also lacks first-class async/OpenAPI typing). |

### Consequences

**Positive**

- One mobile codebase for two platforms with accessibility (RTL, TTS) and design-token fidelity.
- Type safety end-to-end: Dart models ← Prisma-generated types ↔ validated DTOs.
- AI service scales and deploys independently of the API and can swap models by versioning ONNX artifacts.
- Docker-compose gives a reproducible local environment from day one.
- S3-compatible storage abstracts the bucket vendor (MinIO locally, R2/S3 in production).

**Negative**

- Three ecosystems (Dart, TypeScript, Python) to lint, test, and audit in CI.
- PyTorch → ONNX export adds friction and the ONNX artifact must be versioned and checksummed.
- Firebase Cloud Messaging and Google Maps introduce vendor lock-in for push and clinic maps.
- Prisma migrations and BullMQ workers add operational moving parts (DB revisions, Redis availability).

## Alternatives considered

Summarized per layer in the Decision table above; the only holistic alternative — a single full-stack framework (e.g., Next.js + a Node-hosted model) — was rejected because Python-native ML tooling (training, preprocessing, ONNX export) and Flutter's mobile-first UX cannot be served well by one stack.
