import { HttpException, HttpStatus } from '@nestjs/common';

import { CODE_DEFAULT_MESSAGES, ErrorCode } from '../error-codes.js';
import type { ExceptionMapper, MappedError } from '../mapper.js';

/**
 * HTTP status → stable code for Nest built-in exceptions. Deliberately
 * conservative: unmapped statuses claim no responsibility (the error falls
 * through to the FallbackMapper as 500) rather than inventing semantics.
 */
const STATUS_TO_CODE: Readonly<Partial<Record<number, ErrorCode>>> = Object.freeze({
  // Body-parser JSON syntax errors and similar malformed-syntax cases.
  // Schema-level payload problems (thrown by our ValidationPipe) use 422.
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  // Known-path/wrong-method requests are folded into NOT_FOUND (the stable
  // code list has no METHOD_NOT_ALLOWED — see docs/adr/0004).
  [HttpStatus.METHOD_NOT_ALLOWED]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.PAYLOAD_TOO_LARGE,
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
  // 422 is not an old HttpStatus enum member; spelled explicitly.
  422: ErrorCode.VALIDATION_FAILED,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
});

/**
 * Maps Nest built-in HttpExceptions (404 for unknown routes, 413, 415, …).
 * The upstream exception's message is NOT echoed — generic per-code
 * developer messages keep the response free of framework internals.
 */
export class HttpExceptionMapper implements ExceptionMapper {
  supports(error: unknown): boolean {
    return error instanceof HttpException && STATUS_TO_CODE[error.getStatus()] !== undefined;
  }

  map(error: unknown): MappedError {
    const httpError = error as HttpException;
    const status = httpError.getStatus();
    const code = STATUS_TO_CODE[status];
    if (code === undefined) {
      throw new TypeError(`HttpExceptionMapper called for unmapped status ${String(status)}`);
    }
    return { httpStatus: status, code, message: CODE_DEFAULT_MESSAGES[code] };
  }
}
