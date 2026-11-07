import { Controller, Get } from '@nestjs/common';

import { SkipEnvelope } from '../../common/envelope/skip-envelope.decorator.js';

interface HealthPayload {
  status: string;
  service: string;
}

// Infra probes and the Docker healthcheck depend on the exact current body —
// the success envelope is deliberately skipped for this endpoint.
@SkipEnvelope()
@Controller('health')
export class HealthController {
  @Get()
  health(): HealthPayload {
    return { status: 'ok', service: 'ocularcheck-backend' };
  }
}
