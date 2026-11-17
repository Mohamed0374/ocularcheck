import { INestApplication, RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { AllExceptionsFilter } from '../common/errors/all-exceptions.filter.js';
import { EnvelopeInterceptor } from '../common/envelope/envelope.interceptor.js';
import { validationExceptionFactory } from '../common/validation/exception-factory.js';
import { API_DEFAULT_VERSION, API_GLOBAL_PREFIX } from '../common/api-version.js';
import { setupSwagger } from './setup-swagger.js';

/** Explicit options so tests (and production boot) can toggle dev-only extras. */
export interface ConfigureAppOptions {
  /** Mount Swagger at /api/docs — main.ts passes nodeEnv === development only. */
  readonly swagger?: boolean;
}

/**
 * Probe endpoints excluded from the global prefix (they must stay reachable
 * at /health and /health/ready exactly — Docker healthcheck + CI contracts).
 */
const PREFIX_EXCLUDED_ROUTES: readonly { readonly path: string; readonly method: RequestMethod }[] =
  [
    { path: 'health', method: RequestMethod.GET },
    { path: 'health/ready', method: RequestMethod.GET },
  ];

/**
 * Shared application bootstrap (Phase 2 · P2-T3/P2-T4). main.ts AND every
 * e2e test call this, so tests exercise exactly the production pipeline:
 * pino request logging, the global validation pipe (422), the catch-all
 * error filter iterating the registered mappers, the success envelope,
 * the /api prefix with URI versioning (default v1), the disabled
 * X-Powered-By header, and (opt-in) the dev-only Swagger setup.
 */
export function configureApp(app: INestApplication, options?: ConfigureAppOptions): void {
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

  // Hardening: stop advertising the framework (Express) via the header.
  const express = app.getHttpAdapter().getInstance() as { disable(name: string): unknown };
  express.disable('x-powered-by');

  // Feature routes → /api/v1/<resource>; probes stay unprefixed + neutral.
  app.setGlobalPrefix(API_GLOBAL_PREFIX, {
    exclude: PREFIX_EXCLUDED_ROUTES.map((route) => ({ ...route })),
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: API_DEFAULT_VERSION });

  if (options?.swagger === true) {
    setupSwagger(app);
  }
}
