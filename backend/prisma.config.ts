import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma ORM 7 CLI configuration (Phase 2 · P2-T2).
 *
 * - `prisma generate` must work in a clean checkout WITHOUT a database and
 *   WITHOUT .env (CI): the official Prisma 7 docs prescribe reading the
 *   environment variable directly (not the `env()` helper) with a fallback,
 *   because the config file is loaded by every CLI command and `env()`
 *   would throw even for commands that never touch the database.
 * - `migrate`/`db` commands fail loudly on their own when the URL is empty.
 * - Relative paths in this file resolve from the file's directory (backend/).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
