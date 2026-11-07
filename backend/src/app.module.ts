import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { CommonModule } from './common/common.module.js';
import { buildPinoHttpOptions } from './bootstrap/pino-options.js';
import { appConfig, type AppConfig } from './config/app.config.js';
import { AppConfigModule } from './config/config.module.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    AppConfigModule,
    // Structured request logging; options come exclusively from the typed
    // app namespace (level + whether the pretty transport is allowed, which
    // resolves to true only for NODE_ENV=development).
    LoggerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (appCfg: AppConfig) =>
        buildPinoHttpOptions({ nodeEnv: appCfg.nodeEnv, logLevel: appCfg.logLevel }),
    }),
    CommonModule,
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
