# Backend API conventions

- Status: active (P2-T3, plan §7)
- Date: 2026-11-07
- Related: ADR 0004 (decision record), ADR 0002 (typed configuration)

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
