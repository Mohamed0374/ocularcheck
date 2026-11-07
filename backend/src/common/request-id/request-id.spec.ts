import { describe, expect, it } from 'vitest';

import {
  GENERATED_ID_PATTERN,
  readRequestId,
  requestIdHeaderValue,
  resolveRequestId,
} from './request-id.js';

describe('resolveRequestId', () => {
  it('echoes a well-formed client id (8-64 of [A-Za-z0-9._-])', () => {
    expect(resolveRequestId('abcd1234')).toBe('abcd1234');
    expect(resolveRequestId('A.9_-abcd_123.4567890123456789012345678901234567890123456789')).toBe(
      'A.9_-abcd_123.4567890123456789012345678901234567890123456789',
    );
  });

  it('rejects ids that are too short, too long, or contain illegal characters', () => {
    for (const bad of [
      'abcd123', // 7 chars → too short
      'a'.repeat(65), // 65 chars → too long
      'abcd 123', // space
      'x'.repeat(8) + '<script>',
      `x${String.fromCharCode(10)}y${String.fromCharCode(13)}zabc12`, // newlines
      'bad<value',
      'unicode-id-éabc',
    ]) {
      expect(resolveRequestId(bad), JSON.stringify(bad)).toMatch(GENERATED_ID_PATTERN);
    }
  });

  it('generates a UUID for undefined, null, arrays and other non-string values', () => {
    expect(resolveRequestId(undefined)).toMatch(GENERATED_ID_PATTERN);
    expect(resolveRequestId(null)).toMatch(GENERATED_ID_PATTERN);
    expect(resolveRequestId(['abcd1234'])).toMatch(GENERATED_ID_PATTERN);
    expect(resolveRequestId({})).toMatch(GENERATED_ID_PATTERN);
  });

  it('never echoes the raw malicious header', () => {
    const malicious = 'x'.repeat(8) + '<script>';
    expect(resolveRequestId(malicious)).not.toBe(malicious);
  });
});

describe('readRequestId', () => {
  it('returns an existing non-empty string id from a request-like object', () => {
    expect(readRequestId({ id: 'rid-1234' })).toBe('rid-1234');
    expect(readRequestId({ id: '' })).toBeUndefined();
    expect(readRequestId({})).toBeUndefined();
    expect(readRequestId(undefined)).toBeUndefined();
    expect(readRequestId({ id: 42 })).toBeUndefined();
  });
});

describe('requestIdHeaderValue', () => {
  it('extracts string and array header forms, else undefined', () => {
    expect(requestIdHeaderValue({ headers: { 'x-request-id': 'abcd1234' } })).toBe('abcd1234');
    expect(requestIdHeaderValue({ headers: { 'x-request-id': ['abcd1234', 'zzzzzzzz'] } })).toBe(
      'abcd1234',
    );
    expect(requestIdHeaderValue({ headers: {} })).toBeUndefined();
    expect(requestIdHeaderValue({})).toBeUndefined();
    expect(requestIdHeaderValue({ headers: { 'x-request-id': 7 } })).toBeUndefined();
  });
});
