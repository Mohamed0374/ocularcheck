import type { IncomingMessage, ServerResponse } from 'node:http';
import { stdTimeFunctions, type DestinationStream } from 'pino';
import type { Options } from 'pino-http';

import { NodeEnv, type LogLevel } from '../config/env.validation.js';
import { resolveRequestId, requestIdHeaderValue } from '../common/request-id/request-id.js';

/** Inputs for the logger pipeline, taken only from the typed app config. */
export interface PinoRuntimeOptions {
  readonly nodeEnv: NodeEnv;
  readonly logLevel: LogLevel;
}

const REDACTED_VALUE = '[REDACTED]';

/** Keys whose values must never appear in logs wherever they are nested. */
const SECRET_KEYS: readonly string[] = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
];

const REDACT_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers.set-cookie',
  ...SECRET_KEYS.flatMap((key: string): readonly string[] => [key, `*.${key}`]),
];

/**
 * Single source of truth for the pino/pino-http pipeline:
 * - ISO timestamps, level from the validated config,
 * - request id via the pure resolver (echo valid client ids, else UUID),
 *   with the final value echoed into the X-Request-Id response header,
 * - serializers emitting ONLY method, path (no query), statusCode,
 *   responseTime, requestId — headers and bodies are never serialized,
 * - redaction as a second safety net (pino redact with [REDACTED]).
 * `destination` (test capture stream) is returned in the [options, stream]
 * tuple form (it overrides the pretty transport); pino-pretty is only
 * selected in development via its module path so production images never
 * need the package.
 */
export function buildPinoHttpOptions(
  options: PinoRuntimeOptions,
  destination?: DestinationStream,
): { pinoHttp: Options | [Options, DestinationStream] } {
  const pinoHttp: Options = {
    level: options.logLevel,
    timestamp: stdTimeFunctions.isoTime,
    redact: { paths: [...REDACT_PATHS], censor: REDACTED_VALUE },
    genReqId: (req: IncomingMessage, res: ServerResponse): string => {
      const id = resolveRequestId(requestIdHeaderValue(req));
      res.setHeader('x-request-id', id);
      return id;
    },
    serializers: {
      req: (req: IncomingMessage): Record<string, string | undefined> => {
        const id = (req as { id?: unknown }).id;
        return {
          method: req.method,
          path: typeof req.url === 'string' ? req.url.split('?')[0] : undefined,
          requestId: typeof id === 'string' ? id : undefined,
        };
      },
      res: (res: ServerResponse): Record<string, number> => ({ statusCode: res.statusCode }),
    },
  };

  if (destination !== undefined) {
    // pino only honors an explicit destination via the (options, stream)
    // tuple — a `stream` key inside the options object is ignored.
    return { pinoHttp: [pinoHttp, destination] };
  }

  if (options.nodeEnv === NodeEnv.Development) {
    // Worker-thread target: pino-pretty is not imported by this bundle.
    pinoHttp.transport = { target: 'pino-pretty', options: { colorize: true } };
  }
  return { pinoHttp };
}
