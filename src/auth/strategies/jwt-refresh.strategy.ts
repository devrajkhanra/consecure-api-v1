import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

import type { JwtConfig } from '../../config/jwt.config';

/**
 * Refresh-token JWT payload shape.
 *
 * Distinct from the access-token payload:
 *  - `tokenId`  — the UUID of the refresh_tokens row, used for fast
 *                 lookup and revocation without scanning tokenHash.
 *  - `family`   — session chain UUID for reuse-attack detection.
 */
export interface JwtRefreshPayload {
  sub: string;
  tokenId: string;
  family: string;
}

/**
 * Passport JWT strategy for refresh tokens.
 *
 * Uses a separate secret (JWT_REFRESH_SECRET) so that compromise of one
 * secret does not undermine the other token type.
 *
 * The raw token string is captured from the request and attached to
 * `payload.rawToken` so AuthService can verify it against the stored
 * bcrypt hash.  Passport's `passReqToCallback: true` makes the `Request`
 * available as the first argument to `validate()`.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    const { refreshSecret } = configService.get<JwtConfig>('jwt')!;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: refreshSecret,
      passReqToCallback: true,
    });
  }

  validate(
    req: Request,
    payload: JwtRefreshPayload,
  ): JwtRefreshPayload & { rawToken: string } {
    // Extract the raw token from the Authorization header for hash comparison.
    const authHeader = req.headers['authorization'] ?? '';
    const rawToken = authHeader.replace(/^Bearer\s+/i, '');
    return { ...payload, rawToken };
  }
}
