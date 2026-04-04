import { plainToInstance } from 'class-transformer';

import { UserResponseDto } from '../dto/user-response.dto';
import type { User } from '../entities/user.entity';

/**
 * Application-layer mapper: User entity → UserResponseDto.
 *
 * Design decisions:
 *  - Static methods only. No constructor, no DI token, no state.
 *    The mapper is a pure transformation function disguised as a class
 *    for namespacing purposes.
 *  - `excludeExtraneousValues: true` is the critical option. It means
 *    plainToInstance acts as an allowlist: only properties decorated
 *    with @Expose() on UserResponseDto are present in the output.
 *    If `password` or `deletedAt` accidentally land on the entity they
 *    are silently dropped here — they never reach the serialiser.
 *  - We do NOT use `@Exclude()` on the entity itself because the entity
 *    is a database concern, not an API concern. The mapper owns the
 *    projection responsibility entirely.
 */
export class UserMapper {
  private constructor() {
    // Non-instantiable utility class
  }

  /** Convert a single User entity to its public DTO representation. */
  static toResponse(user: User): UserResponseDto {
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  /** Convert an array of User entities. */
  static toResponseList(users: User[]): UserResponseDto[] {
    return users.map((user) => UserMapper.toResponse(user));
  }

  /**
   * Convert the paginated envelope returned by the service.
   * The cursor is infrastructure-opaque and passes through unchanged.
   */
  static toResponsePaginated(result: {
    data: User[];
    nextCursor: string | null;
  }): {
    data: UserResponseDto[];
    nextCursor: string | null;
  } {
    return {
      data: UserMapper.toResponseList(result.data),
      nextCursor: result.nextCursor,
    };
  }
}
