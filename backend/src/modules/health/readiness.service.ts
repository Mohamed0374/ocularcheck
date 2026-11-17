import { Inject, Injectable } from '@nestjs/common';

import { READINESS_CHECKS, type ReadinessCheck } from './ports/readiness-check.js';
import { withTimeout } from './support/with-timeout.js';

/** Per-check deadline in ms — a hanging dependency must not stall the probe. */
export const READINESS_TIMEOUT_MS = 2000;

/** Aggregate readiness report; check values are ONLY "up" or "down". */
export interface ReadinessReport {
  readonly status: 'ok' | 'unavailable';
  readonly checks: Readonly<Record<string, 'up' | 'down'>>;
}

/**
 * Structural logging port for readiness failures (narrow warn-only surface).
 * HealthModule binds it to the pino Logger via `useExisting`; e2e tests may
 * override it. Kept a (abstract) CLASS — not a type — because Nest needs a
 * runtime DI token; the service resolves it from design metadata.
 */
export abstract class WarnLogSink {
  abstract warn(event: Record<string, unknown>, message?: string): void;
}

/**
 * Runs all registered ReadinessChecks in parallel, each with its own
 * {@link READINESS_TIMEOUT_MS} deadline, and aggregates them into the
 * readiness report.
 *
 * Secrecy invariant: failures are logged server-side with the CHECK NAME
 * only (never the error, whose text may carry credentials/hosts), and the
 * HTTP body contains only check names and "up"/"down" values.
 */
@Injectable()
export class ReadinessService {
  constructor(
    @Inject(READINESS_CHECKS) private readonly checks: readonly ReadinessCheck[],
    private readonly logger: WarnLogSink,
  ) {}

  async run(): Promise<ReadinessReport> {
    const settled = await Promise.allSettled(
      this.checks.map(async (check: ReadinessCheck): Promise<void> =>
        withTimeout(check.check(), READINESS_TIMEOUT_MS),
      ),
    );

    const report: Record<string, 'up' | 'down'> = {};
    let allUp = true;
    for (let index = 0; index < this.checks.length; index += 1) {
      const check = this.checks[index];
      const outcome = settled[index];
      if (outcome === undefined) {
        allUp = false;
        report[check.name] = 'down';
        continue;
      }
      if (outcome.status === 'fulfilled') {
        report[check.name] = 'up';
      } else {
        allUp = false;
        report[check.name] = 'down';
        // Name only — the underlying error text is never logged or returned.
        this.logger.warn({ check: check.name });
      }
    }
    return { status: allUp ? 'ok' : 'unavailable', checks: report };
  }
}
