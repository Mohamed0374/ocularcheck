import { AppException } from '../app.exception.js';
import type { ExceptionMapper, MappedError } from '../mapper.js';

/**
 * Maps application exceptions (from Phase 3 feature code on) to the response
 * shape. The exception's own `message`/`safeMessage` is used as-is because
 * the class author (same repo) phrases it as a generic developer message.
 */
export class AppExceptionMapper implements ExceptionMapper {
  supports(error: unknown): boolean {
    return error instanceof AppException;
  }

  map(error: unknown): MappedError {
    const appError = error as AppException;
    const message = appError.resolvedMessage;
    return appError.details === undefined
      ? { httpStatus: appError.httpStatus, code: appError.code, message }
      : {
          httpStatus: appError.httpStatus,
          code: appError.code,
          message,
          details: appError.details,
        };
  }
}
