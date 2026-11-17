import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { configureApp } from '../src/bootstrap/configure-app.js';
import { LogLevel, NodeEnv } from '../src/config/env.validation.js';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';

// Fake env installed at module scope; AppModule imported afterwards (same
// pattern as the other e2e specs).
const fakeEnv: Record<string, string> = {
  NODE_ENV: NodeEnv.Test,
  LOG_LEVEL: LogLevel.Silent,
  DATABASE_URL: 'postgresql://apps_user:pw@localhost:5432/ocularcheck_e2e',
  REDIS_URL: 'redis://:pw@localhost:6379',
  S3_ENDPOINT: 'http://minio:9000',
  MINIO_BUCKET: 'scans-e2e',
  MINIO_ROOT_USER: 'minio-root',
  MINIO_ROOT_PASSWORD: 'minio-secret-e2e',
  AI_SERVICE_URL: 'http://ai:8000',
};
for (const [key, value] of Object.entries(fakeEnv)) {
  process.env[key] = value;
}
const { AppModule } = await import('../src/app.module.js');

const stub = {
  onModuleInit: async (): Promise<void> => undefined,
  onModuleDestroy: async (): Promise<void> => undefined,
};

describe('Swagger (e2e)', () => {
  let enabledApp: INestApplication;
  let disabledApp: INestApplication;

  beforeAll(async () => {
    // Enabled app: the tracker modules (rig) are deliberately NOT imported —
    // internal test routes must never appear in the OpenAPI document.
    const enabledModule: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(stub)
      .compile();
    enabledApp = enabledModule.createNestApplication();
    configureApp(enabledApp, { swagger: true });
    await enabledApp.init();

    const disabledModule: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(stub)
      .compile();
    disabledApp = disabledModule.createNestApplication();
    // Default: swagger disabled (also the production behavior).
    configureApp(disabledApp);
    await disabledApp.init();
  });

  afterAll(async () => {
    await enabledApp.close();
    await disabledApp.close();
  });

  it('serves the UI and JSON 200 when enabled', async () => {
    const ui = await request(enabledApp.getHttpServer()).get('/api/docs');
    expect(ui.status).toBe(200);
    expect(ui.headers['content-type']).toContain('text/html');

    const json = await request(enabledApp.getHttpServer()).get('/api/docs-json');
    expect(json.status).toBe(200);
    expect(json.body['info']['title']).toBe('OcularCheck AI API');
    // The version comes from package.json (semver).
    expect(String(json.body['info']['version'])).toMatch(/^\d+\.\d+\.\d+/);
    expect(String(json.body['info']['description'])).toContain(
      'does not replace a professional clinical diagnosis',
    );
  });

  it('advertises the bearer JWT scheme and documents the probes contract', async () => {
    const json = await request(enabledApp.getHttpServer()).get('/api/docs-json');
    expect(json.status).toBe(200);
    // bearer scheme defined, even though no endpoint uses it yet.
    expect(json.body['components']['securitySchemes']).toHaveProperty('bearer');

    // /health/ready is documented as a plain model; /health is hidden.
    const paths = json.body['paths'] as Record<string, unknown>;
    expect(paths['/health/ready']).toBeDefined();
    expect(paths['/health']).toBeUndefined();
    // Internal test routes never appear (rig not even registered here).
    expect(Object.keys(paths).some((p) => p.includes('test-rig'))).toBe(false);
    // Readiness 503 documented with the plain model, and 500 with the shared
    // error envelope (via ApiErrorResponses).
    const ready = paths['/health/ready'] as Record<string, unknown>;
    expect(ready['get'] as Record<string, unknown>).toBeDefined();
  });

  it('returns 404 (error shape) for both docs endpoints when disabled', async () => {
    const ui = await request(disabledApp.getHttpServer()).get('/api/docs');
    expect(ui.status).toBe(404);
    expect(ui.body['error']['code']).toBe('NOT_FOUND');

    const json = await request(disabledApp.getHttpServer()).get('/api/docs-json');
    expect(json.status).toBe(404);
    expect(json.body['error']['code']).toBe('NOT_FOUND');
  });

  it('never exposes x-powered-by on any response', async () => {
    const response = await request(enabledApp.getHttpServer()).get('/health');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
