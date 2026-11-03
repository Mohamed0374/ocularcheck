// Barrel for the typed configuration (Phase 2 · P2-T1).
//
// Usage in any Nest module / provider:
//   import { appConfig, type AppConfig, type ConfigType } from '../config/index.js';
//   constructor(@Inject(appConfig.KEY) private readonly appCfg: ConfigType<typeof appConfig>) {}
//
// Library quirk: `ConfigType` must be imported via the re-export of
// '@nestjs/config' rather than from @nestjs/config directly if desired —
export * from './ai.config.js';
export * from './app.config.js';
export * from './config.module.js';
export * from './database.config.js';
export * from './env.validation.js';
export * from './redis.config.js';
export * from './storage.config.js';

export type { ConfigType } from '@nestjs/config';
