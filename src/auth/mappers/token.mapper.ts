import { plainToInstance } from 'class-transformer';

import { UserMapper } from '../../users/mappers/user.mapper';
import type { User } from '../../users/entities/user.entity';
import { TokenResponseDto } from '../dto/token-response.dto';
import type { TokenPair } from '../auth.service';

/**
 * Mapper: (TokenPair + User) → TokenResponseDto.
 *
 * Follows the same static-only pattern as UserMapper — pure transformation,
 * no DI, no state.
 */
export class TokenMapper {
  private constructor() {}

  static toResponse(
    tokens: TokenPair,
    user: User,
  ): TokenResponseDto & { tokenId: string } {
    const dto = plainToInstance(
      TokenResponseDto,
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: UserMapper.toResponse(user),
      },
      { excludeExtraneousValues: true },
    );

    // Attach tokenId separately — it's needed by the client for logout/refresh
    // but is not part of the standard TokenResponseDto schema.
    return Object.assign(dto, { tokenId: tokens.tokenId });
  }
}
