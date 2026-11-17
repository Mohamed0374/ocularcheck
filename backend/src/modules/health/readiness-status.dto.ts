import * as swagger from '@nestjs/swagger';

/**
 * Documentation model for GET /health/ready (P2-T4). The endpoint is
 * UNwrapped (@SkipEnvelope — infra probe), so it is documented as a plain
 * model, never through ApiOkEnvelope.
 *
 * Namespace access note: `swagger.ApiProperty(...)` is used instead of a
 * named import because vitest's module transform has produced broken named
 * bindings for @nestjs/swagger in some import-graph shapes, while namespace
 * access is stable in both vitest and plain Node ESM.
 */
export class ReadinessStatusDto {
  @swagger.ApiProperty({
    enum: ['ok', 'unavailable'],
    description: '"ok" when every registered check passed, else "unavailable"',
  })
  readonly status!: 'ok' | 'unavailable';

  @swagger.ApiProperty({
    description: 'One entry per registered ReadinessCheck, value "up" or "down" only',
    example: { database: 'up' },
    type: 'object',
    additionalProperties: { type: 'string', enum: ['up', 'down'] },
  })
  readonly checks!: Record<string, 'up' | 'down'>;
}
