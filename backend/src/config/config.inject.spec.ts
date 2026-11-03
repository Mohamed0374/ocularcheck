import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { ConfigType } from '@nestjs/config';

import { aiConfig, type AiConfig } from './ai.config.js';
import { appConfig, type AppConfig } from './app.config.js';
import { databaseConfig, type DatabaseConfig } from './database.config.js';
import { redisConfig, type RedisConfig } from './redis.config.js';
import { storageConfig, type StorageConfig } from './storage.config.js';
import { NodeEnv } from './env.validation.js';

/**
 * Proves the typed namespaces are injectable from the real module wiring.
 *
 * The environment is replaced with explicit, deterministic values BEFORE the
 * app module is imported: ConfigModule.forRoot runs validation during module
 * evaluation, so the values must exist at import time (never read from a real
 * .env file or from the developer's machine).
 */
const fakeEnv: Record<string, string> = {
  NODE_ENV: NodeEnv.Test,
  PORT: '3001',
  HOST: '127.0.0.1',
  DATABASE_URL: 'postgresql://apps_user:pw@localhost:5432/ocularcheck_test',
  REDIS_URL: 'redis://:pw@localhost:6379',
  S3_ENDPOINT: 'http://minio:9000',
  MINIO_BUCKET: 'scans-test',
  S3_REGION: 'eu-central-1',
  MINIO_ROOT_USER: 'minio-root',
  MINIO_ROOT_PASSWORD: 'minio-secret-test',
  AI_SERVICE_URL: 'http://ai:8000',
  AI_SERVICE_TIMEOUT_MS: '2500',
};
for (const [key, value] of Object.entries(fakeEnv)) {
  process.env[key] = value;
}
const { AppModule } = await import('../app.module.js');

describe('config namespaces (typed injection)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    moduleRef.useLogger(false);
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('features the app namespace with coerced values', () => {
    const cfg: ConfigType<typeof appConfig> = moduleRef.get<AppConfig>(appConfig.KEY);
    expect(cfg.nodeEnv).toBe(NodeEnv.Test);
    expect(cfg.port).toBe(3001);
    expect(cfg.host).toBe('127.0.0.1');
  });

  it('features the database namespace', () => {
    const cfg: ConfigType<typeof databaseConfig> = moduleRef.get<DatabaseConfig>(
      databaseConfig.KEY,
    );
    expect(cfg.url).toBe('postgresql://apps_user:pw@localhost:5432/ocularcheck_test');
  });

  it('features the redis namespace', () => {
    const cfg: ConfigType<typeof redisConfig> = moduleRef.get<RedisConfig>(redisConfig.KEY);
    expect(cfg.url).toBe('redis://:pw@localhost:6379');
  });

  it('features the storage namespace', () => {
    const cfg: ConfigType<typeof storageConfig> = moduleRef.get<StorageConfig>(storageConfig.KEY);
    expect(cfg.endpoint).toBe('http://minio:9000');
    expect(cfg.bucket).toBe('scans-test');
    expect(cfg.region).toBe('eu-central-1');
    expect(cfg.accessKeyId).toBe('minio-root');
    expect(cfg.secretAccessKey).toBe('minio-secret-test');
  });

  it('features the ai namespace with a coerced timeout', () => {
    const cfg: ConfigType<typeof aiConfig> = moduleRef.get<AiConfig>(aiConfig.KEY);
    expect(cfg.baseUrl).toBe('http://ai:8000');
    expect(cfg.timeoutMs).toBe(2500);
  });
});
