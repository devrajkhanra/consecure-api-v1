import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Role } from '../../auth/enums/role.enum';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ unique: true })
  email!: string;

  /**
   * Never returned in queries unless explicitly selected with
   * `addSelect('user.password')`.  The `{ select: false }` flag
   * is a defence-in-depth measure — UserResponseDto's @Expose allowlist
   * is the primary guard, but this ensures password never leaks even if
   * the mapper is accidentally bypassed.
   */
  @Column({ select: false })
  password!: string;

  @Column({ default: true })
  isActive!: boolean;

  /**
   * Stored as a comma-separated string by TypeORM's `simple-array` type.
   * Example DB value: "user"  or  "user,admin"
   *
   * Every new account starts with [Role.USER].  Elevation to ADMIN or
   * SUPER_ADMIN requires an explicit action from a SUPER_ADMIN.
   */
  @Column({ type: 'simple-array', default: Role.USER })
  roles!: Role[];

  @OneToMany(() => RefreshToken, (token) => token.user, { cascade: false })
  refreshTokens!: RefreshToken[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
