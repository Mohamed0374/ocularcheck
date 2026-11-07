import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { INestApplication } from '@nestjs/common';
import { Controller, Module, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { LoggerModule } from 'nestjs-pino';

import { configureApp } from '../src/bootstrap/configure-app.js';
import { buildPinoHttpOptions } from '../src/bootstrap/pino-options.js';
import { CommonModule } from '../src/common/common.module.js';
import { LogLevel, NodeEnv } from '../src/config/env.validation.js';

// Capture stream for every pino line emitted during this spec.
const logChunks: string[] = [];
const captureStream = new Writable({
  write(chunk: Buffer, _enc: BufferEncoding, callback: (error?: Error | null) => void): void {
    logChunks.push(chunk.toString('utf8'));
    callback();
  },
});

// A test-only controller: data bodies contain secret markers that must never
// reach the log lines (pino serializers only emit method/path/status…).
@Controller('logs-rig')
class LogsRigController {
  @Post()
  post(): { ok: true } {
    return { ok: true };
  }
}

@Module({
  imports: [
    CommonModule,
    // buildPinoHttpOptions already returns the { pinoHttp } Params shape —
    // wrapping it again would silently drop the options + destination.
    LoggerModule.forRoot(
      buildPinoHttpOptions({ nodeEnv: NodeEnv.Test, logLevel: LogLevel.Info }, captureStream),
    ),
  ],
  controllers: [LogsRigController],
})
class LogsRigModule {}

const TOKEN = 'SUPERSECRETTOKEN';
const PASSWORD = 'SUPERSECRETPW';

describe('Request logging (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [LogsRigModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs structured JSON without tokens, cookies, bodies — but with the request id', async () => {
    const response = await request(app.getHttpServer())
      .post('/logs-rig')
      .set('Authorization', `Bearer ${TOKEN}`)
      .set('Cookie', 'session=some-cookie-value')
      .send({ password: PASSWORD, email: 'someone@example.com' });

    // POST defaults to 201 Created; the JSON log line still reflects 201.
    expect(response.status).toBe(201);
    // Allow the finish-time log line to hit the capture stream.
    await new Promise((resolve: (value: void) => void): void => {
      setTimeout(resolve, 100);
    });

    const allLogs = logChunks.join('');
    expect(allLogs.length).toBeGreaterThan(0);
    // Parsed as JSON lines (production log format, even in tests).
    const lines = logChunks.map((chunk: string): Record<string, unknown> => JSON.parse(chunk));
    expect(lines.length).toBeGreaterThanOrEqual(1);

    const requestLine = lines.at(-1) as Record<string, unknown>;
    expect(requestLine['req']).toEqual(
      expect.objectContaining({ method: 'POST', path: '/logs-rig' }),
    );
    expect(typeof requestLine['responseTime']).toBe('number');
    expect((requestLine['res'] as Record<string, unknown>)['statusCode']).toBe(201);
    // No secrets, no headers, no bodies, no query strings in any line.
    expect(allLogs).not.toContain(TOKEN);
    expect(allLogs).not.toContain(PASSWORD);
    expect(allLogs).not.toContain('authorization');
    expect(allLogs).not.toContain('someone@example.com');
    expect(allLogs).not.toContain('session=some-cookie-value');
    // The correlation id is in the log line (serialized req) and response.
    const requestId = response.headers['x-request-id'] as string;
    expect(typeof requestId).toBe('string');
    expect(allLogs).toContain(requestId);
  });
});
