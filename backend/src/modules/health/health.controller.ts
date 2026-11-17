import { Controller, Get, Res, VERSION_NEUTRAL } from '@nestjs/common';
import * as swagger from '@nestjs/swagger';
import type { Response } from 'express';

import { SkipEnvelope } from '../../common/envelope/skip-envelope.decorator.js';
import { ApiErrorResponses } from '../../common/swagger/response-models.js';
import { ReadinessService, type ReadinessReport } from './readiness.service.js';
import { ReadinessStatusDto } from './readiness-status.dto.js';

interface HealthPayload {
  status: string;
  service: string;
}

// VERSION_NEUTRAL + prefix exclusion keep these probe URLs unprefixed and
// unversioned (/health, /health/ready) — the Docker healthcheck and CI call
// them and depend on the exact current addresses and bodies.
//
// Visibility in Swagger: GET /health is HIDDEN (its path is deleted by
// setup-swagger.ts after document creation) — it is an infra liveness probe
// with a byte-exact contract, not consumer API surface. GET /health/ready is
// intentionally DOCUMENTED — it is the operational dipstick platform owners
// consult.
//
// The controller stays logic-free: it delegates to services and (for the
// dynamic 503) only sets the status code via a passthrough response.
//
// Namespace access note: `swagger.ApiX(...)` is used instead of named imports
// because vitest's module transform has produced broken named bindings for
// @nestjs/swagger in some import-graph shapes, while namespace access is
// stable in both vitest and plain Node ESM.
@SkipEnvelope()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly readiness: ReadinessService) {}

  // Hidden from Swagger by setup-swagger.ts (path deleted after document
  // creation — see the dev layer for the byte-exact contract rationale).
  @Get()
  health(): HealthPayload {
    return { status: 'ok', service: 'ocularcheck-backend' };
  }

  // Documentation (P2-T4): readiness is an UNwrapped infra probe — its 200
  // and 503 are plain models (not the error envelope); ApiErrorResponses(500)
  // is used for the truly unexpected path, which does surface the shared
  // error envelope via the global filter.
  @swagger.ApiOperation({
    description:
      'Aggregated dependency readiness — the body contains check names and "up"/"down" only',
  })
  @swagger.ApiOkResponse({ type: ReadinessStatusDto, description: 'Every registered check is up' })
  @swagger.ApiResponse({
    status: 503,
    type: ReadinessStatusDto,
    description: 'At least one check is down',
  })
  @ApiErrorResponses(500)
  @Get('ready')
  async ready(
    // Passthrough so interceptors keep working; we only set the status code.
    // Explicit @Res token: the express Response type is imported type-only,
    // so Nest cannot derive the injection from design metadata alone.
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReadinessReport> {
    const report = await this.readiness.run();
    // Controlled 503 (not a thrown error): the readiness body itself IS the
    // response — the P2-T3 error envelope would add nothing actionable.
    response.status(report.status === 'ok' ? 200 : 503);
    return report;
  }
}
