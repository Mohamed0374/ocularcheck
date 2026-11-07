import { Prisma } from '../../../generated/prisma/client.js';

import { CODE_DEFAULT_MESSAGES, ErrorCode } from '../error-codes.js';
import type { ExceptionMapper, MappedError } from '../mapper.js';

/**
 * Maps known Prisma request errors to stable codes. NOTHING from the Prisma
 * error object (message, meta target/column names, cause) is ever copied
 * into the response — those can reveal schema details.
 *
 * - P2002 (unique violation)  → 409 CONFLICT
 * - P2025 (record not found)  → 404 NOT_FOUND
 * - every other known request error → 500 INTERNAL_ERROR (generic message)
 * - unknown runtime errors    → 500 INTERNAL_ERROR (generic message)
 */
export class PrismaExceptionMapper implements ExceptionMapper {
  supports(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError
    );
  }

  map(error: unknown): MappedError {
    if (error instanceof Prisma.PrismaClientUnknownRequestError) {
      return {
        httpStatus: 500,
        code: ErrorCode.INTERNAL_ERROR,
        message: CODE_DEFAULT_MESSAGES.INTERNAL_ERROR,
      };
    }

    const prismaError = error as Prisma.PrismaClientKnownRequestError;
    switch (prismaError.code) {
      case 'P2002':
        return {
          httpStatus: 409,
          code: ErrorCode.CONFLICT,
          message: CODE_DEFAULT_MESSAGES.CONFLICT,
        };
      case 'P2025':
        return {
          httpStatus: 404,
          code: ErrorCode.NOT_FOUND,
          message: CODE_DEFAULT_MESSAGES.NOT_FOUND,
        };
      default:
        return {
          httpStatus: 500,
          code: ErrorCode.INTERNAL_ERROR,
          message: CODE_DEFAULT_MESSAGES.INTERNAL_ERROR,
        };
    }
  }
}
