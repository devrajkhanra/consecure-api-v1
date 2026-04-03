import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

/**
 * Persistent refresh-token record.
 *
 * Security model:
 *  - `tokenHash`  — bcrypt hash of the raw token.  Never store the
 *                   plaintext.  The raw token is transmitted once (in
 *                   the login/refresh response) and then forgotten.
 *  - `family`     — A UUID shared by all tokens issued in the same
 *                   session chain.  If a revoked token in a family is
 *                   presented, the entire family is revoked immediately
 *                   (token-reuse / session-theft detection).
 *  - `replacedBy` — ID of the successor token, set atomically during
 *                   rotation.  Useful for audit logs and reuse detection.
 *  - `isRevoked`  — Soft-revocation flag.  Avoids deleting rows so
 *                   that reuse attacks are detectable even after logout.
 *  - `expiresAt`  — Hard TTL enforced by the application layer.  A
 *                   scheduled cleanup job should periodically DELETE
 *                   rows where expiresAt < NOW() AND isRevoked = true.
 */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  tokenHash!: string;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  /** Session family UUID — used for reuse-attack detection. */
  @Column('uuid')
  family!: string;

  @Column({ default: false })
  isRevoked!: boolean;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  /** Set when this token is rotated; null means it has not been used yet. */
  @Column({ type: 'uuid', nullable: true })
  replacedBy?: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
