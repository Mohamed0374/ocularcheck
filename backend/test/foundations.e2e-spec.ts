import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { configureApp } from '../src/bootstrap/configure-app.js';
import { LogLevel, NodeEnv } from '../src/config/env.validation.js';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';
import { FoundationsRigModule } from './foundations-rig.module.js';

// AppModule validates the environment during module evaluation, so the fake
// values are installed at module scope (same pattern as health.e2e-spec.ts)
// and the app module is imported afterwards. LOG_LEVEL=silent keeps the
// JSON production-format logger quiet in test output.
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

const SECRET_VALUE = 'SUPERSECRET-VALUE-123';
const VALID_REQUEST_ID = 'e2e-valid-request-id-1234';

describe('API foundations (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule, FoundationsRigModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: async (): Promise<void> => undefined,
        onModuleDestroy: async (): Promise<void> => undefined,
      })
      .compile();
    app = moduleRef.createNestApplication();
    // Exact production pipeline — shared with main.ts.
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health keeps the exact original body (no envelope)', async () => {
    const response = await request(app.getHttpServer()).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'ocularcheck-backend' });
    expect(response.body['data']).toBeUndefined();
  });

  it('wraps a valid POST response in the success envelope and echoes a valid X-Request-Id', async () => {
    const response = await request(app.getHttpServer())
      .post('/test-rig/echo')
      .set('X-Request-Id', VALID_REQUEST_ID)
      .send({ email: 'user@example.com', name: 'Ada' });

    // POST defaults to 201 Created; the envelope applies to any success.
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      data: { email: 'user@example.com', name: 'Ada' },
      meta: { requestId: VALID_REQUEST_ID },
    });
    expect(response.headers['x-request-id']).toBe(VALID_REQUEST_ID);
  });

  it('returns 422 with stable details for a missing field — and never echoes values', async () => {
    const response = await request(app.getHttpServer())
      .post('/test-rig/echo')
      .set('X-Request-Id', VALID_REQUEST_ID)
      .send({ email: SECRET_VALUE, name: 'x' });

    expect(response.status).toBe(422);
    expect(response.body['error']['code']).toBe('VALIDATION_FAILED');
    expect(response.body['error']['message']).toBe('The request payload is invalid');
    const fields = (response.body['error']['details'] as Array<Record<string, unknown>>).map(
      (detail) => detail['field'],
    );
    expect(fields).toContain('email');
    expect(fields).toContain('name');
    const codes = (response.body['error']['details'] as Array<Record<string, unknown>>).flatMap(
      (detail) => detail['codes'] as string[],
    );
    expect(codes).toContain('isEmail');
    expect(codes).toContain('minLength');
    expect(response.text).not.toContain(SECRET_VALUE);
    expect(response.body['error']['requestId']).toBe(VALID_REQUEST_ID);
  });

  it('rejects non-whitelisted (extra) fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/test-rig/echo')
      .send({ email: 'user@example.com', name: 'Ada', extraField: 'zz' });

    expect(response.status).toBe(422);
    const fields = (response.body['error']['details'] as Array<Record<string, unknown>>).map(
      (detail) => detail['field'],
    );
    expect(fields).toContain('extraField');
    expect(fields).not.toContain('email');
  });

  it('reports wrong types through constraint names only', async () => {
    const response = await request(app.getHttpServer())
      .post('/test-rig/echo')
      .send({ email: 1234, name: 'Ada' });

    expect(response.status).toBe(422);
    const details = response.body['error']['details'] as Array<Record<string, unknown>>;
    const emailDetail = details.find((detail) => detail['field'] === 'email');
    expect(emailDetail?.['codes']).toContain('isEmail');
    expect(response.text).not.toContain('1234 is not');
  });

  it('builds nested dot paths for @ValidateNested payloads', async () => {
    const response = await request(app.getHttpServer())
      .post('/test-rig/nested')
      .send({ contact: { email: SECRET_VALUE } });

    expect(response.status).toBe(422);
    expect(response.body['error']['details']).toEqual([
      { field: 'contact.email', codes: ['isEmail'] },
    ]);
    expect(response.text).not.toContain(SECRET_VALUE);
  });

  it('renders unknown routes with the 404 error shape (NOT_FOUND)', async () => {
    const response = await request(app.getHttpServer())
      .get('/does-not-exist')
      .set('X-Request-Id', VALID_REQUEST_ID);

    expect(response.status).toBe(404);
    const error = response.body['error'];
    expect(error['code']).toBe('NOT_FOUND');
    expect(error['message']).toBe('Resource not found');
    expect(error['requestId']).toBe(VALID_REQUEST_ID);
    expect(error['path']).toBe('/does-not-exist');
    expect(typeof error['timestamp']).toBe('string');
    expect(response.body['data']).toBeUndefined();
  });

  it('hides unexpected errors behind the generic 500 message', async () => {
    const response = await request(app.getHttpServer()).post('/test-rig/throw');

    expect(response.status).toBe(500);
    const error = response.body['error'];
    expect(error['code']).toBe('INTERNAL_ERROR');
    expect(error['message']).toBe('An unexpected error occurred');
    expect(response.text).not.toContain('secret');
    expect(response.text).not.toContain('abc');
  });

  it('maps Prisma P2002 to 409 CONFLICT without meta leakage', async () => {
    const response = await request(app.getHttpServer()).post('/test-rig/prisma-conflict');

    expect(response.status).toBe(409);
    const error = response.body['error'];
    expect(error['code']).toBe('CONFLICT');
    expect(error['message']).toBe('The request conflicts with the current state');
    expect(response.text).not.toContain('email');
    expect(response.text).not.toContain('User');
    expect(response.text).not.toContain('Unique constraint');
  });

  it('replaces a malicious X-Request-Id with a generated UUID and echoes it consistently', async () => {
    const response = await request(app.getHttpServer())
      .post('/test-rig/echo')
      .set('X-Request-Id', 'bad<value')
      .send({ email: 'user@example.com', name: 'Ada' });

    expect(response.status).toBe(201);
    const echoed = response.headers['x-request-id'];
    expect(echoed).not.toBe('bad<value');
    expect(echoed).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(response.body['meta']['requestId']).toBe(echoed);
  });

  it('uses one correlation id end-to-end: error response equals the X-Request-Id header', async () => {
    const response = await request(app.getHttpServer())
      .get('/does-not-exist')
      .set('X-Request-Id', 'correlation-id-404-test');

    expect(response.status).toBe(404);
    expect(response.headers['x-request-id']).toBe('correlation-id-404-test');
    expect(response.body['error']['requestId']).toBe('correlation-id-404-test');
  });
});
