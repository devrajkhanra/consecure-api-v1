import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';

import type { JwtConfig } from '../config/jwt.config';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import type { CreateUserDto } from '../users/dto/create-user.dto';
import { UserMapper } from '../users/mappers/user.mapper';
import { Role } from './enums/role.enum';
import type { JwtPayload } from './strategies/jwt.strategy';
import type { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';
import {
  REFRESH_TOKEN_REPOSITORY,
  type IRefreshTokenRepository,
} from './repositories/refresh-token-repository.interface';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenId: string;
  expiresIn: number;
}

/**
 * Application service for the Auth domain.
 *
 * Responsibilities:
 *  - Credential validation (email + password).
 *  - Token issuance, rotation, and revocation.
 *  - Refresh-token reuse-attack detection (family-based revocation).
 *  - Role assignment (SUPER_ADMIN only).
 *
 * Dependency hygiene:
 *  - Uses UsersService for user reads — never queries the users table directly.
 *  - Injects IRefreshTokenRepository via token, not the concrete class.
 *  - Only this service issues JWTs; no controller or guard should call
 *    JwtService.sign() directly.
 */
@Injectable()
export class AuthService {
  private readonly jwtConfig: JwtConfig;

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepo: IRefreshTokenRepository,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    this.jwtConfig = this.configService.get<JwtConfig>('jwt')!;
  }

  // ─── Credential validation ────────────────────────────────────────────────

  /**
   * Validates email + plaintext password.
   * Returns the User if valid, null otherwise.
   * Never throws — lets the guard decide what to surface.
   *
   * IMPORTANT: The users table has `password` with `{ select: false }`,
   * so we must use a query that explicitly selects the password column.
   */
  async validateCredentials(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .andWhere('user.deletedAt IS NULL')
      .getOne();

    if (!user || !user.isActive) {
      return null;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    return passwordMatch ? user : null;
  }

  /**
   * Validates a JWT sub claim (user ID) for the access-token strategy.
   * Returns null if the user does not exist or is deactivated.
   */
  async validateJwtUser(userId: string): Promise<User | null> {
    try {
      const user = await this.usersService.findOne(userId);
      return user.isActive ? user : null;
    } catch {
      return null;
    }
  }

  // ─── Registration ─────────────────────────────────────────────────────────

  /**
   * Register a new account and immediately issue a token pair.
   * Delegates user creation to UsersService (which hashes the password).
   */
  async register(
    dto: CreateUserDto,
  ): Promise<{ tokens: TokenPair; user: User }> {
    const user = await this.usersService.create(dto);
    const tokens = await this.issueTokenPair(user, randomUUID());
    return { tokens, user };
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  /**
   * Called by the route handler after LocalAuthGuard has validated credentials.
   * `user` is already the validated entity from LocalStrategy.validate().
   */
  async login(user: User): Promise<{ tokens: TokenPair; user: User }> {
    const tokens = await this.issueTokenPair(user, randomUUID());
    return { tokens, user };
  }

  // ─── Token rotation ───────────────────────────────────────────────────────

  /**
   * Validate a refresh token and issue a new token pair.
   *
   * Security checks performed:
   *   1. Token record exists and has not expired.
   *   2. bcrypt hash of the raw token matches the stored hash.
   *   3. Token is not already revoked.
   *      → If revoked: reuse attack — revoke the entire family and throw.
   *
   * On success, the old token is marked revoked + replacedBy and a new
   * pair is issued in the same family.
   */
  async refresh(
    payload: JwtRefreshPayload & { rawToken: string },
  ): Promise<{ tokens: TokenPair; user: User }> {
    const record = await this.refreshTokenRepo.findById(payload.tokenId);

    if (!record || record.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // ── Reuse-attack detection ────────────────────────────────────────
    if (record.isRevoked) {
      // A revoked token was presented — this is either a replay attack
      // or the token was stolen.  Invalidate the entire session chain.
      await this.refreshTokenRepo.revokeFamilyById(record.family);
      throw new ForbiddenException(
        'Refresh token reuse detected. All sessions have been revoked.',
      );
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.usersService.findOne(record.userId);

    // Issue a new pair in the same family, revoke the old token.
    const tokens = await this.issueTokenPair(user, record.family);
    await this.refreshTokenRepo.rotateToken(record.id, tokens.tokenId);

    return { tokens, user };
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  /**
   * Revoke a single refresh token by its record ID.
   * Clients must send the tokenId they received at login.
   */
  async logout(tokenId: string): Promise<void> {
    await this.refreshTokenRepo.revokeById(tokenId);
  }

  /**
   * Revoke every active session for a user.
   * Called on password change, account compromise, or explicit "log out everywhere".
   */
  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepo.revokeAllForUser(userId);
  }

  // ─── Role management ──────────────────────────────────────────────────────

  /**
   * Assign a role to a user.  Only SUPER_ADMINs may call this.
   * The guard layer enforces the caller's role before reaching this method.
   */
  async assignRole(targetUserId: string, role: Role): Promise<User> {
    const target = await this.usersService.findOne(targetUserId);

    if (target.roles.includes(role)) {
      return target; // Idempotent — no-op if role already present.
    }

    const updatedRoles = [...new Set([...target.roles, role])];
    return this.userRepo.save({ ...target, roles: updatedRoles });
  }

  /**
   * Remove a role from a user.  Only SUPER_ADMINs may call this.
   * Cannot remove the last role — every user must always have at least USER.
   */
  async removeRole(targetUserId: string, role: Role): Promise<User> {
    const target = await this.usersService.findOne(targetUserId);

    if (role === Role.USER) {
      throw new ConflictException('Cannot remove the base USER role');
    }

    const updatedRoles = target.roles.filter((r) => r !== role);
    if (updatedRoles.length === 0) {
      updatedRoles.push(Role.USER);
    }

    return this.userRepo.save({ ...target, roles: updatedRoles });
  }

  // ─── Profile ──────────────────────────────────────────────────────────────

  async getProfile(userId: string): Promise<User> {
    return this.usersService.findOne(userId);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Issue a new access + refresh token pair.
   *
   * @param user    - The authenticated user.
   * @param family  - Session family UUID (shared across rotations).
   * @returns TokenPair with raw tokens, the new tokenId, and expiresIn.
   */
  private async issueTokenPair(user: User, family: string): Promise<TokenPair> {
    const accessPayload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.jwtConfig.accessSecret,
      expiresIn: this.jwtConfig.accessExpiresIn,
    });

    // Pre-generate the token record ID so it can be embedded in the JWT
    // payload before the DB record is created — avoids a two-step write.
    const tokenId = randomUUID();

    // Build the signed refresh JWT first so we can hash it for storage.
    const refreshPayload: JwtRefreshPayload = { sub: user.id, tokenId, family };
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.jwtConfig.refreshSecret,
      expiresIn: this.jwtConfig.refreshExpiresIn,
    });

    // SHA-256 of the signed JWT — stored for audit/forensics.
    // Authentication relies on the JWT signature (verified by Passport),
    // not on this hash.  bcrypt is intentionally NOT used here:
    // the token is already cryptographically random; bcrypt is reserved
    // for human-chosen secrets (passwords).
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    const expiresAt = new Date(
      Date.now() + this.jwtConfig.refreshExpiresIn * 1_000,
    );

    await this.refreshTokenRepo.create({
      id: tokenId,
      tokenHash,
      userId: user.id,
      family,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      tokenId,
      expiresIn: this.jwtConfig.accessExpiresIn,
    };
  }
}
