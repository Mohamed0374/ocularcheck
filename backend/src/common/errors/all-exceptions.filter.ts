import { Inject } from '@nestjs/common';
import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';

import { readRequestId, resolveRequestId } from '../request-id/request-id.js';
import { CODE_DEFAULT_MESSAGES, ErrorCode } from './error-codes.js';
import type { ErrorDetail } from './app.exception.js';
import { EXCEPTION_MAPPERS, type ExceptionMapper, type MappedError } from './mapper.js';

/**
 * Structural logging port (pino Logger satisfies it) — kept narrow so unit
 * tests can capture events without depending on pino's full surface.
 */
export type ErrorLogSink = {
  error(event: Record<string, unknown>, message?: string): void;
  warn(event: Record<string, unknown>, message?: string): void;
};

/** Response body shape for EVERY error, matching docs/api-conventions.md. */
interface ErrorResponseBody {
  code: ErrorCode;
  message: string;
  details?: readonly ErrorDetail[];
  requestId: string;
  timestamp: string;
  path: string;
}

/** Defensive default used only if the mapper chain produced nothing. */
const UNMAPPED_FALLBACK: MappedError = {
  httpStatus: 500,
  code: ErrorCode.INTERNAL_ERROR,
  message: CODE_DEFAULT_MESSAGES.INTERNAL_ERROR,
};

/**
 * Global catch-all filter. Contains NO mapping logic: it iterates the
 * registered {@link ExceptionMapper}s (Open/Closed) and renders the single
 * error envelope. 5xx are logged server-side at error level WITH the stack;
 * 4xx at warn level without stack and without request/response bodies.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject(EXCEPTION_MAPPERS) private readonly mappers: readonly ExceptionMapper[],
    @Inject(Logger) private readonly logger: ErrorLogSink,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    if (response.writableEnded) {
      return;
    }

    const requestId = readRequestId(request) ?? resolveRequestId(undefined);
    const path = request.originalUrl.split('?')[0];
    const mapped = this.firstMapped(exception);

    if (mapped.httpStatus >= 500) {
      // Server-side only: the stack never leaves the process.
      this.logger.error({
        requestId,
        path,
        code: mapped.code,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    } else {
      this.logger.warn({ requestId, path, code: mapped.code });
    }

    const body: ErrorResponseBody = {
      code: mapped.code,
      message: mapped.message,
      ...(mapped.details === undefined ? {} : { details: mapped.details }),
      requestId,
      timestamp: new Date().toISOString(),
      path,
    };
    response.status(mapped.httpStatus).json({ error: body });
  }

  /** First mapper that claims the error; a throwing mapper is skipped. */
  private firstMapped(exception: unknown): MappedError {
    for (const mapper of this.mappers) {
      try {
        if (mapper.supports(exception)) {
          return mapper.map(exception);
        }
      } catch {
        // A broken mapper must never break the error path; the next
        // (and always-matching Fallback) mapper handles the error.
      }
    }
    return UNMAPPED_FALLBACK;
  }
}
