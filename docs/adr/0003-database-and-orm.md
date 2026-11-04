# ADR 0003 — Database and ORM: Prisma ORM 7 + PostgreSQL 17/PostGIS

- Status: accepted
- Date: 2026-11-04
- Related: P2-T2 (OCULARCHECK_PLAN §7), infra local stack (P1-T5),
  ADR 0002 (typed configuration)

## Context

The backend needs relational storage for users, profiles, scans, clinics and
appointments (plan §3), with PostGIS for clinics later. P2-T1 delivered a
typed, validated configuration; this ADR records the persistence stack start
in P2-T2.

## Decision

- **PostgreSQL 17 with the PostGIS 3.5 extension** (already deployed locally
  since P1-T5): relational integrity with cascading FKs, `timestamptz`
  audit columns, geo queries, and a ubiquitous Docker story.
- **Prisma ORM 7.10.1** (stable line; npm's `latest` tag in Nov 2026 pointed
  at the 8.0.0-rc, which is not a stable release) with the **`prisma-client`
  generator** (TypeScript source emitted into `backend/src/generated/prisma`,
  compiled by `nest build`, never committed) and the mandatory
  **`@prisma/adapter-pg` driver adapter**. Migrations via `prisma migrate`;
  the CLI config lives in `backend/prisma.config.ts` where the datasource URL
  reads `process.env.DATABASE_URL` directly with a fallback so
  `prisma generate` runs in CI with neither database nor `.env` (the
  documented `env()` alternative would throw for every CLI command).
- Naming: plural snake_case tables/columns via `@@map`/`@map`, lowercase
  enum values, UUIDv7 primary keys, `timestamptz(6)`.
- Database-level safety beyond Prisma schema expressiveness (CHECK on
  lowercase email, non-blank full name) is added once, manually, inside the
  first migration; afterwards migrations are append-only.

## Alternatives considered

- **TypeORM** — decorator-heavy Active Record/Data Mapper with weaker
  locking-in of schema drift; migration generation is less deterministic;
  repo pattern would have to provide much boilerplate for type-safety.
- **Drizzle** — excellent and light, but at decision time the ESM/NestJS
  ecosystem tooling (drizzle-kit migration ergonomics, seeded `uuid(7)` and
  timestamptz defaults) was less turnkey for a monorepo with strict clean
  checkout CI; Prisma gives stricter CI determinism for the exact
  generate-without-DB requirement.
- **Raw SQL + pg only** — maximum control but hand-rolled migrations and
  typing invite drift; rejected for delivery speed in the plan's phases.

## Consequences

- The generated client must be regenerated after schema changes
  (`prisma:migrate:dev` does not always regenerate the client); build/test
  hooks run `prisma:generate` to keep clean checkouts correct.
- PostGIS-specific queries (nearby clinics, Phase 10) will not be expressible
  fully type-safely — they go through **Prisma raw SQL
  (`$queryRawUnsafe`/TypedSQL) or the pg adapter directly, with parameterized
  inputs only**, never string interpolation (security baseline).
- The rule "a doctor profile references a doctor-role user" is enforced in
  the service layer (P3), documented in `docs/database.md`; considered a
  trigger as a later hardening.
- Version shifts must re-validate: Prisma 8 is a significant evolution; an
  upgrade decision is deferred until it has a stable release and the docs
  recommend migration of existing projects.
