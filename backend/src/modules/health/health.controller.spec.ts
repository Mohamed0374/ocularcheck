import type { Response } from 'express';
import { describe, expect, it } from 'vitest';

import { HealthController } from './health.controller.js';
import type { ReadinessReport } from './readiness.service.js';

type ReadinessStub = {
  run(): Promise<ReadinessReport>;
};

/** Minimal recording double for the passthrough response's status setter. */
function fakeResponse(): { readonly response: Response; readonly codes: number[] } {
  const codes: number[] = [];
  const response = {
    status: (code: number): Response => {
      codes.push(code);
      return response as unknown as Response;
    },
    statusCode: 0,
  } as unknown as Response;
  return { response, codes };
}

describe('HealthController', () => {
  it('returns the health payload with ok status and service name', () => {
    const stub: ReadinessStub = {
      run: (): Promise<ReadinessReport> => Promise.reject(new Error('not used')),
    };
    const controller = new HealthController(stub);
    expect(controller.health()).toEqual({
      status: 'ok',
      service: 'ocularcheck-backend',
    });
  });

  it('sets 200 for a passing readiness report and 503 for a failing one', async () => {
    const reports: ReadonlyArray<ReadinessReport> = [
      { status: 'ok', checks: { database: 'up' } },
      { status: 'unavailable', checks: { database: 'down' } },
    ];
    const upController = new HealthController({ run: () => Promise.resolve(reports[0]) });
    const downController = new HealthController({ run: () => Promise.resolve(reports[1]) });

    const up = fakeResponse();
    const upResult = await upController.ready(up.response);
    expect(up.codes).toEqual([200]);
    expect(upResult).toEqual(reports[0]);

    const down = fakeResponse();
    const downResult = await downController.ready(down.response);
    expect(down.codes).toEqual([503]);
    expect(downResult).toEqual(reports[1]);
  });
});
