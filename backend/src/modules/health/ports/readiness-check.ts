/**
 * Readiness port (Phase 2 · P2-T4) — Dependency Inversion: the health module
 * depends on this interface and the multi-provider token, never on concrete
 * infrastructure classes.
 */

/** A single remote-dependency probe. Throws on failure. */
export interface ReadinessCheck {
  /** Stable check name, exposed as the key in the readiness body. */
  readonly name: string;

  /**
   * Runs one probe. Resolve = dependency up; reject/throw = down. NEVER
   * throw errors carrying credentials, hostnames or connection strings —
   * the readiness service logs only `check.name` on failure and the HTTP
   * body contains only "up"/"down" values.
   */
  check(): Promise<void>;
}

/**
 * Multi-check injection token. HealthModule binds ONE array-valued provider
 * under this token (ordered; duplicates would not concatenate in NestJS DI).
 * Later tasks add remote-dependency checks by adding new ReadinessCheck
 * classes and one factory entry — the readiness service/controller are
 * never edited (Open/Closed).
 */
export const READINESS_CHECKS: symbol = Symbol('READINESS_CHECKS');
