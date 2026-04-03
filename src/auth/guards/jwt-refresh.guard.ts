import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard for the token-rotation endpoint (POST /auth/refresh).
 *
 * Uses the 'jwt-refresh' Passport strategy which validates the refresh
 * token's signature against JWT_REFRESH_SECRET (distinct from the access
 * token secret so that compromise of one does not undermine the other).
 *
 * Applied only to the refresh route — never registered globally.
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
