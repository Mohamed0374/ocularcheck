# 0002 — Typed, validated, fail-fast configuration

- Status: accepted
- Date: 2026-11-03
- Related: P2-T1 (OCULARCHECK_PLAN §7), infra local stack (P1-T5)

## Context

The backend previously read `process.env.PORT` directly in `main.ts`. Environment
variables arrive as unvalidated strings; typos and missing secrets otherwise
surface as runtime failures deep inside feature code, where they are hard to
attribute.

## Decision

- All environment access is centralised in `backend/src/config/` and enforced
  by an ESLint `no-restricted-properties` rule on `process.env` outside it.
- A class-validations schema (class-validator/class-transformer) validates raw
  env **names only** — error output lists variable names plus constraint
  reasons, never values, so secrets cannot leak into logs or stack traces.
- Configuration is exposed as small typed namespaces registered with
  `registerAs` (`app`, `database`, `redis`, `storage`, `ai`). Consumers inject
  `@Inject(ns.KEY) cfg: ConfigType<typeof ns>` — no string-key lookups —
  keeping modules decoupled from raw env and from `ConfigService.get()`.
- Validation runs at bootstrap (`ConfigModule.validate`): the application is
  fail-fast — it exits with the missing/invalid variable names when the
  environment is incomplete. Defaults exist only for `PORT`, `HOST`,
  `S3_REGION`, `AI_SERVICE_TIMEOUT_MS`; production supplies its own
  environment (`ignoreEnvFile` when `NODE_ENV=production`).

## Consequences

- Deployments with an incomplete environment crash immediately and loudly;
  CI (P1-T6) and the Docker stack (P1-T5) must therefore pass the full
  variable set — they do.
- Local S3 credentials reuse the MinIO root account until the security phase
  introduces a least-privilege service account (TODO recorded in
  `backend/.env.example`).
