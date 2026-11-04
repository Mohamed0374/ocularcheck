import { Module } from '@nestjs/common';

import { AppConfigModule } from './config/config.module.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({ imports: [AppConfigModule, PrismaModule, HealthModule] })
export class AppModule {}
