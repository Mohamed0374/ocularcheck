import { registerAs } from '@nestjs/config';

/**
 * Typed `storage` namespace (S3-compatible object storage). In local dev the
 * access key/secret reuse the MinIO root credentials passed by infra/
 * docker-compose.yml; production always uses a least-privilege service
 * account (there and only there) once the storage feature lands.
 */
export interface StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Registration token for the `storage` namespace. Inject with
 * `@Inject(storageConfig.KEY) cfg: ConfigType<typeof storageConfig>`.
 */
export const storageConfig = registerAs('storage', (): StorageConfig => ({
  endpoint: process.env.S3_ENDPOINT ?? '',
  region: process.env.S3_REGION ?? 'us-east-1', // mirrors ENV_DEFAULTS in env.validation.ts
  bucket: process.env.MINIO_BUCKET ?? '',
  accessKeyId: process.env.MINIO_ROOT_USER ?? '',
  secretAccessKey: process.env.MINIO_ROOT_PASSWORD ?? '',
}));
