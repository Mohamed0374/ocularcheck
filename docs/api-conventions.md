# Backend API conventions

- Status: active (P2-T3, plan §7; extended in P2-T4)
- Date: 2026-11-07 (extended 2026-11-10)
- Related: ADR 0004 (decision record), ADR 0002 (typed configuration),
  ADR 0005 (API versioning and health probes)

Every HTTP response the backend sends follows the rules on this page. The
shared bootstrap (`backend/src/bootstrap/configure-app.ts`) is the only place
the pipeline is assembled, and `main.ts` **and** every e2e test call it —
tests therefore exercise exactly the production behavior.

## Success envelope

```json
{
  "data": { "...": "endpoint payload" },
  "meta": { "requestId": "e2e-valid-request-id-1234" }
}
```

- All successful JSON responses are wrapped; keep `meta.requestId` for
  correlation (same value as the `X-Request-Id` response header).
- **Opt-out**: annotate a handler or whole controller with `@SkipEnvelope()`
  (from `common/envelope/skip-envelope.decorator.ts`). `/health` is opted
  out on purpose (infra probes + Docker healthcheck rely on the exact body).
- Pass-through (never wrapped): `StreamableFile`/`Buffer` payloads (PDFs),
  non-JSON content types, and empty 204/304 responses.

## Error format

Every error has exactly one envelope, regardless of origin (validation,
framework 404, Prisma, or an uncaught bug):

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request payload is invalid",
    "details": [{ "field": "contact.email", "codes": ["isEmail"] }],
    "requestId": "0b9f4133-d5a4-4f4b-baaa-81cf429d755c",
    "timestamp": "2026-11-07T01:15:03.976Z",
    "path": "/test-rig/echo"
  }
}
```

- `message` is a generic English developer string, constant per `code`.
  It is **never** localized and **never** interpolated with user input.
- `details` appears only for `VALIDATION_FAILED`: `{ field, codes }` pairs —
  constraint *names* (`isEmail`, `minLength`) and dotted paths for nested
  payloads. Submitted values are never echoed.
- The mobile app localizes from `code`, never from `message`.

## Stable error codes

Closed list — extend by ADDING entries (see below), never by renaming:

| Code                    | HTTP status | Generic message                                    |
| ----------------------- | ----------- | -------------------------------------------------- |
| `VALIDATION_FAILED`     | 400 or 422  | The request payload is invalid                     |
| `UNAUTHORIZED`          | 401         | Authentication is required                         |
| `FORBIDDEN`             | 403         | Access to this resource is forbidden               |
| `NOT_FOUND`             | 404 (or 405)| Resource not found                                 |
| `CONFLICT`              | 409         | The request conflicts with the current state       |
| `PAYLOAD_TOO_LARGE`     | 413         | The request payload is too large                   |
| `UNSUPPORTED_MEDIA_TYPE`| 415         | The request media type is not supported            |
| `RATE_LIMITED`          | 429         | Too many requests                                  |
| `INTERNAL_ERROR`        | 500         | An unexpected error occurred                       |

Rationale notes:

- **422 vs 400**: 422 (Unprocessable Content) is for schema-invalid but
  syntactically valid JSON bodies (the global ValidationPipe); 400 is left
  for malformed request *syntax* (e.g. unparseable JSON from body-parser).
- **405**: a known path with a wrong method keeps status 405 but code
  `NOT_FOUND` — the code list has no `METHOD_NOT_ALLOWED` (ADR 0004).
- Unmapped status codes fall through to `INTERNAL_ERROR`/500 rather than
  inventing semantics.

Source of truth: `backend/src/common/errors/error-codes.ts`
(`ErrorCode` + `CODE_DEFAULT_MESSAGES`).

## Exception → response mapping

Four stateless mappers (`backend/src/common/errors/mappers/`) are registered
in priority order under the `EXCEPTION_MAPPERS` token in `CommonModule`;
`AllExceptionsFilter` iterates them (first `supports()` wins, no mapping
logic in the filter). To add an error source:

1. Throw a dedicated `AppException` subclass in the feature (preferred), or
2. add a new mapper class + register it under `EXCEPTION_MAPPERS`
   *before* `FallbackMapper`.

The filter renders the envelope, sets the status, and logs server-side:
5xx → pino `error` level **with stack**; 4xx → `warn` without stack. No
bodies, no query strings, no PII ever reach the log line or response.

## Request-ID correlation

- Send `X-Request-Id` if you need traceability; **pure validation**: only
  `/^[A-Za-z0-9._-]{8,64}$/` is echoed, anything else (including hostile
  values) is replaced by a fresh UUID — server-generated, always well-formed.
- The final id is echoed in the `X-Request-Id` *response* header and in every
  log line's `req.requestId`, and is embedded in `meta.requestId` / `error.requestId`.
- Implementation is a pure function (`common/request-id/request-id.ts`), unit-tested.

## Logging (nestjs-pino)

- JSON log lines in production and test (ISO timestamps); pino-pretty only
  in `NODE_ENV=development`. Level via `LOG_LEVEL` env (validated enum;
  default `info`; the test env may use `silent`).
- Request serializers emit only `method`, `path` (query strings stripped),
  `statusCode`, `responseTime`, `requestId`. Request/response **bodies and
  headers are never serialized**.
- A pino `redact` pass additionally censors `authorization`, `cookie`,
  `set-cookie` header paths and any `password`/`passwordHash`/`token`/
  `accessToken`/`refreshToken`/`secret`/`apiKey` keys to `[REDACTED]`
  (second safety net).
- Configure only through `buildPinoHttpOptions` in `src/bootstrap/` — it is
  the single source of truth and accepts an optional destination stream so
  tests can capture lines.

## For frontend/mobile consumers

- Read `code` for control flow and localization; display a localized string
  per code (ARB files); keep `message` for developer logs only.
- Use `requestId` (header or body) when reporting a problem with a request.

## URL structure and versioning (P2-T4)

All consumer-facing routes live under `/api`, versioned in the URI:

```text
/health                  ← infra probes ONLY (excluded from prefix & versions)
/health/ready            ← infra probes ONLY (excluded from prefix & versions)
/api/v1/<feature>/...    ← every feature controller (default version 1)
/api/docs                ← Swagger UI (only when NODE_ENV=development)
/api/docs-json           ← OpenAPI JSON (only when NODE_ENV=development)
```

- Wiring is centralized in `src/common/api-version.ts` (prefix/version
  constants) and `src/bootstrap/configure-app.ts` (setGlobalPrefix +
  `enableVersioning({ type: URI })`).
- Controllers never spell the prefix or version: Nest applies the global
  prefix "api" and the default version `DEFAULT_URI_VERSION` ("1"). A
  controller only sets an explicit version when publishing a NEW major.
- Health probes stay versionless (`@Controller({ version: VERSION_NEUTRAL })`
  + prefix exclusion) so the Docker healthcheck body/URL contract is
  byte-stable forever (see ADR 0005).

### Not-found semantics with the prefix

- Unknown routes **under `/api** (e.g. `/api/does-not-exist`) get the JSON
  error envelope with code `NOT_FOUND` — this is the surface clients use.
- A request to an unknown path **outside** `/api` (e.g. `/does-not-exist`)
  never enters the app pipeline and gets Express's default HTML 404. Do not
  rely on its shape; clients must call the prefixed API.

### Breaking changes and deprecation (PROPOSAL — to activate when v2 lands)

1. Breaking change = anything that would fail a current client: removed or
   renamed field, changed type/enum value, changed status/code semantics,
   new required input, removed endpoint.
2. Additive changes (new optional fields, new endpoints, new error codes
   appended) are NOT breaking and do not require a new version.
3. When a breaking change is needed, add a version-2 controller
   (`@Controller({ path: ..., version: '2' })`); v1 stays served unchanged.
4. Deprecation: mark the old version with a dedicated doc note, publish
   `/api/v1` responses unchanged for at least one release cycle, and ONLY
   then add a removal task to the plan. Removal of a version is itself a
   breaking change and a new task, never a drive-by edit.
   (This is the agreed policy proposal — it becomes binding in the P3
   multi-version task; until then it is guidance.)

## Health probes: liveness vs readiness

| Probe           | URL              | Depends on DB? | Use                                        |
| --------------- | ---------------- | -------------- | ------------------------------------------ |
| Liveness        | `GET /health`    | NO             | Docker container healthcheck               |
| Readiness       | `GET /health/ready` | YES (all checks) | CI smoke tests, load balancers / LB routing |

- `GET /health` returns byte-exact `{"status":"ok","service":"ocularcheck-backend"}`
  with status 200 — it is a pure process-level check: the container must be
  restarted on failure but should NOT be restarted because Postgres briefly
  restarted.
- `GET /health/ready` returns 200 with `{ "status": "ok", "checks": { ... } }`
  when EVERY registered check is up, or 503 with
  `{ "status": "unavailable", "checks": { ... } }` otherwise. Body contains
  check names and `"up"`/`"down"` values ONLY — failure reasons are logged
  server-side (warn level, check name only, never the error text, which may
  contain credentials/hosts).
- Each check runs in parallel with a fixed 2000 ms deadline
  (`READINESS_TIMEOUT_MS`); a hanging dependency counts as `down`.
- The Docker healthcheck deliberately uses the LIVENESS probe
  (docker-compose `healthcheck` untouched); a readiness-based healthcheck
  would couple container restarts to dependency restart storms.

### How to add a ReadinessCheck

1. Implement the port in `src/modules/health/ports/readiness-check.ts`:
   `{ name: string, check(): Promise<void> }` — `check()` resolves = up,
   rejects/never-resolves = down. NEVER put secrets/hosts in `name`.
2. Add the class as a provider in its feature module (e.g.
   `src/infrastructure/<dep>/<dep>-readiness.check.ts`) or construct it in
   the `READINESS_CHECKS` factory inside `HealthModule`.
3. Add ONE entry to the `READINESS_CHECKS` factory array — never register a
   second provider under the same `READINESS_CHECKS` token: Nest does not
   concatenate duplicate `provide` registrations (last wins, silently
   dropping the first).
4. The HTTP endpoint, service, timeout, aggregation, and documentation are
   already shared — add code only in steps 1–3.

## Swagger (development only)

- `NODE_ENV=development` mounts Swagger UI at `/api/docs` and the raw
  OpenAPI document at `/api/docs-json`; in every other environment both
  return the normal 404 error envelope (no docs in production/staging).
- Title: "OcularCheck AI API"; the description carries the standing medical
  disclaimer: the screening aid **"does not replace a professional clinical
  diagnosis"**.
- Shared helpers live in `src/common/swagger/response-models.ts`:
  `ApiOkEnvelope(Model)` documents the `{ data, meta: { requestId } }` shape
  and `ApiErrorResponses(...statuses)` documents failures as the shared
  `error` envelope. Every enveloped endpoint uses both — see the test rig
  (`test/foundations-rig.module.ts`) for the reference usage.
- `GET /health/ready` is documented as a plain model (`ReadinessStatusDto`,
  200 + 503) because it is unwrapped (`@SkipEnvelope`); `GET /health` is
  hidden from the document (infra-only surface, byte-exact contract).
- A bearer JWT security scheme is advertised for the future auth endpoints;
  applying it to real routes comes with the Phase 3 auth task.
