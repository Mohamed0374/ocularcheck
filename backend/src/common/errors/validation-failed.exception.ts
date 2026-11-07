import { CODE_DEFAULT_MESSAGES, ErrorCode } from './error-codes.js';
import type { ErrorDetail } from './app.exception.js';
import { AppException } from './app.exception.js';

/**
 * Thrown by the global ValidationPipe for schema-invalid payloads.
 * 422 Unprocessable Content (see docs/adr/0004): the body is syntactically
 * valid JSON but semantically invalid; 400 stays reserved for malformed
 * request syntax (e.g. unparseable bodies from body-parser).
 */
export class ValidationFailedException extends AppException {
  constructor(details: readonly ErrorDetail[]) {
    super({
      httpStatus: 422,
      code: ErrorCode.VALIDATION_FAILED,
      message: CODE_DEFAULT_MESSAGES.VALIDATION_FAILED,
      details,
    });
  }
}
