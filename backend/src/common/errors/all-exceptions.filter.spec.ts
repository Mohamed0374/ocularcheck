import type { ArgumentsHost } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';

import { AllExceptionsFilter, type ErrorLogSink } from './all-exceptions.filter.js';
import { AppExceptionMapper } from './mappers/app-exception.mapper.js';
import { FallbackMapper } from './mappers/fallback.mapper.js';
import { HttpExceptionMapper } from './mappers/http-exception.mapper.js';
import { PrismaExceptionMapper } from './mappers/prisma-exception.mapper.js';

/** Light structural fakes for the Express request/response and the host. */
interface LoggedEvent {
  readonly level: 'error' | 'warn';
  readonly event: Record<string, unknown>;
  readonly message?: string;
}

class RecordingSink implements ErrorLogSink {
  public readonly events: LoggedEvent[] = [];

  error(event: Record<string, unknown>, message?: string): void {
    this.events.push({ level: 'error', event, ...(message === undefined ? {} : { message }) });
  }

  warn(event: Record<string, unknown>, message?: string): void {
    this.events.push({ level: 'warn', event, ...(message === undefined ? {} : { message }) });
  }
}

class FakeResponse {
  public statusCode?: number;
  public body?: unknown;
  public readonly writableEnded: boolean = false;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(payload: unknown): unknown {
    this.body = payload;
    return payload;
  }
}

function makeHost(response: FakeResponse): ArgumentsHost {
  const request = { id: 'rid-0001', originalUrl: '/boom?secretquery=1' } as Partial<Request>;
  return {
    switchToHttp: (): { getRequest: () => Request; getResponse: () => Response } => ({
      getRequest: (): Request => request as Request,
      getResponse: (): Response => response as unknown as Response,
    }),
  } as unknown as ArgumentsHost;
}

function makeFilter(): {
  filter: AllExceptionsFilter;
  sink: RecordingSink;
  response: FakeResponse;
} {
  const sink = new RecordingSink();
  // Same registration order as CommonModule: application first, fallback last.
  const filter = new AllExceptionsFilter(
    [
      new AppExceptionMapper(),
      new HttpExceptionMapper(),
      new PrismaExceptionMapper(),
      new FallbackMapper(),
    ],
    sink,
  );
  return { filter, sink, response: new FakeResponse() };
}

describe('AllExceptionsFilter', () => {
  it('renders the generic INTERNAL_ERROR envelope for unexpected thrown errors — no leak', () => {
    const { filter, sink, response } = makeFilter();
    filter.catch(new Error('secret db password=abc'), makeHost(response));

    expect(response.statusCode).toBe(500);
    const error = (response.body as { error: Record<string, unknown> }).error;
    expect(error['code']).toBe('INTERNAL_ERROR');
    expect(error['message']).toBe('An unexpected error occurred');
    expect(error['requestId']).toBe('rid-0001');
    expect(error['path']).toBe('/boom');
    expect(typeof error['timestamp']).toBe('string');
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('abc');
    expect(serialized).not.toContain('secretquery'); // query strings are stripped

    // Server-side log: error level WITH stack, requestId, path, code.
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0].level).toBe('error');
    expect(typeof sink.events[0].event['stack']).toBe('string');
    expect(sink.events[0].event['requestId']).toBe('rid-0001');
    expect(sink.events[0].event['code']).toBe('INTERNAL_ERROR');
  });

  it('logs 4xx at warn level without a stack', () => {
    const { filter, sink, response } = makeFilter();
    filter.catch(new NotFoundException('No route'), makeHost(response));

    expect(response.statusCode).toBe(404);
    const error = (response.body as { error: Record<string, unknown> }).error;
    expect(error['code']).toBe('NOT_FOUND');
    expect(error['message']).toBe('Resource not found');

    expect(sink.events).toHaveLength(1);
    expect(sink.events[0].level).toBe('warn');
    expect(sink.events[0].event).toEqual({
      requestId: 'rid-0001',
      path: '/boom',
      code: 'NOT_FOUND',
    });
  });
});
