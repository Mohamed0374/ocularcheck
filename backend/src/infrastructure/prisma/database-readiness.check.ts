import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';
import type { ReadinessCheck } from '../../modules/health/ports/readiness-check.js';

/**
 * Database readiness probe (P2-T4): a trivial query through PrismaService.
 *
 * Remote-dependency checks (Redis, storage, AI service) are added in later
 * tasks by adding new ReadinessCheck classes and one factory entry in
 * HealthModule — the readiness service/controller are never edited
 * (Open/Closed). Errors are intentionally NOT wrapped: the readiness layer
 * treats any rejection as "down".
 */
@Injectable()
export class DatabaseReadinessCheck implements ReadinessCheck {
  readonly name: string = 'database';

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async check(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
