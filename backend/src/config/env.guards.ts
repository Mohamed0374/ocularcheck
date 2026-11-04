import type { EnvVariables } from './env.validation.js';

/**
 * Pure guard shared by dev-only database commands (seed, db:reset).
 * Production environments must never run destructive one-off scripts.
 * Throws a clear error naming the offending environment value — never any
 * secret values (it contains no variable values at all).
 */
export function assertNotProduction(env: EnvVariables): void {
  if (env.NODE_ENV === 'production') {
    throw new Error(
      `Refusing to run: NODE_ENV is "${env.NODE_ENV}". ` +
        'Seed and reset scripts are development-only commands.',
    );
  }
}
