import { Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { StreamableFile } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { readRequestId } from '../request-id/request-id.js';
import { SKIP_ENVELOPE_METADATA } from './skip-envelope.decorator.js';

/**
 * Wraps successful JSON responses in { data, meta: { requestId } }.
 *
 * Passes through UNtouched:
 * - endpoints (or controllers) annotated with @SkipEnvelope(),
 * - non-JSON content types and binary payloads (StreamableFile / Buffer —
 *   future PDF downloads are never stringified into an envelope),
 * - empty responses (204/304).
 */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip === true) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const requestId = readRequestId(http.getRequest());

    return next
      .handle()
      .pipe(
        map((payload: unknown): unknown =>
          this.wrap(http.getResponse<Response>(), payload, requestId),
        ),
      );
  }

  private wrap(response: Response, payload: unknown, requestId: string | undefined): unknown {
    if (payload === undefined || payload === null) {
      return payload;
    }
    if (payload instanceof StreamableFile || Buffer.isBuffer(payload)) {
      return payload;
    }
    if (response.statusCode === 204 || response.statusCode === 304) {
      return payload;
    }
    const contentType = response.getHeader('content-type');
    if (
      typeof contentType === 'string' &&
      !contentType.toLowerCase().includes('application/json')
    ) {
      return payload;
    }
    return { data: payload, meta: { requestId } };
  }
}
