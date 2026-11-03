import { registerAs } from '@nestjs/config';

/** Typed `ai` namespace (AI inference service client). */
export interface AiConfig {
  baseUrl: string;
  timeoutMs: number;
}

/**
 * Registration token for the `ai` namespace. Inject with
 * `@Inject(aiConfig.KEY) cfg: ConfigType<typeof aiConfig>`.
 */
export const aiConfig = registerAs('ai', (): AiConfig => ({
  baseUrl: process.env.AI_SERVICE_URL ?? '',
  timeoutMs: Number(process.env.AI_SERVICE_TIMEOUT_MS), // mirrors ENV_DEFAULTS
}));
