import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard for the login endpoint (POST /auth/login).
 *
 * Invokes the 'local' Passport strategy which delegates to
 * AuthService.validateCredentials() for email + bcrypt password
 * verification.  On success, the validated User entity is available
 * as `req.user` in the route handler.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
