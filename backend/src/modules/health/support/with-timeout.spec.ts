import { describe, expect, it, vi } from 'vitest';

import { withTimeout } from './with-timeout.js';

describe('withTimeout', () => {
  it('resolves the wrapped value when the promise settles in time', async () => {
    await expect(
      withTimeout(
        (async (): Promise<string> => {
          await new Promise((resolve: (value: undefined) => void): void => {
            setTimeout(resolve, 5);
          });
          return 'value';
        })(),
        500,
      ),
    ).resolves.toBe('value');
  });

  it('propagates the original rejection', async () => {
    await expect(withTimeout(Promise.reject(new Error('original failure')), 500)).rejects.toThrow(
      'original failure',
    );
  });

  it('rejects with a timeout error when the promise hangs beyond the deadline', async () => {
    const hanging: Promise<never> = new Promise(() => undefined); // never settles
    await expect(withTimeout(hanging, 5)).rejects.toThrow('timed out after 5ms');
  });

  it('unrefs the expiry timer so it never keeps the process alive', async () => {
    // Wrapper timer: the ORIGINAL setTimeout keeps firing the callback (so
    // the timeout rejection still works), while `unref` is intercepted to
    // prove the helper calls it on the returned handle. The original is
    // captured BEFORE the spy so the wrapper does not recurse into itself.
    const originalSetTimeout: typeof setTimeout = globalThis.setTimeout.bind(globalThis);
    const unrefCalls: number[] = [];
    const patched = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
      handler: () => void,
      timeout?: number,
    ): NodeJS.Timeout => {
      const timer = originalSetTimeout(handler, timeout) as NodeJS.Timeout;
      const originalUnref = timer.unref.bind(timer);
      timer.unref = (): NodeJS.Timeout => {
        unrefCalls.push(1);
        return originalUnref();
      };
      return timer;
    }) as unknown as typeof setTimeout);
    try {
      const hanging: Promise<never> = new Promise(() => undefined);
      await expect(withTimeout(hanging, 5)).rejects.toThrow('timed out');
      expect(unrefCalls).toHaveLength(1);
    } finally {
      patched.mockRestore();
    }
  });
});
