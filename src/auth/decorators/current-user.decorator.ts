import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { User } from '../../users/entities/user.entity';

/**
 * Route parameter decorator that extracts the authenticated user from
 * the request object.  Passport's JwtStrategy attaches the validated
 * user to `req.user` after the JwtAuthGuard runs.
 *
 * Usage:
 *   async getProfile(@CurrentUser() user: User): Promise<UserResponseDto>
 *
 * IMPORTANT: This decorator must only be used on routes protected by
 * JwtAuthGuard.  On public routes `req.user` is undefined and the
 * decorator will return undefined, which may cause unexpected behaviour.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<Request & { user: User }>();
    return request.user;
  },
);
