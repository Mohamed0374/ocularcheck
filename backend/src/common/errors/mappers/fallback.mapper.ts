import { CODE_DEFAULT_MESSAGES, ErrorCode } from '../error-codes.js';
import type { ExceptionMapper, MappedError } from '../mapper.js';

/**
 * Last-resort mapper: anything unidentified becomes 500 INTERNAL_ERROR with
 * the generic message. Registered LAST in the mapper chain.
 */
export class FallbackMapper implements ExceptionMapper {
  supports(): boolean {
    return true;
  }

  map(): MappedError {
    return {
      httpStatus: 500,
      code: ErrorCode.INTERNAL_ERROR,
      message: CODE_DEFAULT_MESSAGES.INTERNAL_ERROR,
    };
  }
}
