import { Module } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { DatabaseReadinessCheck } from '../../infrastructure/prisma/database-readiness.check.js';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { HealthController } from './health.controller.js';
import { ReadinessService, WarnLogSink } from './readiness.service.js';
import { READINESS_CHECKS } from './ports/readiness-check.js';

/**
 * Probe endpoints (P2-T4). The readiness check list is one array-valued
 * provider under READINESS_CHECKS (ordered; Nest does not concatenate
 * duplicate `provide` registrations for the same token): remote-dependency
 * checks are added later by adding one ReadinessCheck class and one entry
 * in this factory — the controller/service are never edited (Open/Closed).
 */
@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [
    {
      provide: READINESS_CHECKS,
      useFactory: (prisma: PrismaService): readonly DatabaseReadinessCheck[] => [
        new DatabaseReadinessCheck(prisma),
      ],
      inject: [PrismaService],
    },
    // Bind the pino logger to the readiness port's narrow warn-only surface
    // (Failure logs contain the check name only — never error details).
    { provide: WarnLogSink, useExisting: Logger },
    ReadinessService,
  ],
})
export class HealthModule {}
