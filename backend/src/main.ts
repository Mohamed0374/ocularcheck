import { NestFactory } from '@nestjs/core';

import { appConfig, type AppConfig } from './config/app.config.js';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // Typed app namespace (fail-fast validation already ran inside AppModule).
  const appCfg: AppConfig = app.get<AppConfig>(appConfig.KEY);
  await app.listen(appCfg.port, appCfg.host);
}
await bootstrap();
