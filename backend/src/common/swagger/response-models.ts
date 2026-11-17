import { applyDecorators, type Type } from '@nestjs/common';
import * as swagger from '@nestjs/swagger';

/**
 * Shared OpenAPI documentation models/decorators (Phase 2 · P2-T4).
 * Documentation-only: these classes are never used for runtime validation.
 * Later controllers wrap every documented endpoint in ApiOkEnvelope(Model)
 * and ApiErrorResponses(...) so Swagger always shows the P2-T3 conventions:
 * successes as { data, meta: { requestId } } and failures as { error }.
 *
 * Namespace access note: `import * as swagger` + `swagger.ApiX(...)` is used
 * instead of named imports because vitest's module transform has produced
 * broken named bindings for this package in some import-graph shapes, while
 * namespace access is stable in both vitest and plain Node ESM.
 */

/** Documentation mirror of one failed-constraint entry of the P2-T3 error body. */
export class ErrorDetailDto {
  @swagger.ApiProperty({
    example: 'contact.email',
    description: 'Dot path into the request payload',
  })
  readonly field!: string;

  @swagger.ApiProperty({
    example: ['isEmail'],
    type: [String],
    description: 'class-validator constraint names (never messages or submitted values)',
  })
  readonly codes!: string[];
}

/** Documentation mirror of the P2-T3 error payload (`error` object). */
export class ErrorResponseDto {
  @swagger.ApiProperty({
    description: 'Stable UPPER_SNAKE_CASE error code consumed by clients for localization',
    example: 'NOT_FOUND',
    enum: [
      'VALIDATION_FAILED',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'RATE_LIMITED',
      'PAYLOAD_TOO_LARGE',
      'UNSUPPORTED_MEDIA_TYPE',
      'INTERNAL_ERROR',
    ],
  })
  readonly code!: string;

  @swagger.ApiProperty({
    description: 'Generic developer message (constant per code, never localized)',
    example: 'Resource not found',
  })
  readonly message!: string;

  @swagger.ApiProperty({
    type: [ErrorDetailDto],
    required: false,
    description: 'Failed constraints; VALIDATION_FAILED responses only',
  })
  readonly details?: ErrorDetailDto[];

  @swagger.ApiProperty({
    description: 'Correlation id (same value as the X-Request-Id response header)',
  })
  readonly requestId!: string;

  @swagger.ApiProperty({ description: 'ISO-8601 server time' })
  readonly timestamp!: string;

  @swagger.ApiProperty({ description: 'Request path (query strings stripped)' })
  readonly path!: string;
}

/** Documentation model of the envelope meta block. */
export class EnvelopeMetaDto {
  @swagger.ApiProperty({
    description: 'Correlation id (echoed in the X-Request-Id header)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
  })
  readonly requestId!: string;
}

/**
 * Documents a success response wrapped in the P2-T3 envelope:
 * `{ data: <Model>, meta: { requestId } }`. Use on every enveloped endpoint.
 */
export function ApiOkEnvelope(model: Type<unknown>): MethodDecorator {
  return applyDecorators(
    swagger.ApiExtraModels(model, EnvelopeMetaDto),
    swagger.ApiOkResponse({
      schema: {
        properties: {
          data: { $ref: swagger.getSchemaPath(model) },
          meta: { $ref: swagger.getSchemaPath(EnvelopeMetaDto) },
        },
        required: ['data', 'meta'],
      },
    }),
  );
}

/* Short, per-status failure descriptions for the shared error envelope. */
const STATUS_DESCRIPTIONS: Readonly<Partial<Record<number, string>>> = Object.freeze({
  400: 'Malformed request body (syntax)',
  401: 'Authentication required',
  403: 'Access forbidden',
  404: 'Unknown path or method',
  409: 'Conflict with the current state',
  413: 'Request payload too large',
  415: 'Unsupported media type',
  422: 'Request payload failed the schema validation',
  429: 'Rate limited',
  500: 'Unexpected server error',
});

/**
 * Documents failure responses with the shared P2-T3 error envelope for the
 * given HTTP statuses. Unwrapped endpoints (probes) should use plain models
 * for controlled non-error statuses (e.g. readiness 503) and reserve this
 * helper for truly unexpected failures (500).
 */
export function ApiErrorResponses(...statuses: readonly number[]): MethodDecorator {
  return applyDecorators(
    ...statuses.map((status: number): MethodDecorator =>
      applyDecorators(
        swagger.ApiExtraModels(ErrorResponseDto),
        swagger.ApiResponse({
          status,
          description: STATUS_DESCRIPTIONS[status] ?? `HTTP ${String(status)}`,
          schema: {
            properties: {
              error: { $ref: swagger.getSchemaPath(ErrorResponseDto) },
            },
            required: ['error'],
          },
        }),
      ),
    ),
  );
}
