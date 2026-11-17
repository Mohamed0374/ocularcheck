# ADR 0005 — API versioning and health probes

- Status: accepted
- Date: 2026-11-10
- Related: P2-T4 (OCULARCHECK_PLAN §7), ADR 0002 (typed configuration),
  ADR 0004 (error and response conventions), `docs/api-conventions.md`
  (living reference)

## Context

ADR 0004 fixed the response/code semantics but the URL surface was still
unprefixed and unversioned; before the Phase 3 feature tasks (auth, scans,
appointments) can go in, the contract framing must exist so consumers never
see a convention change later without a version bump. Separately, ops needs
two machine-readable probe endpoints with clear, non-overlapping semantics:
the orchestration layer must distinguish "restart me" from "don't route to
me". All wiring lives in one composition root (`configure-app.ts`) used by
both `main.ts` and the e2e tests.

## Decision

1. **Prefix + URI version:** every consumer-facing controller is served at
   `/api/v1/...` via one central composition:
   `setGlobalPrefix(API_PREFIX)` + `enableVersioning({ type: VersioningType.URI, defaultVersion: DEFAULT_URI_VERSION })`,
   constants in `src/common/api-version.ts`. Controllers never spell
   prefix/versions — additive and cross-cutting by design (Open/Closed:
   a version-2 controller simply declares `version: '2'`).
2. **Health probes are prefixless and versionless.** `GET /health` and
   `GET /health/ready` are excluded from the prefix
   (`setGlobalPrefix(..., { exclude: ['health', 'health/ready'] })`) and use
   `@Controller({ version: VERSION_NEUTRAL })`. Rationale: the Docker
   healthcheck and CI scripts depend on the exact URL + body forever;
   version pinning infra probes would force an infra release every time a
   consumer version is cut. Infra/ is deliberately UNTOUCHED — the healthcheck
   keeps calling `/health`.
3. **Liveness is DB-free; readiness is dependency-complete.**
   `GET /health` stays the process-level probe that Docker restarts ON.
   `GET /health/ready` runs ALL registered checks in parallel with a fixed
   2 s deadline, returning 200 `{ status: 'ok', checks: { <name>: 'up' } }`
   or 503 `{ status: 'unavailable', checks: { <name>: 'down' } }` — body
   contains names and up/down values ONLY. Failure reasons (whose text may
   carry credentials or hosts) are logged with the check NAME at warn level
   and nothing else. Docker uses liveness; CI smoke tests and load
   balancers use readiness.
4. **Readiness is a port, not a hardcoded list.**
   `ReadinessCheck { name; check(): Promise<void> }` is a port; the list is
   ONE array-valued provider (`READINESS_CHECKS` via `useFactory`) in
   `HealthModule` (Nest does not concatenate duplicate `provide`
   registrations — a second provider would silently replace the first;
   this bit us in P2-T3 and is now documented). First implementation:
   `DatabaseReadinessCheck` (SELECT 1 through `PrismaService`).
5. **Readiness reports dynamic 503 via passthrough response, not a thrown
   error.** `@Res({ passthrough: true }) response.status(...)` keeps
   interceptors working and avoids routing the 503 through the error
   envelope — the readiness body IS the plan-specified shape.
6. **Swagger, development-only.** `@nestjs/swagger` (exact pin 12.1.1)
   mounts `/api/docs` + `/api/docs-json` only when
   `nodeEnv === 'development'` (typed config, no `process.env` reads in the
   bootstrap layer; version comes from `package.json` read at runtime so
   the doc's `info.version` tracks releases automatically). The document
   carries the standing medical disclaimer, advertises a bearer JWT scheme
   for the upcoming auth phase, hides `/health` (byte-exact infra probe)
   and documents `/health/ready` as a plain `ReadinessStatusDto` model.
   Shared helpers `ApiOkEnvelope(Model)` / `ApiErrorResponses(...statuses)`
   produce the ADR 0004 envelope shapes in the doc.
7. **`X-Powered-By` is disabled** in `configureApp` (Express
   `disable('x-powered-by')`) — framework advertising is unnecessary attack
   surface; e2e asserts the header is absent.

## Alternatives considered

- **Header-based versioning (`Accept: version=...`)** — invisible in logs,
  browser/curl-unfriendly for ad-hoc ops probing; URI wins for a
  screening app whose clients are the Flutter app and simple scripts.
- **Header query param (`?version=2`)** — pollutes cache keys and Swagger
  parameterization; rejected for the same ops reasons.
- **Healthcheck hitting readiness** — would couple container restart to
  dependency restart storms (Postgres restart → container flapping); two
  probes with distinct jobs beat one "true" probe.
- **Timeouts inside each check** — a hidden deadline per check invites
  inconsistency and untestable sleeps; one shared `withTimeout` helper at
  the service boundary is unit-testable and uniform.
- **Discovery through env-var version toggles (`API_VERSIONS_ON=v2`)**
  — version availability should be a COMPILE-TIME code fact, not runtime
  config drift.

## Consequences

- Every future feature controller lives under `/api/v1` untouched (the
  default version is applied globally); version 2 is additive controllers,
  never edits of v1 payloads (deprecation flow documented in
  `api-conventions.md` as a proposal).
- Docs endpoints disappear in test and production environments (404 error
  envelope) — e2e asserts both directions.
- `/health` remains byte-stable; ANY consumer of it (infra, CI, runbooks)
  can assume the exact body forever, only changing its mind consciously
  via a new ADR.
- Readiness checks must be cheap (2 s budget, parallel); an expensive
  check is a problem of the check author, not the framework.
- Tests: unit (`with-timeout`, `readiness.service`, controller) + e2e
  (probes, 503 secrecy, hanging-check timeout, version reachability,
  swagger on/off with scheme/data checks, `x-powered-by` absence).
