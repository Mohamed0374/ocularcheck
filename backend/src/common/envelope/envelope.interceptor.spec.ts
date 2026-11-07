import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { StreamableFile } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { ServerResponse } from 'node:http';
import { Buffer } from 'node:buffer';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { EnvelopeInterceptor } from './envelope.interceptor.js';
import { SKIP_ENVELOPE_METADATA } from './skip-envelope.decorator.js';

/**
 * Minimal structural fakes: the interceptor contract uses only
 * Reflector.getAllAndOverride, ExecutionContext.switchToHttp
 * (getRequest/getResponse) and CallHandler.handle, so the fakes implement
 * exactly those members. They are typed via one explicit cast to the
 * framework interface instead of a full fixture implementation.
 */
interface FakeSetup {
  readonly skip?: boolean;
  readonly requestId?: string;
  readonly statusCode?: number;
  readonly contentType?: string | undefined;
}

function makeContext(setup: FakeSetup): ExecutionContext {
  return {
    getHandler: (): unknown => 'handler-target',
    getClass: (): unknown => 'class-target',
    switchToHttp: (): {
      getRequest: () => unknown;
      getResponse: () => ServerResponse;
    } => ({
      getRequest: (): unknown => ({ id: setup.requestId }),
      getResponse: (): ServerResponse =>
        ({
          statusCode: setup.statusCode ?? 200,
          getHeader: (name: string): string | undefined =>
            name === 'content-type' ? setup.contentType : undefined,
        }) as unknown as ServerResponse,
    }),
  } as unknown as ExecutionContext;
}

function makeReflector(setup: FakeSetup): Reflector {
  return {
    getAllAndOverride: (key: string, sources: unknown[]): boolean | undefined =>
      sources.length > 0 && key === SKIP_ENVELOPE_METADATA && setup.skip === true
        ? true
        : undefined,
  } as unknown as Reflector;
}

function makeHandler(payload: unknown): CallHandler {
  return { handle: (): unknown => of(payload) } as unknown as CallHandler;
}

async function run(setup: FakeSetup, payload: unknown): Promise<unknown> {
  const interceptor = new EnvelopeInterceptor(makeReflector(setup));
  return firstValueFrom(interceptor.intercept(makeContext(setup), makeHandler(payload)));
}

describe('EnvelopeInterceptor', () => {
  it('wraps JSON responses in { data, meta: { requestId } }', async () => {
    await expect(run({ requestId: 'rid-1' }, { hello: 'world' })).resolves.toEqual({
      data: { hello: 'world' },
      meta: { requestId: 'rid-1' },
    });
  });

  it('keeps meta.requestId undefined when the request has no correlation id yet', async () => {
    await expect(run({}, { hello: 'world' })).resolves.toEqual({
      data: { hello: 'world' },
      meta: { requestId: undefined },
    });
  });

  it('skips the envelope when the handler/class is decorated with @SkipEnvelope', async () => {
    await expect(run({ skip: true, requestId: 'rid-2' }, { hello: 'world' })).resolves.toEqual({
      hello: 'world',
    });
  });

  it('passes through StreamableFile payloads untouched', async () => {
    const streamable = new StreamableFile(Buffer.from('%PDF-fake'));
    await expect(run({ requestId: 'rid-3' }, streamable)).resolves.toBe(streamable);
  });

  it('passes through Buffer payloads untouched', async () => {
    const buffer = Buffer.from('binary-pdf');
    await expect(run({ requestId: 'rid-4' }, buffer)).resolves.toBe(buffer);
  });

  it('passes through responses with a non-JSON declared content type', async () => {
    const object = { hello: 'world' };
    await expect(run({ requestId: 'rid-5', contentType: 'text/html' }, object)).resolves.toBe(
      object,
    );
  });

  it('does not wrap empty (204 No Content) responses', async () => {
    await expect(run({ requestId: 'rid-6', statusCode: 204 }, undefined)).resolves.toBeUndefined();
  });
});
