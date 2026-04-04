import type { RefreshToken } from '../entities/refresh-token.entity';

/**
 * Domain-level contract for refresh-token persistence.
 *
 * Nothing here imports from TypeORM — the concrete implementation owns
 * all ORM concerns.  This lets tests inject a lightweight in-memory fake
 * without a live database connection.
 */
export interface IRefreshTokenRepository {
  /**
   * Persist a new refresh-token record.
   * The caller is responsible for hashing `tokenHash` before passing it in.
   */
  create(data: {
    id: string; // pre-generated UUID so tokenId can be embedded in JWT
    tokenHash: string;
    userId: string;
    family: string;
    expiresAt: Date;
  }): Promise<RefreshToken>;

  /** Find a token by its primary key. */
  findById(id: string): Promise<RefreshToken | null>;

  /**
   * Find all active (non-revoked, non-expired) tokens in a family.
   * Used to detect reuse attacks: if the presented token is revoked
   * but belongs to an active family, the whole family is compromised.
   */
  findActiveByFamily(family: string): Promise<RefreshToken[]>;

  /**
   * Atomically mark `oldId` as revoked + set `replacedBy`, then return
   * the updated record.  Called during token rotation.
   */
  rotateToken(oldId: string, replacedById: string): Promise<RefreshToken>;

  /** Hard-revoke a single token (e.g. on explicit logout). */
  revokeById(id: string): Promise<void>;

  /**
   * Revoke every token in a family.
   * Called when a reuse attack is detected — the entire session chain
   * must be invalidated immediately.
   */
  revokeFamilyById(family: string): Promise<void>;

  /** Revoke all tokens belonging to a user (logout-all / password change). */
  revokeAllForUser(userId: string): Promise<void>;
}

export const REFRESH_TOKEN_REPOSITORY = 'IRefreshTokenRepository' as const;
