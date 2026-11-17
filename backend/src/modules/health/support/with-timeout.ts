/**
 * Rejects if the given promise has not settled within `milliseconds`
 * (Phase 2 · P2-T4). Used by ReadinessService so a hanging dependency can
 * never block the readiness probe longer than the deadline.
 *
 * The timer is unref-ed (Node) so a leftover timer never keeps the process
 * alive after the response has been sent.
 */
export function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise<T>((resolve: (value: T) => void, reject: (reason?: unknown) => void) => {
    const timer = setTimeout(() => {
      reject(new Error(`timed out after ${milliseconds}ms`));
    }, milliseconds);
    // Never keep the event loop alive just for the expiry timer.
    timer.unref?.();

    promise.then(
      (value: T): void => {
        clearTimeout(timer);
        resolve(value);
      },
      (reason: unknown): void => {
        clearTimeout(timer);
        reject(reason);
      },
    );
  });
}
