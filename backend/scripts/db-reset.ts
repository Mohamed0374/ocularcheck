import 'dotenv/config';

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { assertNotProduction } from '../src/config/env.guards.js';
import { loadValidatedEnv, rawEnv } from '../src/config/env.validation.js';

/**
 * db:reset wrapper — drops the database and replays ALL migrations. The
 * seed is run separately (npm run db:seed) because the Prisma 7 CLI reset
 * does not auto-run the configured seed. Development-only (the production
 * guard refuses NODE_ENV=production before anything destructive happens).
 * The Prisma CLI is invoked via the current node executable directly
 * (spawning `npx.cmd` on Windows is blocked since the CVE-2024-27980 node
 * spawn hardening) with the DATABASE_URL from the validated config layer.
 */
function resolvePrismaCli(): string {
  const candidates: readonly string[] = [
    path.resolve(fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url))),
    path.resolve('node_modules', 'prisma', 'build', 'index.js'),
  ];
  const found = candidates.find((candidate: string): boolean => existsSync(candidate));
  if (found === undefined) {
    throw new Error(`Prisma CLI not found (looked in ${candidates.length} locations)`);
  }
  return found;
}

function main(): void {
  const env = loadValidatedEnv();
  assertNotProduction(env);

  const run = spawnSync(process.execPath, [resolvePrismaCli(), 'migrate', 'reset', '--force'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
    env: {
      ...rawEnv(),
      CHECKPOINT_DISABLE: '1',
      PRISMA_HIDE_UPDATE_MESSAGE: '1',
      DATABASE_URL: env.DATABASE_URL,
    },
  });

  if (run.error !== undefined || run.status !== 0) {
    console.error('db:reset failed — see the Prisma output above.');
    process.exit(run.status !== null && run.status > 0 ? run.status : 1);
  }
}

main();
