import 'reflect-metadata';

import { Type, plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  Matches,
  validateSync,
  type ValidationError,
} from 'class-validator';

/**
 * Environment schema + fail-fast validation (Phase 2 · P2-T1).
 *
 * Rules of this module:
 * - The ONLY place in the backend allowed to touch process.env is
 *   `src/config/` (enforced by an ESLint rule).
 * - Validation knows variable NAMES only — error messages must never contain
 *   variable VALUES (secrets must not leak into logs or stack traces).
 * - Every required variable has NO default; the variables listed in
 *   `ENV_DEFAULTS` below are optional and silently applied when missing,
 *   before validation, so coercion and range checks still run on them.
 */

/** Exact nodeEnv values allowed by the plan (§3.2). */
export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Optional variables with built-in defaults, applied when absent from the
 * environment. Keys must match the env var names used by infra/
 * (.env.example, docker-compose.yml) — never invent other names.
 */
export const ENV_DEFAULTS: Readonly<Record<string, string>> = Object.freeze({
  PORT: '3000',
  HOST: '0.0.0.0',
  S3_REGION: 'us-east-1',
  AI_SERVICE_TIMEOUT_MS: '10000',
});

/** S3 bucket naming subset: lowercase letters, digits, dots, hyphens, 3-63 chars. */
const BUCKET_NAME_PATTERN = /^[a-z0-9][a-z0-9.-]{2,62}$/;

/**
 * Typed view of every environment variable the backend supports. Field names
 * ARE the env var names (this class is validated against raw env objects).
 */
export class EnvVariables {
  // --- app namespace --------------------------------------------------------
  // Explicit @Type coercion on every field: the Vite/esbuild test runner does
  // not emit decorator metadata, so enableImplicitConversion alone is not
  // reliable in tests. @Type works in every emitter.
  @Type(() => String)
  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  // Optional-with-default (merged from ENV_DEFAULTS before validation).
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65_535)
  PORT!: number;

  @Type(() => String)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  HOST!: string;

  // --- database namespace ----------------------------------------------------
  @Type(() => String)
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ['postgres', 'postgresql'] })
  DATABASE_URL!: string;

  // --- redis namespace ---------------------------------------------------------
  @Type(() => String)
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ['redis', 'rediss'] })
  REDIS_URL!: string;

  // --- storage namespace -------------------------------------------------------
  @Type(() => String)
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ['http', 'https'] })
  S3_ENDPOINT!: string;

  @Type(() => String)
  @Matches(BUCKET_NAME_PATTERN, { message: 'MINIO_BUCKET must be a valid S3 bucket name' })
  MINIO_BUCKET!: string;

  @Type(() => String)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  S3_REGION!: string;

  // Long-lived MinIO root credentials are reused for local development;
  // a least-privilege service account replaces them in the security phase.
  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  MINIO_ROOT_USER!: string;

  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  MINIO_ROOT_PASSWORD!: string;

  // --- ai namespace -----------------------------------------------------------
  @Type(() => String)
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ['http', 'https'] })
  AI_SERVICE_URL!: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  AI_SERVICE_TIMEOUT_MS!: number;
}

/**
 * Validates the CURRENT process environment. This is the ONLY sanctioned way
 * for code outside src/config/ (seed script, db:reset wrapper) to consume
 * environment values — process.env reads stay inside this module.
 */
export function loadValidatedEnv(): EnvVariables {
  return validateEnvSync({ ...process.env });
}

/**
 * Raw copy of the process environment, used only to spawn child processes
 * that need the parent's PATH/credentials (scripts/db-reset.ts spawns the
 * Prisma CLI). Values are never logged.
 */
export function rawEnv(): Record<string, string | undefined> {
  return { ...process.env };
}

/**
 * Applies ENV_DEFAULTS to variables missing from the raw environment, then
 * validates and coerces values into the typed shape. Throws ONE error naming
 * every invalid/missing variable with a reason; never any variable value.
 */
export function validateEnvSync(raw: Readonly<Record<string, unknown>>): EnvVariables {
  const merged: Record<string, unknown> = { ...ENV_DEFAULTS };
  for (const [key, value] of Object.entries(raw)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }

  const instance = plainToInstance(EnvVariables, merged, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(instance, {
    skipMissingProperties: false,
    whitelist: true,
  });

  if (errors.length > 0) {
    // Names + constraint reasons only — constraint messages are static and
    // never interpolate the offending value.
    const failed = errors.map((error: ValidationError) => {
      const reason: string = Object.values(error.constraints ?? {}).join('; ');
      return `${error.property}: ${reason}`;
    });
    throw new Error(
      ['Environment validation failed.', ...failed.map((line: string) => `  - ${line}`)].join('\n'),
    );
  }

  return instance;
}
