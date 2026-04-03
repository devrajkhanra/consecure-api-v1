import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Global JWT access-token guard.
 *
 * Registered as APP_GUARD in AppModule so every route is protected by
 * default.  Routes opt out with the @Public() decorator.
 *
 * Activation sequence:
 *   1. Check for @Public() metadata — skip auth if present.
 *   2. Delegate to passport-jwt ('jwt' strategy) for token extraction
 *      and verification.
 *   3. On success, `req.user` is populated with the validated User entity.
 *   4. On failure, throw UnauthorizedException (401).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | null, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException(
        err?.message ?? 'Authentication required',
      );
    }
    return user;
  }
}
