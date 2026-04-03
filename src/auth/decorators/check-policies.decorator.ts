import { SetMetadata } from '@nestjs/common';

import type { AppAbility } from '../casl/casl-ability.factory';

/**
 * Policy handler function type.
 *
 * A policy handler receives the caller's CASL `AppAbility` instance and
 * returns a boolean indicating whether the action is permitted.
 *
 * Example:
 *   const handler: PolicyHandler = (ability) =>
 *     ability.can(Action.Read, User);
 */
export type PolicyHandler = (ability: AppAbility) => boolean;

/**
 * Attach one or more CASL policy handlers to a route.
 * Evaluated by PoliciesGuard after JwtAuthGuard and (optionally) RolesGuard.
 *
 * Usage:
 *   @CheckPolicies((ability) => ability.can(Action.Update, User))
 *   @Patch(':id')
 *   async update(...) {}
 *
 * Multiple handlers are AND-ed: every handler must return true.
 */
export const CHECK_POLICIES_KEY = 'policies' as const;
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
