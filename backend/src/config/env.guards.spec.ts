import { describe, expect, it } from 'vitest';

import { assertNotProduction } from './env.guards.js';
import { NodeEnv, type EnvVariables } from './env.validation.js';

describe('assertNotProduction (dev-only command guard)', () => {
  const envFor = (nodeEnv: NodeEnv): EnvVariables =>
    ({
      NODE_ENV: nodeEnv,
      PORT: 3000,
      HOST: '0.0.0.0',
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      REDIS_URL: 'redis://:p@localhost:6379',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'eu-west-1',
      MINIO_BUCKET: 'scans-dev',
      MINIO_ROOT_USER: 'minio',
      MINIO_ROOT_PASSWORD: 'pw',
      AI_SERVICE_URL: 'http://localhost:8000',
      AI_SERVICE_TIMEOUT_MS: 10000,
    }) satisfies EnvVariables; // full validated shape, deterministic

  it('passes for development and test environments', () => {
    expect(() => assertNotProduction(envFor(NodeEnv.Development))).not.toThrow();
    expect(() => assertNotProduction(envFor(NodeEnv.Test))).not.toThrow();
  });

  it('refuses to run under NODE_ENV=production with a clear message, no secrets', () => {
    expect(() => assertNotProduction(envFor(NodeEnv.Production))).toThrowError(
      /NODE_ENV is "production"/,
    );
  });
});
