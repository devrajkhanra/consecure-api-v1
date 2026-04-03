import { IsString, IsUUID, IsNotEmpty } from 'class-validator';

/**
 * Body payload for POST /auth/refresh.
 *
 * We accept the token ID alongside the raw token so the repository can
 * locate the record without a full table scan.
 */
export class RefreshTokenRequestDto {
  /** The opaque refresh token string returned at login. */
  @IsString()
  @IsNotEmpty()
  token!: string;

  /** The UUID of the refresh-token record (returned at login as `tokenId`). */
  @IsUUID('4')
  tokenId!: string;
}
