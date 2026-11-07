import { describe, expect, it } from 'vitest';

import {
  BadRequestException,
  HttpException,
  HttpStatus,
  MethodNotAllowedException,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

import { HttpExceptionMapper } from './http-exception.mapper.js';

describe('HttpExceptionMapper', () => {
  const mapper = new HttpExceptionMapper();

  it('maps 404 (unknown routes) to NOT_FOUND', () => {
    expect(mapper.supports(new NotFoundException('No route details leak'))).toBe(true);
    expect(mapper.map(new NotFoundException('No route details leak'))).toEqual({
      httpStatus: 404,
      code: 'NOT_FOUND',
      message: 'Resource not found',
    });
  });

  it('maps 400 (malformed body syntax) to VALIDATION_FAILED with a generic message', () => {
    const error = new BadRequestException(`Unexpected token < in JSON: SUPERSECRET`);
    expect(mapper.supports(error)).toBe(true);
    const mapped = mapper.map(error);
    expect(mapped).toEqual({
      httpStatus: 400,
      code: 'VALIDATION_FAILED',
      message: 'The request payload is invalid',
    });
    expect(JSON.stringify(mapped)).not.toContain('SUPERSECRET');
  });

  it('maps 401/403/413/415/429 to their stable codes', () => {
    expect(mapper.map(new UnauthorizedException())).toEqual({
      httpStatus: 401,
      code: 'UNAUTHORIZED',
      message: 'Authentication is required',
    });
    expect(mapper.map(new ForbiddenException())).toEqual({
      httpStatus: 403,
      code: 'FORBIDDEN',
      message: 'Access to this resource is forbidden',
    });
    expect(mapper.map(new PayloadTooLargeException())).toEqual({
      httpStatus: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'The request payload is too large',
    });
    expect(mapper.map(new UnsupportedMediaTypeException())).toEqual({
      httpStatus: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'The request media type is not supported',
    });
    expect(mapper.map(new HttpException('rate limited', HttpStatus.TOO_MANY_REQUESTS))).toEqual({
      httpStatus: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests',
    });
    expect(mapper.map(new ConflictException('db says: table x' + 'SECRET'))).toEqual({
      httpStatus: 409,
      code: 'CONFLICT',
      message: 'The request conflicts with the current state',
    });
  });

  it('folds 405 (known path, wrong method) into NOT_FOUND, keeping the 405 status', () => {
    const error = new MethodNotAllowedException(['GET']);
    expect(mapper.supports(error)).toBe(true);
    expect(mapper.map(error)).toEqual({
      httpStatus: 405,
      code: 'NOT_FOUND',
      message: 'Resource not found',
    });
  });

  it('claims no responsibility for unmapped statuses (falls through to fallback)', () => {
    const error = new HttpException('teapot', 418);
    expect(mapper.supports(error)).toBe(false);
  });
});
