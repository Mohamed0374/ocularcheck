import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { aiConfig } from './ai.config.js';
import { appConfig } from './app.config.js';
import { databaseConfig } from './database.config.js';
import { redisConfig } from './redis.config.js';
import { storageConfig } from './storage.config.js';
import { validateEnvSync } from './env.validation.js';

/**
 * Validated, typed configuration wiring (Phase 2 · P2-T1).
 *
 * Design:
 * - Validation (`validateEnvSync`) is separate from typed access
 *   (registerAs namespaces) — Single Responsibility.
 * - Consumers depend on the typed namespaces below, never on process.env or
 *   string-key lookups — Dependency Inversion.
 *
 * Injection pattern for other modules (no `get('DATABASE_URL')` anywhere):
 *   @Inject(appConfig.KEY) private readonly appCfg: ConfigType<typeof appConfig>;
 *
 * process.env is read here (allowed: this IS src/config/). In production the
 * environment comes from the platform, so no .env file is loaded.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: false,
      validate: validateEnvSync,
      load: [appConfig, databaseConfig, redisConfig, storageConfig, aiConfig],
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
  ],
})
export class AppConfigModule {}
