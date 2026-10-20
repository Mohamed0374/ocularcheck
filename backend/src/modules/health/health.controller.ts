import { Controller, Get } from '@nestjs/common';

interface HealthPayload {
  status: string;
  service: string;
}

@Controller('health')
export class HealthController {
  @Get()
  health(): HealthPayload {
    return { status: 'ok', service: 'ocularcheck-backend' };
  }
}
