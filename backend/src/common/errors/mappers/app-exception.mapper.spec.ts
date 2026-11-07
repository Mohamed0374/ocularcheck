import { describe, expect, it } from 'vitest';

import { ValidationFailedException } from '../validation-failed.exception.js';
import { AppException, type ErrorDetail } from '../app.exception.js';
import { ErrorCode } from '../error-codes.js';
import { AppExceptionMapper } from './app-exception.mapper.js';

/** Feature-style exception as later phases will write them (e.g. P3 auth). */
class TestRateLimitedException extends AppException {
  constructor() {
    super({
      httpStatus: 429,
      code: ErrorCode.RATE_LIMITED,
      safeMessage: 'Slow down and try again shortly',
    });
  }
}

class TestGenericInternalException extends AppException {
  constructor() {
    super({ httpStatus: 500, code: ErrorCode.INTERNAL_ERROR, message: '' });
  }
}

describe('AppExceptionMapper', () => {
  const mapper = new AppExceptionMapper();

  it('supports AppException subclasses and nothing else', () => {
    expect(mapper.supports(new Error('plain'))).toBe(false);
    expect(mapper.supports('string')).toBe(false);
    expect(mapper.supports(new ValidationFailedException([]))).toBe(true);
    expect(mapper.supports(new TestRateLimitedException())).toBe(true);
  });

  it('maps ValidationFailedException with its details (422 + VALIDATION_FAILED)', () => {
    const details: readonly ErrorDetail[] = [{ field: 'email', codes: ['isEmail'] }];
    const mapped = mapper.map(new ValidationFailedException(details));
    expect(mapped).toEqual({
      httpStatus: 422,
      code: 'VALIDATION_FAILED',
      message: 'The request payload is invalid',
      details,
    });
  });

  it('prefers safeMessage for the response message', () => {
    const mapped = mapper.map(new TestRateLimitedException());
    expect(mapped.httpStatus).toBe(429);
    expect(mapped.code).toBe('RATE_LIMITED');
    expect(mapped.message).toBe('Slow down and try again shortly');
  });

  it('falls back to the generic per-code message for an empty message', () => {
    const mapped = mapper.map(new TestGenericInternalException());
    expect(mapped.code).toBe('INTERNAL_ERROR');
    expect(mapped.message).toBe('An unexpected error occurred');
  });
});
