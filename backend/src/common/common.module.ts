import { Module } from '@nestjs/common';

import { AllExceptionsFilter } from './errors/all-exceptions.filter.js';
import {
  AppExceptionMapper,
  FallbackMapper,
  HttpExceptionMapper,
  PrismaExceptionMapper,
} from './errors/mappers/index.js';
import { EXCEPTION_MAPPERS } from './errors/mapper.js';
import { EnvelopeInterceptor } from './envelope/envelope.interceptor.js';

/**
 * Cross-cutting HTTP conventions (Phase 2 · P2-T3).
 *
 * All exception-mapping strategies live under the single EXCEPTION_MAPPERS
 * token as an ordered array (first match wins; FallbackMapper last). Nest
 * does not concatenate duplicate `useClass` registrations for the same
 * custom token, so the mapper list is one array-valued provider — adding a
 * strategy later means adding one class here and one array entry, never
 * touching the filter (Open/Closed).
 */
@Module({
  providers: [
    {
      provide: EXCEPTION_MAPPERS,
      useValue: [
        new AppExceptionMapper(),
        new HttpExceptionMapper(),
        new PrismaExceptionMapper(),
        new FallbackMapper(),
      ],
    },
    AllExceptionsFilter,
    EnvelopeInterceptor,
  ],
  exports: [AllExceptionsFilter, EnvelopeInterceptor],
})
export class CommonModule {}
