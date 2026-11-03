import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { NodeEnv } from '../src/config/env.validation.js';

// AppModule boots the validated config, and ConfigModule.forRoot validates
// during module evaluation — so deterministic fake values are installed at
// module scope (never read from a real .env file) and the app module is
// imported afterwards.
const fakeEnv: Record<string, string> = {
  NODE_ENV: NodeEnv.Test,
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

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    moduleRef.useLogger(false);
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 and the exact JSON body', async () => {
    const response = await request(app.getHttpServer()).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'ocularcheck-backend' });
  });
});
