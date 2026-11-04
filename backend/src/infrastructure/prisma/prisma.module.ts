import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';

/**
 * Global infrastructure module exposing PrismaService to every module
 * without repeated imports. Keep this free of business logic (Single
 * Responsibility); typed repositories/PFR ports arrive with the auth task.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
