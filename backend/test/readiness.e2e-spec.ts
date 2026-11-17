import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Logger, PinoLogger } from 'nestjs-pino';

import { configureApp } from '../src/bootstrap/configure-app.js';
import { buildPinoHttpOptions } from '../src/bootstrap/pino-options.js';
import { LogLevel, NodeEnv } from '../src/config/env.validation.js';
import type { ReadinessCheck } from '../src/modules/health/ports/readiness-check.js';
import { READINESS_CHECKS } from '../src/modules/health/ports/readiness-check.js';
import { WarnLogSink } from '../src/modules/health/readiness.service.js';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';

// Capture stream for the pino lines of the "down" app (real format capture).
const logChunks: string[] = [];
const captureStream = new Writable({
  write(chunk: Buffer, _enc: BufferEncoding, callback: (error?: Error | null) => void): void {
    logChunks.push(chunk.toString('utf8'));
    callback();
  },
});

/**
 * Standalone capture: a nested-pino Logger on the SAME production options
 * writing into `captureStream`, plus the exact warn events of the "down"
 * app recorded for assertions.
 *
 * Note: overriding the `Logger` token does NOT propagate through the
 * HealthModule's `{ provide: WarnLogSink, useExisting: Logger }` alias in
 * the vitest module runner, so the SINK is overridden instead and it
 * forwards into a real pino logger — same production JSON format.
 */
const sinkEventsRaw: Array<Record<string, unknown>> = [];
const sinkEvents: ReadonlyArray<Record<string, unknown>> = sinkEventsRaw;
const { pinoHttp: capturePinoHttp } = buildPinoHttpOptions(
  { nodeEnv: NodeEnv.Test, logLevel: LogLevel.Info },
  captureStream,
);
const captureLogger = new Logger(new PinoLogger({ pinoHttp: capturePinoHttp }), {
  renameContext: '',
});

const SECRET_MARK = 'password=SECRET123';

// Fake checks whose names/outcomes the specific tests choose.
class StaticFakeCheck implements ReadinessCheck {
  constructor(
    readonly name: string,
    private readonly verdict: 'up' | 'down' | 'hang',
  ) {}

  async check(): Promise<void> {
    if (this.verdict === 'down') {
      throw new Error(SECRET_MARK);
    }
    if (this.verdict === 'hang') {
      // Never settles; no timer is created, so nothing keeps the process
      // alive after the spec finishes.
      return new Promise<void>(() => undefined);
    }
    await new Promise((resolve: (value: void) => void): void => {
      setTimeout(resolve, 1);
    });
  }
}

// AppModule validates the environment during module evaluation — fake values
// at module scope, then dynamic import (same pattern as the other e2e specs).
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

// Overrides MUST be chained on the TestingModule builder BEFORE compile()
// (there is no overrideProvider on a compiled module).
function buildApp(
  checks: readonly ReadinessCheck[],
  // The failing app captures its warn events + real pino-format log lines.
  captureWarns: boolean = false,
): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(stub)
    .overrideProvider(READINESS_CHECKS)
    .useValue(checks);
  if (captureWarns) {
    builder.overrideProvider(WarnLogSink).useValue({
      warn: (event: Record<string, unknown>): void => {
        sinkEventsRaw.push(event);
        captureLogger.warn(event);
      },
    });
  }
  return (async (): Promise<INestApplication> => {
    const moduleRef: TestingModule = await builder.compile();
    const created = moduleRef.createNestApplication();
    configureApp(created);
    await created.init();
    return created;
  })();
}

describe('Readiness (e2e)', () => {
  let upApp: INestApplication;
  let downApp: INestApplication;
  let hangingApp: INestApplication;

  beforeAll(async () => {
    const passAndFail = [new StaticFakeCheck('alpha', 'up'), new StaticFakeCheck('beta', 'up')];
    upApp = await buildApp(passAndFail);

    const failing = [new StaticFakeCheck('alpha', 'up'), new StaticFakeCheck('beta', 'down')];
    downApp = await buildApp(failing, true);

    const hangingOne = [new StaticFakeCheck('hanging', 'hang')];
    hangingApp = await buildApp(hangingOne);
  });

  afterAll(async () => {
    await upApp.close();
    await downApp.close();
    await hangingApp.close();
  });

  it('GET /health stays a pure liveness probe with the exact original body', async () => {
    const response = await request(upApp.getHttpServer()).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'ocularcheck-backend' });
  });

  it('GET /health/ready returns 200 with all checks up (and no envelope)', async () => {
    const response = await request(upApp.getHttpServer()).get('/health/ready');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', checks: { alpha: 'up', beta: 'up' } });
    // Probes are unwrapped (@SkipEnvelope): no data/meta wrapper here.
    expect(response.body['data']).toBeUndefined();
  });

  it('returns 503 when a check fails — body never carries error text', async () => {
    const response = await request(downApp.getHttpServer()).get('/health/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'unavailable', checks: { alpha: 'up', beta: 'down' } });
    expect(response.text).not.toContain('SECRET123');
    expect(response.text).not.toContain('password');
  });

  it('times out a hanging check within the deadline and reports it down', async () => {
    const response = await request(hangingApp.getHttpServer()).get('/health/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'unavailable', checks: { hanging: 'down' } });
  });

  it('never logs error details from failing checks (secret marker absent from logs)', async () => {
    // Flush the failure logged during the 503 test above.
    await new Promise((resolve: (value: undefined) => void): void => {
      setTimeout(resolve, 100);
    });
    const allLogs = logChunks.join('');
    expect(allLogs.length).toBeGreaterThan(0);
    expect(allLogs).not.toContain('SECRET123');
    expect(allLogs).not.toContain('password');
    // The warn event carries the check NAME only — both at the port boundary
    // and in the real pino-format log line it produced.
    expect(sinkEvents).toEqual([{ check: 'beta' }]);
    expect(allLogs).toContain('"check":"beta"');
  });

  it('exposes /health/ready outside the /api prefix (no version)', async () => {
    const response = await request(upApp.getHttpServer()).get('/health/ready');
    expect(response.status).toBe(200);
    // A prefixed form must NOT route to the readiness probe.
    const prefixed = await request(upApp.getHttpServer()).get('/api/v1/health/ready');
    expect(prefixed.status).toBe(404);
  });
});
