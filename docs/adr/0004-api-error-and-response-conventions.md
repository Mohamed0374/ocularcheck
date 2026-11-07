# ADR 0004 — API error and response conventions

- Status: accepted
- Date: 2026-11-07
- Related: P2-T3 (OCULARCHECK_PLAN §7), ADR 0002 (typed configuration),
  `docs/api-conventions.md` (living reference)

## Context

The backend guarantees (plan §2, §4.4): stable machine-readable error codes,
leak-proof error messages (generic, never echoing framework/Prisma/user
content), one error format for every failure source, global validation, a
consistent success envelope, billable request-ID correlation, and structured
safe logging. Prior phases had Nest's default error body
(`{ statusCode, message, error }`) and no logging library.

## Decision

1. **Own error envelope, not RFC 9457 problem+json.**
   `{ error: { code, message, details?, requestId, timestamp, path } }`
   instead of `{ type, title, status, detail, instance }`.
   - The single `code` field is the contract the Flutter app localizes
     against (ARB strings keyed by stable UPPER_SNAKE_CASE codes); problem+json
     has no equivalent single-language-neutral key (`type` URIs would add
     vocabulary to maintain, `title` is English prose by definition).
   - `requestId` is first-class (correlation is a core P2 deliverable);
     RFC 9457 would push it into extensions anyway.
   - Wrapping failures in `error` mirrors our success `data` envelope, so
     clients use one discriminator rule (`data` | `error`).
2. **Success envelope `data`/`meta.requestId` with an opt-out decorator**
   (`@SkipEnvelope`). Bare payloads were rejected because future PDF
   downloads and HTML responses would create parser ambiguity for the mobile
   client ("is this object the data or the envelope?"); the decorator keeps
   infra endpoints like `/health` byte-exact for Docker healthchecks.
3. **9 stable codes, closed list**, mapped from HTTP status by four
   strategy mappers (`AppExceptionMapper`, `HttpExceptionMapper`,
   `PrismaExceptionMapper`, `FallbackMapper`) executed under one
   `EXCEPTION_MAPPERS` token; the catch-all filter contains no mapping logic
   (Open/Closed: new failure sources add a mapper class; nothing else edits).
4. **Validation failures → 422 Unprocessable Content.** The body parsed as
   JSON (syntactically valid) but violates the schema; 400 remains available
   for malformed *syntax* (body-parser JSON errors map to
   `VALIDATION_FAILED`/400 as a pragmatic Nest boundary). Consequence:
   clients can distinguish "fix your payload shape" (422) from "fix your
   request bytes" (400).
5. **405 folds into `NOT_FOUND`.** The method/resource pair reveals the
   existence of a route; treating wrong-method like unknown-path avoids a
   10th code (`METHOD_NOT_ALLOWED`) that no current endpoint needs. Status
   405 is preserved in `httpStatus` semantics; `code` is NOT_FOUND. If a
   future endpoint needs method-level negotiation, add the code then.
6. **NestJS pino logging** (`nestjs-pino` 5.3.1, `pino` 10.4.0,
   `pino-http` 11.0.0; `pino-pretty` 13.2.0 dev-only). JSON in
   production/test; pretty only in development (worker-thread target string,
   never a static import). Serializers emit only `method`, `path`,
   `statusCode`, `responseTime`, `requestId`; bodies and headers are never
   serialized, and a pino `redact` pass censors auth/session headers and
   secret-keyed fields to `[REDACTED]` as a second safety net.
7. **Request-ID in/out:** client-supplied `X-Request-Id` is echoed only when
   it matches `^[A-Za-z0-9._-]{8,64}$`, else a random UUID replaces it (a
   pure, unit-tested function echoes it into the response header via
   pino-http's `genReqId`); this prevents log-format injection while
   preserving cross-service traceability.
8. **Shared bootstrap:** `configure-app.ts` wires logger + ValidationPipe
   (whitelist, forbidNonWhitelisted, forbidUnknownValues, transform, no
   implicit conversion, custom exceptionFactory) + filter + envelope; both
   `main.ts` and the e2e tests call it so tests replicate production.

## Alternatives considered

- **RFC 9457 `application/problem+json`** — rejected per decision 1 (see
  also: media-type negotiation machinery we would pay for with zero current
  consumers).
- **GraphQL-style flat `{ errors: [...] }`** — REST is fixed by the plan.
- **Status-only mapping without codes** — statuses alone cannot express
  contract-stable semantics (mobile flips UI strings); codes win.
- **Logging wins without redact** — serializers alone are fragile against
  future code paths accidentally adding headers/fields; defense in depth.
- **`APP_FILTER`/`APP_INTERCEPTOR` tokens** instead of `configureApp` — they
  cannot install the ValidationPipe globally per module and would scatter
  the pipeline across modules; one bootstrap function keeps it reviewable.

## Consequences

- New feature exceptions only extend `AppException` (or add a mapper), so
  the filter/pipeline never changes again.
- The code list is closed at nine entries; adding an entry means updating
  `error-codes.ts`, `api-conventions.md`, and the mobile localization file —
  three places, deliberately (a contract change must be visible).
- pino-http's request line is the only place method/path appear; any debug
  logging of payloads must go through scrubbed structured events (rule §9).
- Tests: unit suites cover the pure functions and mappers (no leakage
  assertions), and three e2e specs under `backend/test/` drive the real
  rig (envelope, 422 details, 404/409/500 shapes, request-id echo/replace,
  log-line capture asserting secrets absent).
