import { describe, expect, it } from 'vitest';

import type { ReadinessCheck } from './ports/readiness-check.js';
import { READINESS_TIMEOUT_MS, ReadinessService } from './readiness.service.js';

class StaticCheck implements ReadinessCheck {
  constructor(
    readonly name: string,
    private readonly outcome: 'resolve' | 'reject' | 'hang',
  ) {}

  async check(): Promise<void> {
    if (this.outcome === 'reject') {
      throw new Error('password=SECRET123');
    }
    if (this.outcome === 'hang') {
      // Longer than the per-check deadline — the service must time it out.
      return new Promise<void>((resolve: (value: void) => void): void => {
        setTimeout(resolve, READINESS_TIMEOUT_MS + 60_000);
      });
    }
    await new Promise((resolve: (value: void) => void): void => {
      setTimeout(resolve, 1);
    });
  }
}

const upCheck = (): StaticCheck => new StaticCheck('ok-check', 'resolve');

class RecordingWarnSink {
  public readonly events: Array<Record<string, unknown>> = [];

  warn(event: Record<string, unknown>): void {
    this.events.push(event);
  }
}

function makeService(checks: readonly StaticCheck[]): {
  service: ReadinessService;
  sink: RecordingWarnSink;
} {
  const sink = new RecordingWarnSink();
  return { service: new ReadinessService(checks, sink), sink };
}

describe('ReadinessService', () => {
  it('reports ok when every check is up', async () => {
    const { service } = makeService([new StaticCheck('database', 'resolve'), upCheck()]);
    expect(await service.run()).toEqual({
      status: 'ok',
      checks: { database: 'up', 'ok-check': 'up' },
    });
  });

  it('reports down per failing check and hides the error — logs the name only', async () => {
    const { service, sink } = makeService([
      new StaticCheck('database', 'resolve'),
      new StaticCheck('redis', 'reject'),
    ]);
    const report = await service.run();
    expect(report).toEqual({ status: 'unavailable', checks: { database: 'up', redis: 'down' } });

    const serialized = JSON.stringify({ report, sinkEvents: sink.events });
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]).toEqual({ check: 'redis' });
    expect(serialized).not.toContain('SECRET123');
  });

  it('times out a hanging check within the per-check deadline', async () => {
    const { service, sink } = makeService([new StaticCheck('hanging', 'hang')]);
    const startedAt = Date.now();
    const report = await service.run();
    const elapsed = Date.now() - startedAt;

    expect(report).toEqual({ status: 'unavailable', checks: { hanging: 'down' } });
    // Well above the deadline, far below the hanging check's own resolve time.
    expect(elapsed).toBeGreaterThanOrEqual(READINESS_TIMEOUT_MS - 100);
    expect(elapsed).toBeLessThan(READINESS_TIMEOUT_MS + 10_000);
    expect(sink.events).toEqual([{ check: 'hanging' }]);
  });

  it('runs all checks in parallel (hanging one does not delay an up check)', async () => {
    const { service } = makeService([
      new StaticCheck('hanging', 'hang'),
      new StaticCheck('fast', 'resolve'),
    ]);
    const report = await service.run();
    expect(report.checks).toEqual({ hanging: 'down', fast: 'up' });
  });
});
