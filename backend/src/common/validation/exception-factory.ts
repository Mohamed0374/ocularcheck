import type { ValidationError } from 'class-validator';

import type { ErrorDetail } from '../errors/app.exception.js';
import { ValidationFailedException } from '../errors/validation-failed.exception.js';

/**
 * ValidationPipe exceptionFactory: converts class-validator errors into
 * stable details { field, codes } — constraint NAMES only, nested fields as
 * dot paths (`contact.email`); constraint MESSAGES and the submitted values
 * are dropped (they could echo client input into the response).
 */
export function validationExceptionFactory(
  errors: readonly ValidationError[],
): ValidationFailedException {
  const details: ErrorDetail[] = [];
  collectDetails(errors, null, details);
  return new ValidationFailedException(details);
}

function collectDetails(
  errors: readonly ValidationError[],
  parentPath: string | null,
  out: ErrorDetail[],
): void {
  for (const error of errors) {
    const field = parentPath === null ? error.property : parentPath + '.' + error.property;
    const codes = Object.keys(error.constraints ?? {});
    if (codes.length > 0) {
      out.push({ field, codes });
    }
    if (error.children !== undefined && error.children.length > 0) {
      collectDetails(error.children, field, out);
    }
  }
}
