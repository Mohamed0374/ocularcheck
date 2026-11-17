/**
 * API URL structure constants (Phase 2 · P2-T4) — single source of truth,
 * never scattered string literals.
 *
 * Feature routes resolve to /api/v1/<resource> (prefix + URI versioning with
 * default version "1"). Probe endpoints (/health, /health/ready) are
 * excluded from the prefix and marked VERSION_NEUTRAL, so their URLs remain
 * exactly /health and /health/ready (Docker healthcheck + CI contracts).
 */

/** Global URL prefix for every feature route. */
export const API_GLOBAL_PREFIX = 'api';

/** Default version used when a controller does not declare one (→ /api/v1). */
export const API_DEFAULT_VERSION = '1';

/** Path under the global prefix where Swagger UI is mounted (dev only). */
export const API_DOCS_PATH = 'api/docs';

/**
 * Full consumer URL paths derived from the constants above; convenience for
 * docs/tests only — the runtime values are the three constants above.
 * SwaggerModule.setup(API_DOCS_PATH) also serves the JSON document at
 * `/api/docs-json` automatically.
 */
export const API_DOCS_URL = `/${API_GLOBAL_PREFIX}/docs`;
export const API_DOCS_JSON_URL = `/${API_GLOBAL_PREFIX}/docs-json`;
