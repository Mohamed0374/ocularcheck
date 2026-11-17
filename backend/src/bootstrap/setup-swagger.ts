import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';

import { API_DOCS_PATH } from '../common/api-version.js';

/**
 * Reads the backend package version for the OpenAPI `info.version` field
 * WITHOUT process.env and without touching the tsconfig: the resolved
 * package.json is parsed (JSON.parse → unknown → narrowed) so a missing or
 * malformed version fails loudly during development boot only.
 *
 * The relative depth matches BOTH the source layout (src/bootstrap/) and
 * the build output (dist Bootstrap dir keeps the same structure), so
 * `../../package.json` always resolves to backend/package.json.
 */
function readPackageVersion(): string {
  const raw: string = readFileSync(new URL('../../package.json', import.meta.url), 'utf8');
  const parsed: unknown = JSON.parse(raw) as unknown;
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    typeof (parsed as { version?: unknown }).version !== 'string'
  ) {
    throw new Error('package.json has no string "version" field');
  }
  return (parsed as { version: string }).version;
}

/** The medical disclaimer that must appear everywhere AI output is shown. */
const MEDICAL_DISCLAIMER =
  'AI output is a preliminary assessment and does not replace a professional clinical diagnosis.';

/**
 * Dev-only Swagger setup (called from configureApp with an explicit option —
 * never referenced in production or test boot):
 * UI at /api/docs, JSON at /api/docs-json (built-in sibling path).
 * A bearer JWT security scheme is already advertised although no endpoint
 * accepts one yet (auth arrives with Phase 3 tasks).
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('OcularCheck AI API')
    .setDescription(
      'OcularCheck AI backend — retinal scan screening aid.\n\n' +
        `Disclaimer: ${MEDICAL_DISCLAIMER}\n\n` +
        'Feature routes are versioned under /api/v1; infra probes live at /health and /health/ready ' +
        '(they are not part of the client API surface).',
    )
    .setVersion(readPackageVersion())
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // GET /health is deliberately hidden from the OpenAPI document: it is an
  // infra liveness probe with a byte-exact body contract (Docker healthcheck
  // + CI) — it is not consumer API surface, unlike /health/ready which stays
  // documented. Deleted here (dev layer) so the controller stays free of
  // swagger imports (also avoids a vite-transform named-import quirk).
  const paths = document.paths;
  if ('/health' in paths) {
    delete paths['/health'];
  }

  // The built-in sibling path exposes the raw document at /api/docs-json.
  SwaggerModule.setup(API_DOCS_PATH, app, document);
}
