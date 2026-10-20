import { describe, expect, it } from 'vitest';

import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('returns the health payload with ok status and service name', () => {
    expect(new HealthController().health()).toEqual({
      status: 'ok',
      service: 'ocularcheck-backend',
    });
  });
});
