import { ValidationError } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { validationExceptionFactory } from './exception-factory.js';

const SECRET_VALUE = 'SUPERSECRET-VALUE-123';

describe('validationExceptionFactory', () => {
  it('emits dotted field paths and constraint names for nested payloads', () => {
    const nested = new ValidationError();
    nested.property = 'email';
    nested.constraints = { isEmail: `email ${SECRET_VALUE} must be an email` };

    const top = new ValidationError();
    top.property = 'contact';
    top.children = [nested];

    const scalar = new ValidationError();
    scalar.property = 'name';
    scalar.constraints = { minLength: 'name must be longer than or equal to 2 characters' };

    const exception = validationExceptionFactory([top, scalar]);
    expect(exception.httpStatus).toBe(422);
    expect(exception.code).toBe('VALIDATION_FAILED');
    expect(exception.details).toEqual([
      { field: 'contact.email', codes: ['isEmail'] },
      { field: 'name', codes: ['minLength'] },
    ]);
  });

  it('omits fields without constraints (routing-only nodes) and keeps constraint names only', () => {
    const parent = new ValidationError();
    parent.property = 'contact';
    parent.children = [];

    const exception = validationExceptionFactory([parent]);
    expect(exception.details).toEqual([]);
  });

  it('never echoes the submitted value into the exception (message or details)', () => {
    const error = new ValidationError();
    error.property = 'email';
    error.value = SECRET_VALUE; // would leak if we copied it
    error.constraints = { isEmail: `email ${SECRET_VALUE} must be an email` };

    const exception = validationExceptionFactory([error]);
    const serialized = JSON.stringify(exception);
    expect(serialized).not.toContain(SECRET_VALUE);
    expect(serialized).toContain('isEmail');
  });
});
