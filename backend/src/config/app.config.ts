import { registerAs } from '@nestjs/config';

import { LogLevel, NodeEnv } from './env.validation.js';

/** Typed `app` namespace: node process identity + logging. */
export interface AppConfig {
  nodeEnv: NodeEnv;
  host: string;
  port: number;
  logLevel: LogLevel;
}

/**
 * Registration token for the `app` namespace. Inject with
 * `@Inject(appConfig.KEY) cfg: ConfigType<typeof appConfig>` — never via a
 * string key lookup.
 */
export const appConfig = registerAs('app', (): AppConfig => {
  return {
    nodeEnv: process.env.NODE_ENV as NodeEnv, // presence enforced by validateEnvSync
    host: process.env.HOST ?? '0.0.0.0', // mirrors ENV_DEFAULTS, must be kept in sync
    port: Number(process.env.PORT),
    logLevel: process.env.LOG_LEVEL as LogLevel, // optional-with-default, enforced by validateEnvSync
  };
});
