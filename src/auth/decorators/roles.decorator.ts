import { SetMetadata } from '@nestjs/common';

import type { Role } from '../enums/role.enum';

/**
 * Attach required roles to a route handler.  Evaluated by RolesGuard.
 *
 * Usage:
 *   @Roles(Role.ADMIN, Role.SUPER_ADMIN)
 *   @Get('admin/users')
 *   async listAllUsers(...) {}
 *
 * Semantics: the guard performs an OR check — the user must possess
 * AT LEAST ONE of the listed roles to proceed.
 *
 * For AND semantics (user must have all listed roles), implement a
 * separate `@RequireAllRoles()` decorator with an `every` check in
 * the corresponding guard.
 */
export const ROLES_KEY = 'roles' as const;
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
