import { Expose } from 'class-transformer';

import { Role } from '../../auth/enums/role.enum';

/**
 * The exact shape this API exposes to callers.
 *
 * Rules:
 *  - Every field is decorated with @Expose() so that
 *    plainToInstance(..., { excludeExtraneousValues: true })
 *    in UserMapper acts as an allowlist — any field NOT listed here
 *    is silently dropped, including `password`, `deletedAt`, and any
 *    future internal columns added to the entity.
 *  - We never add `password` here. Ever.
 *  - Dates are typed as Date so serialisation to ISO-8601 is handled
 *    by JSON.stringify.
 */
export class UserResponseDto {
  @Expose()
  id!: string;

  @Expose()
  firstName!: string;

  @Expose()
  lastName!: string;

  @Expose()
  email!: string;

  @Expose()
  isActive!: boolean;

  @Expose()
  roles!: Role[];

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
