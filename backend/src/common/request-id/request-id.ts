import { randomUUID } from 'node:crypto';

/**
 * Request-Id correlation (Phase 2 · P2-T3) — pure, unit-tested functions.
 *
 * The incoming `X-Request-Id` header is accepted only if it matches
 * /^[A-Za-z0-9._-]{8,64}$/; otherwise a fresh random UUID is generated so a
 * malicious header (or its length/content) can never break log formats.
 */

const REQUEST_ID_PATTERN: RegExp = /^[A-Za-z0-9._-]{8,64}$/;

const UUID_PATTERN: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Resolves the request id for an incoming header value: echoes a well-formed
 * client id, otherwise generates a UUID. Values are data-only — nothing is
 * logged here.
 */
export function resolveRequestId(headerValue: unknown): string {
  if (typeof headerValue === 'string' && REQUEST_ID_PATTERN.test(headerValue)) {
    return headerValue;
  }
  return randomUUID();
}

/**
 * Returns the correlation id already assigned to the request (e.g. by
 * pino-http's genReqId), if it is a non-empty string; else undefined.
 */
export function readRequestId(request: unknown): string | undefined {
  if (typeof request !== 'object' || request === null) {
    return undefined;
  }
  const id = (request as { id?: unknown }).id;
  if (typeof id === 'string' && id.length > 0) {
    return id;
  }
  return undefined;
}

/**
 * Extracts the raw `x-request-id` header value from a request-like object
 * (string or first element of an array form), else undefined. Callers always
 * pass the result through `resolveRequestId` before trusting it.
 */
export function requestIdHeaderValue(request: unknown): string | undefined {
  if (typeof request !== 'object' || request === null) {
    return undefined;
  }
  const headers = (request as { headers?: unknown }).headers;
  if (typeof headers !== 'object' || headers === null) {
    return undefined;
  }
  const value = (headers as Record<string, unknown>)['x-request-id'];
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

/** Exported for tests: the exact UUID shape used for generated ids. */
export const GENERATED_ID_PATTERN: RegExp = UUID_PATTERN;
