import type { ErrorDetail } from './app.exception.js';
import type { ErrorCode } from './error-codes.js';

/** The normalized error the filter renders, whatever the origin. */
export interface MappedError {
  httpStatus: number;
  code: ErrorCode;
  message: string;
  details?: readonly ErrorDetail[];
}

/**
 * One mapping strategy. Each mapper owns one source family of exceptions;
 * the global filter merely iterates mappers in registration order (Open/Closed:
 * adding a source family = adding one mapper, no filter edits).
 */
export interface ExceptionMapper {
  /**
   * Whether this mapper owns the given error. Must be side-effect free and
   * must not throw for unsupported values.
   */
  supports(error: unknown): boolean;

  /** Builds the response mapping. Only called after `supports` returned true. */
  map(error: unknown): MappedError;
}

/**
 * Multi-provider token: every mapper class registers under this token in
 * CommonModule; the filter injects the ordered array (first match wins,
 * FallbackMapper registered last).
 */
export const EXCEPTION_MAPPERS: symbol = Symbol('EXCEPTION_MAPPERS');
