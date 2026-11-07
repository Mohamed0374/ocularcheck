import { CODE_DEFAULT_MESSAGES, type ErrorCode } from './error-codes.js';

/** One failed constraint on one payload field. Values are NEVER included. */
export interface ErrorDetail {
  /** Dot path into the verified JSON payload (nested objects joined by `.`). */
  field: string;
  /** class-validator constraint NAMES (`isEmail`, `minLength`), not messages. */
  codes: readonly string[];
}

/**
 * Base class for every exception that the backend throws on purpose.
 * Feature exceptions (P3+) extend this, so new failures only ADD classes —
 * the mapping pipeline stays untouched (Open/Closed).
 *
 * Invariant: `message`/`safeMessage` content is safe for HTTP responses —
 * short generic English without values, paths, SQL, or stack details.
 */
export abstract class AppException extends Error {
  readonly httpStatus: number;
  readonly code: ErrorCode;
  readonly details?: readonly ErrorDetail[];
  /** Optional response-message override (falls back to `Error.message`). */
  readonly safeMessage?: string;

  protected constructor(init: {
    httpStatus: number;
    code: ErrorCode;
    message: string;
    details?: readonly ErrorDetail[];
    safeMessage?: string;
  }) {
    super(init.message);
    this.name = new.target.name;
    this.httpStatus = init.httpStatus;
    this.code = init.code;
    this.details = init.details;
    this.safeMessage = init.safeMessage;
  }

  /**
   * Nullable default message keyed by the exception's code — used when the
   * subclass passes an empty message.
   */
  get resolvedMessage(): string {
    return this.isNotEmpty(this.safeMessage)
      ? this.safeMessage
      : this.isNotEmpty(this.message)
        ? this.message
        : CODE_DEFAULT_MESSAGES[this.code];
  }

  private isNotEmpty(value: string | undefined): value is string {
    return typeof value === 'string' && value.length > 0;
  }
}
