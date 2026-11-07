/**
 * Barrel of the exception-mapping strategies, in registration priority.
 * CommonModule consumes this ordering; see docs/api-conventions.md.
 */
export { AppExceptionMapper } from './app-exception.mapper.js';
export { FallbackMapper } from './fallback.mapper.js';
export { HttpExceptionMapper } from './http-exception.mapper.js';
export { PrismaExceptionMapper } from './prisma-exception.mapper.js';
