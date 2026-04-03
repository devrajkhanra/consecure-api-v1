import { Injectable } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  ExtractSubjectType,
  InferSubjects,
  MongoAbility,
} from '@casl/ability';

import { User } from '../../users/entities/user.entity';
import { Action } from '../enums/action.enum';
import { Role } from '../enums/role.enum';

/**
 * Union of all subjects CASL can reason about.
 *
 * `InferSubjects<typeof User>` includes both `User` (instance check)
 * and `'User'` (string tag used in rules where you can't provide an
 * instance, e.g. POST /users before the entity exists).
 *
 * `'all'` is the CASL wildcard that matches every subject.
 */
type Subjects = InferSubjects<typeof User> | 'all';

/**
 * The resolved ability type for the application.
 * Exported so guards and services can type their `ability` parameter
 * without importing the concrete builder.
 */
export type AppAbility = MongoAbility<[Action, Subjects]>;

/**
 * Factory that constructs a CASL `AppAbility` for a given authenticated user.
 *
 * Rules are additive: later `can()` calls do not cancel earlier ones.
 * Use `cannot()` AFTER `can()` to carve out explicit denials from broad grants.
 *
 * Calling conventions:
 *   const ability = caslAbilityFactory.createForUser(user);
 *   ability.can(Action.Update, targetUser);  // true / false
 */
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility,
    );

    if (user.roles.includes(Role.SUPER_ADMIN)) {
      // ── SUPER_ADMIN: omnipotent ──────────────────────────────────────
      can(Action.Manage, 'all');
    } else if (user.roles.includes(Role.ADMIN)) {
      // ── ADMIN: full CRUD on users, cannot elevate to SUPER_ADMIN ────
      can(Action.Manage, User);
      cannot(Action.Update, User, ['roles'] as (keyof User)[]);
    } else {
      // ── USER: read own profile, update own non-sensitive fields ──────
      can(Action.Read, User, { id: user.id });
      can(Action.Update, User, ['firstName', 'lastName'] as (keyof User)[], {
        id: user.id,
      });
      // Users can soft-delete their own account
      can(Action.Delete, User, { id: user.id });
    }

    return build({
      // Maps class instances to their subject name string for rule matching.
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
