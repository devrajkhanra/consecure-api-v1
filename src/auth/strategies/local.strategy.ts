import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

import type { User } from '../../users/entities/user.entity';
import { AuthService } from '../auth.service';

/**
 * Passport Local strategy — validates email + password on POST /auth/login.
 *
 * Passport calls `validate()` after extracting the credentials from the
 * request body.  The return value is attached to `req.user` and passed
 * to the route handler.
 *
 * `usernameField: 'email'` overrides Passport's default of 'username'
 * so callers send `{ email, password }` instead of `{ username, password }`.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<User> {
    const user = await this.authService.validateCredentials(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user;
  }
}
