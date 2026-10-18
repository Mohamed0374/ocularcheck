# OcularCheck AI — Agent Rules

OcularCheck AI is a monorepo with three services: a **Flutter** mobile app (`mobile/`), a **NestJS** backend (`backend/`), and a **FastAPI** AI service (`ai-service/`). It is a screening aid for ocular disease (Glaucoma, Cataract, Diabetic Retinopathy, Normal) from retinal fundus images — it is **NOT a medical device** and never outputs a diagnosis. See `OCULARCHECK_PLAN.md` (the single source of truth).

## Current status

The repo is in **Phase 1** of the plan. `mobile/`, `backend/`, and `ai-service/` are placeholder folders until later tasks scaffold them; the commands below only work after those tasks. To see which phase is current, read the roadmap checkboxes in `OCULARCHECK_PLAN.md` §7.

## Non-negotiable rules

1. Follow Clean Architecture + SOLID as described in `OCULARCHECK_PLAN.md` §3. Domain layer has no framework imports.
2. Depend on interfaces (ports); bind implementations only in the composition root (Riverpod providers / Nest modules).
3. Never use `dynamic` (Dart) or `any` (TypeScript). Strict typing everywhere.
4. Never hardcode secrets, URLs, or user-facing strings. Config via env; strings via l10n (EN + AR, ARB files).
5. All UI must support RTL/LTR, light/dark, large text, and Semantics labels.
6. Any screen, PDF, or notification text showing an AI result MUST include the medical disclaimer.
7. Every new behavior ships with tests. Never delete or weaken tests to make them pass.
8. Validate all external input (DTOs with class-validator on backend). Never trust the client.
9. Never log tokens, passwords, or medical data (PII). Use structured logging.
10. Work only on the task described in the prompt. Do not refactor unrelated code. Ask when unclear.
11. Before finishing: run the quality gate (Plan §4.4) and report the results.
12. Use Conventional Commits. Do not commit unless asked.

## Architecture quick reference

```
mobile/lib/                            backend/src/
├── core/          # theme, l10n,      ├── common/           # filters, guards, interceptors, pipes,
│                  # router, network,  │                     # decorators, di composition
│                  # error, utils      ├── config/           # typed, validated env config
│                  # di                ├── infrastructure/   # prisma, redis, storage, fcm,
├── shared/        # reusable widgets  │                     # ai-client (impl behind interfaces)
│                 # (incl. disclaimer  └── modules/<m>/      # auth, users, scans, clinics,
│                 #  banner)               ├── controller    #  appointments, reminders, chat,
└── features/<f>/                          ├── service      #  reports, notifications, audit
    ├── domain/       # entities,          ├── dto/
    │                 # repo interfaces, └── ports/       # interfaces the service depends on
    │                 # use cases
    ├── data/         # DTOs, data
    │                 # sources, repo impls, mappers
    └── presentation/ # screens, widgets, Riverpod notifiers/controllers
```

- Dependency rule: `presentation → domain ← data`. Domain imports nothing from the other two.
- On mobile, infrastructure implementations live in `core/` (e.g., `TokenStorage` impl with `flutter_secure_storage`); on backend, in `infrastructure/`. Both bind interface → implementation in one composition root.
- Controllers (backend) and widgets (mobile) do HTTP-only / rendering-only; services and notifiers hold business logic.
- Ports are small and segregated (`TokenStorage`, `ImageClassifier`, `FileStorage`, `PushSender`) — no god `ApiService`.

## SOLID in practice

- **S** — one use case per class (`SubmitScanUseCase`, `LoginUseCase`); controllers parse/respond, services decide, repositories persist.
- **O** — new diagnosis class or notification channel = add a strategy/registry class, never edit a `switch`.
- **L** — any `ScanRepository` implementation (remote, fake, cached) is substitutable with no caller changes; fakes honor the same errors and nullability.
- **I** — small ports: `TokenStorage`, `ImageClassifier`, `FileStorage`, `PushSender` — never a god `ApiService`.
- **D** — Riverpod providers / Nest DI tokens bind interfaces to implementations in one composition root only.

## Code style

- **Dart:** `very_good_analysis` (or strict `flutter_lints`) + `dart format`; zero analyzer warnings.
- **TypeScript:** `strict: true`, ESLint + Prettier, no `any`.
- **Python:** `ruff` + `black` + `mypy`; type hints everywhere.
- **Commits:** Conventional Commits (`feat(scan): add quality check use case`).
- **Branches:** `feat/p$n-t$m-short-name` / `fix/…` / `chore/…` (e.g., `git switch -c feat/p3-t2-refresh-rotation`).

## Security baseline

- No secrets in code or logs; `.env` is never committed (template `.env.example` only).
- Parameterized queries only (Prisma does this by default; never use raw string interpolation).
- Validate and whitelist all external input; reject what is not explicitly allowed.
- Authorization checked on every resource access — owner or role, verified server-side, every endpoint.
- Never log PII, medical data, tokens, or passwords; use structured, scrubbed logging.
- Uploads validated by content type, extension whitelist, magic bytes, and size limit.
- Passwords hashed with argon2id, never stored or written in plaintext anywhere.
- Dependencies pinned and audited (`npm audit` / `pip-audit` / `flutter pub outdated`).

## Task protocol

- (a) Work only on the task described in the prompt; no scope creep or unsolicited refactoring.
- (b) If the task is ambiguous or conflicts with `OCULARCHECK_PLAN.md`, stop and ask before coding.
- (c) Show a short plan before editing files so it can be approved or corrected first.
- (d) After implementing, run the quality gate (Plan §4.4: `dart format/analyze/test`, `npm run lint/test/build`, `ruff/mypy/pytest` for the touched package) and report pass/fail honestly — never claim tests passed without running them.
- (e) List files created/changed and any decisions made that were not in the prompt.
- (f) Never run `git commit`, `git push`, or install global tools unless the prompt explicitly says so.

## Design source

Design reference: `design/stitch_eyeguard_ai_healthcare_platform/`; design tokens in `design/stitch_eyeguard_ai_healthcare_platform/visionary_precision/DESIGN.md`. Match colors, radii (cards 24px, inputs 8px, pill buttons), and fonts Inter (EN) / Cairo (AR). Design files are reference only — never edit them and never run their HTML.

## Commands

- Mobile: `cd mobile && dart format --set-exit-if-changed . && flutter analyze && flutter test`
- Backend: `cd backend && npm run lint && npm test && npm run build`
- AI: `cd ai-service && ruff check . && mypy . && pytest`
