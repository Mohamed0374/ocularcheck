import { registerAs } from '@nestjs/config';

/** Typed `database` namespace. */
export interface DatabaseConfig {
  url: string;
}

/**
 * Registration token for the `database` namespace. Inject with
 * `@Inject(databaseConfig.KEY) cfg: ConfigType<typeof databaseConfig>`.
 */
export const databaseConfig = registerAs('database', (): DatabaseConfig => ({
  url: process.env.DATABASE_URL ?? '',
}));
