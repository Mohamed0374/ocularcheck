import { describe, expect, it } from 'vitest';

import { FallbackMapper } from './fallback.mapper.js';

describe('FallbackMapper', () => {
  const mapper = new FallbackMapper();

  it('claims every error (last in the chain)', () => {
    expect(mapper.supports(new Error('x'))).toBe(true);
    expect(mapper.supports('string')).toBe(true);
    expect(mapper.supports(undefined)).toBe(true);
  });

  it('maps to the generic 500 INTERNAL_ERROR without echoing upstream content', () => {
    const error = new Error('secret db password=abc');
    const mapped = mapper.map(error);
    expect(mapped).toEqual({
      httpStatus: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
    expect(JSON.stringify(mapped)).not.toContain('secret');
    expect(JSON.stringify(mapped)).not.toContain('abc');
  });
});
