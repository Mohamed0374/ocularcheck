import { SetMetadata } from '@nestjs/common';

/** Metadata key for the envelope opt-out (checked handler-then-class). */
export const SKIP_ENVELOPE_METADATA = 'ocularcheck:skipEnvelope';

/**
 * Opts an endpoint (or whole controller) out of the success envelope.
 * Used for infra probes (e.g. /health) and future raw-body endpoints.
 */
export const SkipEnvelope = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_ENVELOPE_METADATA, true);
