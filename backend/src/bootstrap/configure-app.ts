import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { AllExceptionsFilter } from '../common/errors/all-exceptions.filter.js';
import { EnvelopeInterceptor } from '../common/envelope/envelope.interceptor.js';
import { validationExceptionFactory } from '../common/validation/exception-factory.js';

/**
 * Shared application bootstrap (Phase 2 · P2-T3). main.ts AND every e2e
 * test call this, so tests exercise exactly the production pipeline:
 * pino request logging, the global validation pipe (422), the catch-all
 * error filter iterating the registered mappers, and the success envelope.
 */
export function configureApp(app: INestApplication): void {
  // Replace Nest's bootstrap logger with the pino logger (provided by
  // LoggerModule, imported by AppModule or the test's own module wiring).
  app.useLogger(app.get(Logger, { strict: false }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      // No implicit conversion: DTOs use explicit @Type (P2-T1 decision).
      exceptionFactory: validationExceptionFactory,
    }),
  );

  app.useGlobalInterceptors(app.get(EnvelopeInterceptor, { strict: false }));
  app.useGlobalFilters(app.get(AllExceptionsFilter, { strict: false }));
}
