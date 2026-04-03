import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { User } from '../../users/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { Role } from '../enums/role.enum';

/**
 * RBAC guard — evaluates the @Roles() decorator.
 *
 * Must be applied AFTER JwtAuthGuard so that `req.user` is already
 * populated when this guard runs.
 *
 * Semantics: OR — the user must possess at least one of the roles
 * declared in @Roles().  If the decorator is absent, the guard passes
 * (role enforcement is purely additive, not mandatory).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator — guard is a no-op for this route.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: User }>();
    const user = request.user;

    const hasRole = requiredRoles.some((role) => user.roles?.includes(role));
    if (!hasRole) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
