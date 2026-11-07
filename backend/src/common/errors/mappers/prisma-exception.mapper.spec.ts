import { describe, expect, it } from 'vitest';

import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaExceptionMapper } from './prisma-exception.mapper.js';

const CLIENT_VERSION = '7.10.1';

describe('PrismaExceptionMapper', () => {
  const mapper = new PrismaExceptionMapper();

  it('maps P2002 (unique violation) to 409 CONFLICT without any meta leakage', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: CLIENT_VERSION,
      meta: { target: ['email'], modelName: 'User' },
    });
    expect(mapper.supports(error)).toBe(true);
    const mapped = mapper.map(error);
    expect(mapped).toEqual({
      httpStatus: 409,
      code: 'CONFLICT',
      message: 'The request conflicts with the current state',
    });
    // The leak test: neither the constraint column nor the model name escapes.
    const serialized = JSON.stringify(mapped);
    expect(serialized).not.toContain('email');
    expect(serialized).not.toContain('User');
    expect(serialized).not.toContain('Unique constraint failed');
  });

  it('maps P2025 (record not found) to 404 NOT_FOUND', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: CLIENT_VERSION,
      meta: { cause: 'users_table_email_key' },
    });
    expect(mapper.map(error)).toEqual({
      httpStatus: 404,
      code: 'NOT_FOUND',
      message: 'Resource not found',
    });
    expect(JSON.stringify(mapper.map(error))).not.toContain('users_table');
  });

  it('maps every other known request error to 500 INTERNAL_ERROR (generic)', () => {
    const error = new Prisma.PrismaClientKnownRequestError('err-secret-ish', {
      code: 'P9999',
      clientVersion: CLIENT_VERSION,
      meta: { target: 'slow_secret_column_name' },
    });
    expect(mapper.map(error)).toEqual({
      httpStatus: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
    expect(JSON.stringify(mapper.map(error))).not.toContain('slow_secret_column_name');
  });

  it('maps unknown request errors (and plain exceptions) to 500 INTERNAL_ERROR', () => {
    const unknown = new Prisma.PrismaClientUnknownRequestError('unknown blast radius', {
      clientVersion: CLIENT_VERSION,
    });
    expect(mapper.supports(unknown)).toBe(true);
    expect(mapper.map(unknown)).toEqual({
      httpStatus: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  });
});
