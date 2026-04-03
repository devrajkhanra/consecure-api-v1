import { SetMetadata } from '@nestjs/common';

/**
 * Mark a route as publicly accessible — the global JwtAuthGuard will
 * skip token validation for any handler decorated with @Public().
 *
 * Usage:
 *   @Public()
 *   @Post('login')
 *   async login(...) {}
 *
 * Convention: only use @Public() on authentication endpoints (login,
 * register, refresh) and truly unauthenticated resources.  Default to
 * requiring a valid JWT; opt-out explicitly rather than opt-in.
 */
export const IS_PUBLIC_KEY = 'isPublic' as const;
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
