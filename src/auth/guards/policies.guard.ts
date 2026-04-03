import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { User } from '../../users/entities/user.entity';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import {
  CHECK_POLICIES_KEY,
  type PolicyHandler,
} from '../decorators/check-policies.decorator';

/**
 * CASL attribute-level guard — evaluates @CheckPolicies() handlers.
 *
 * Run order: JwtAuthGuard → RolesGuard → PoliciesGuard.
 *
 * PoliciesGuard builds the caller's AppAbility and runs every registered
 * PolicyHandler.  ALL handlers must return true (AND semantics).
 *
 * This guard intentionally runs after role checks so that expensive
 * ability construction is only performed once coarse-grained RBAC has
 * already passed.
 */
@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const policyHandlers =
      this.reflector.get<PolicyHandler[]>(
        CHECK_POLICIES_KEY,
        context.getHandler(),
      ) ?? [];

    // No @CheckPolicies() — guard is a no-op.
    if (policyHandlers.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: User }>();
    const user = request.user;

    const ability = this.caslAbilityFactory.createForUser(user);

    const allPass = policyHandlers.every((handler) => handler(ability));
    if (!allPass) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
