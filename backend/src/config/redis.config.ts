import { registerAs } from '@nestjs/config';

/** Typed `redis` namespace. */
export interface RedisConfig {
  url: string;
}

/**
 * Registration token for the `redis` namespace. Inject with
 * `@Inject(redisConfig.KEY) cfg: ConfigType<typeof redisConfig>`.
 */
export const redisConfig = registerAs('redis', (): RedisConfig => ({
  url: process.env.REDIS_URL ?? '',
}));
