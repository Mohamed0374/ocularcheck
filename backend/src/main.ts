import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { NodeEnv } from './config/env.validation.js';
import { configureApp } from './bootstrap/configure-app.js';
import { appConfig, type AppConfig } from './config/app.config.js';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  // logger:false mutes Nest's default console logger during factory boot; the
  // pino logger takes over as the application logger right after (single,
  // structured log format from nestjs-pino on).
  const app = await NestFactory.create(AppModule, { logger: false });
  // Shared production pipeline (logging, validation 422, error filter,
  // envelope, /api/v1 versioning, probes); the e2e tests call the exact
  // same function. Swagger is only exposed in development.
  const appCfg: AppConfig = app.get<AppConfig>(appConfig.KEY);
  configureApp(app, { swagger: appCfg.nodeEnv === NodeEnv.Development });
  await app.listen(appCfg.port, appCfg.host);
  // Bootstrap log through pino (port only, never other config values).
  app.get<Logger>(Logger).log(`Backend listening on port ${String(appCfg.port)}`);
}
await bootstrap();
