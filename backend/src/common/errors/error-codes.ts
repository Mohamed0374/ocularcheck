/**
 * Stable, contract-level error codes (Phase 2 · P2-T3).
 *
 * These codes are part of the API contract: the mobile app localizes from
 * `code`, never from `message`. New feature-specific codes are ADDED by later
 * tasks; existing codes must never change value or meaning.
 */
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Generic, developer-facing ENGLISH message per code. Never interpolated
 * with user input; UI localizes from `code`. Keeping the message constant
 * per code guarantees no upstream exception text (which may embed paths,
 * SQL fragments, or user values) ever reaches the response body.
 */
export const CODE_DEFAULT_MESSAGES: Readonly<Record<ErrorCode, string>> = Object.freeze({
  VALIDATION_FAILED: 'The request payload is invalid',
  UNAUTHORIZED: 'Authentication is required',
  FORBIDDEN: 'Access to this resource is forbidden',
  NOT_FOUND: 'Resource not found',
  CONFLICT: 'The request conflicts with the current state',
  RATE_LIMITED: 'Too many requests',
  PAYLOAD_TOO_LARGE: 'The request payload is too large',
  UNSUPPORTED_MEDIA_TYPE: 'The request media type is not supported',
  INTERNAL_ERROR: 'An unexpected error occurred',
});
