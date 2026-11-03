import { describe, expect, it } from 'vitest';

import { NodeEnv, ENV_DEFAULTS, validateEnvSync, type EnvVariables } from './env.validation.js';

/**
 * Deterministic full-valid environment used by most cases. Tests never read
 * the real .env file or the real process environment — inputs are built
 * explicitly here.
 */
const validEnv: Record<string, string> = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://apps_user:pw@localhost:5432/ocularcheck',
  REDIS_URL: 'redis://:pw@localhost:6379',
  S3_ENDPOINT: 'http://minio:9000',
  MINIO_BUCKET: 'scans-dev',
  S3_REGION: 'eu-west-1',
  MINIO_ROOT_USER: 'minio-root',
  MINIO_ROOT_PASSWORD: 'minio-secret-42',
  AI_SERVICE_URL: 'http://ai:8000',
  AI_SERVICE_TIMEOUT_MS: '2000',
};

describe('validateEnvSync (fail-fast env validation)', () => {
  it('accepts a complete environment and coerces values to the right types', () => {
    const result: EnvVariables = validateEnvSync(validEnv);

    expect(result.NODE_ENV).toBe(NodeEnv.Development);
    expect(result.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(result.REDIS_URL).toBe(validEnv.REDIS_URL);
    expect(result.S3_ENDPOINT).toBe(validEnv.S3_ENDPOINT);
    expect(result.MINIO_BUCKET).toBe(validEnv.MINIO_BUCKET);
    expect(result.S3_REGION).toBe('eu-west-1');
    expect(result.MINIO_ROOT_USER).toBe('minio-root');
    expect(result.MINIO_ROOT_PASSWORD).toBe('minio-secret-42');
    expect(result.AI_SERVICE_URL).toBe(validEnv.AI_SERVICE_URL);

    // numbers, not strings
    expect(typeof result.PORT).toBe('number');
    expect(typeof result.HOST).toBe('string');
    expect(typeof result.AI_SERVICE_TIMEOUT_MS).toBe('number');
  });

  it('applies defaults for PORT, HOST, S3_REGION and AI_SERVICE_TIMEOUT_MS when missing', () => {
    const partial: Record<string, string> = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://apps_user:pw@localhost:5432/ocularcheck',
      REDIS_URL: 'redis://:pw@localhost:6379',
      S3_ENDPOINT: 'http://minio:9000',
      MINIO_BUCKET: 'scans-dev',
      MINIO_ROOT_USER: 'minio-root',
      MINIO_ROOT_PASSWORD: 'minio-secret-42',
      AI_SERVICE_URL: 'http://ai:8000',
    };

    const result: EnvVariables = validateEnvSync(partial);

    expect(result.PORT).toBe(Number(ENV_DEFAULTS.PORT));
    expect(result.HOST).toBe(ENV_DEFAULTS.HOST);
    expect(result.S3_REGION).toBe(ENV_DEFAULTS.S3_REGION);
    expect(result.AI_SERVICE_TIMEOUT_MS).toBe(Number(ENV_DEFAULTS.AI_SERVICE_TIMEOUT_MS));
  });

  describe('missing required variables are named in the error', () => {
    const requiredNames: readonly string[] = [
      'NODE_ENV',
      'DATABASE_URL',
      'REDIS_URL',
      'S3_ENDPOINT',
      'MINIO_BUCKET',
      'MINIO_ROOT_USER',
      'MINIO_ROOT_PASSWORD',
      'AI_SERVICE_URL',
    ];

    for (const name of requiredNames) {
      it(`names ${name} when it is missing`, () => {
        const withoutOne: Record<string, string> = { ...validEnv };
        delete withoutOne[name];

        expect(() => validateEnvSync(withoutOne)).toThrowError(
          new RegExp(`Environment validation failed[\\s\\S]*- ${name}:`),
        );
      });
    }
  });

  describe('rejects invalid values and always names the variable', () => {
    type InvalidCase = Readonly<{ name: string; raw: Record<string, unknown> }>;

    const cases: readonly InvalidCase[] = [
      {
        name: 'PORT',
        raw: { ...validEnv, PORT: 'abc' },
      },
      {
        name: 'PORT',
        raw: { ...validEnv, PORT: '70000' },
      },
      {
        name: 'DATABASE_URL',
        raw: { ...validEnv, DATABASE_URL: 'mysql://apps_user:pw@localhost:3306/db' },
      },
      {
        name: 'REDIS_URL',
        raw: { ...validEnv, REDIS_URL: 'not-a-url' },
      },
      {
        name: 'AI_SERVICE_URL',
        raw: { ...validEnv, AI_SERVICE_URL: 'ftp://ai:8000' },
      },
      {
        name: 'NODE_ENV',
        raw: { ...validEnv, NODE_ENV: 'staging' },
      },
      {
        name: 'AI_SERVICE_TIMEOUT_MS',
        raw: { ...validEnv, AI_SERVICE_TIMEOUT_MS: 'zero' },
      },
      {
        name: 'MINIO_BUCKET',
        raw: { ...validEnv, MINIO_BUCKET: 'Not_A_Valid_Bucket' },
      },
    ];

    for (const testCase of cases) {
      it(`rejects an invalid ${testCase.name} and names it`, () => {
        expect(() => validateEnvSync(testCase.raw)).toThrowError(
          new RegExp(`Environment validation failed[\\s\\S]*- ${testCase.name}:`),
        );
      });
    }
  });

  it('never includes variable values in the error message', () => {
    const distinctive = 'super-secret-leak-marker-do-not-echo';
    const leakyEnv: Record<string, unknown> = {
      ...validEnv,
      // invalid on purpose so validation fails; marker only exists in a value
      DATABASE_URL: `mysql://user:${distinctive}@localhost:3306/db`,
      MINIO_ROOT_PASSWORD: distinctive,
    };

    let message = '';
    try {
      validateEnvSync(leakyEnv);
      expect.unreachable('expected validation to fail');
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : '';
    }

    expect(message).toContain('Environment validation failed');
    expect(message).toContain('DATABASE_URL:');
    expect(message).not.toContain(distinctive);
  });
});
