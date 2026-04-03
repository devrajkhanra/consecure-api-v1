import { Expose, Type } from 'class-transformer';

import { UserResponseDto } from '../../users/dto/user-response.dto';

/**
 * Shape returned by /auth/login, /auth/register, and /auth/refresh.
 *
 * Includes the short-lived access token, the long-lived refresh token,
 * and the sanitised user object so clients don't need a follow-up call.
 */
export class TokenResponseDto {
  @Expose()
  accessToken!: string;

  @Expose()
  refreshToken!: string;

  /** Seconds until the access token expires (for client-side countdown). */
  @Expose()
  expiresIn!: number;

  @Expose()
  @Type(() => UserResponseDto)
  user!: UserResponseDto;
}
