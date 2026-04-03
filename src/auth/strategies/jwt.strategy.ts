import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { JwtConfig } from '../../config/jwt.config';
import type { User } from '../../users/entities/user.entity';
import { AuthService } from '../auth.service';

/**
 * JWT access-token payload shape.
 * Kept deliberately minimal to reduce token size; the full User object
 * is re-fetched from the database so mutations (e.g. role changes,
 * deactivation) are reflected without waiting for token expiry.
 */
export interface JwtPayload {
  /** Subject — the user's UUID. */
  sub: string;
  email: string;
}

/**
 * Passport JWT strategy for access tokens.
 *
 * Extracts the Bearer token from the Authorization header and verifies
 * its signature against JWT_ACCESS_SECRET.  On success, `validate()`
 * is called with the decoded payload.
 *
 * The result of `validate()` is attached to `req.user` and becomes the
 * value returned by the `@CurrentUser()` decorator.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const { accessSecret } = configService.get<JwtConfig>('jwt')!;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessSecret,
    });
  }

  /**
   * Called after the JWT signature is verified.
   * Re-fetches the full user to pick up any changes since the token was issued.
   */
  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.authService.validateJwtUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists or is inactive');
    }
    return user;
  }
}
