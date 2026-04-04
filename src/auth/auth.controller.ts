import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import type { User } from '../users/entities/user.entity';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UserMapper } from '../users/mappers/user.mapper';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AuthService } from './auth.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { RefreshTokenRequestDto } from './dto/refresh-token-request.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { Role } from './enums/role.enum';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TokenMapper } from './mappers/token.mapper';
import type { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';

/**
 * Auth HTTP surface.
 *
 * Endpoint summary:
 *   POST /auth/register     — Public. Create account + issue token pair.
 *   POST /auth/login        — Public. Validate credentials + issue token pair.
 *   POST /auth/refresh      — Uses refresh-token Bearer. Rotate tokens.
 *   POST /auth/logout       — JWT required. Revoke one session.
 *   POST /auth/logout-all   — JWT required. Revoke all sessions.
 *   GET  /auth/me           — JWT required. Return own profile.
 *   POST /auth/roles/assign — JWT + SUPER_ADMIN. Assign role to user.
 *   DELETE /auth/roles/:userId/:role — JWT + SUPER_ADMIN. Remove role.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Registration ─────────────────────────────────────────────────────────

  /**
   * Rate-limited: 5 registrations per IP per hour.
   * Tighter than the global throttle to resist account-farming bots.
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ global: { ttl: 3_600_000, limit: 5 } })
  async register(
    @Body() dto: CreateUserDto,
  ): Promise<TokenResponseDto & { tokenId: string }> {
    const { tokens, user } = await this.authService.register(dto);
    return TokenMapper.toResponse(tokens, user);
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  /**
   * LocalAuthGuard runs the 'local' Passport strategy which calls
   * AuthService.validateCredentials() and attaches the User to req.user.
   *
   * Rate-limited: 10 attempts per IP per minute to slow brute force.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  async login(
    @CurrentUser() user: User,
  ): Promise<TokenResponseDto & { tokenId: string }> {
    const { tokens } = await this.authService.login(user);
    return TokenMapper.toResponse(tokens, user);
  }

  // ─── Token rotation ───────────────────────────────────────────────────────

  /**
   * Exchange a valid refresh token for a new token pair.
   * The old refresh token is revoked atomically.
   *
   * The refresh JWT must be sent as `Authorization: Bearer <token>`.
   * req.user is populated by JwtRefreshStrategy with the decoded payload
   * + the raw token string for hash verification.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  async refresh(
    @CurrentUser() payload: JwtRefreshPayload & { rawToken: string },
  ): Promise<TokenResponseDto & { tokenId: string }> {
    const { tokens, user } = await this.authService.refresh(payload);
    return TokenMapper.toResponse(tokens, user);
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  /**
   * Revoke a single session.
   * The client must supply the tokenId returned at login/refresh.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenRequestDto): Promise<void> {
    await this.authService.logout(dto.tokenId);
  }

  /**
   * Revoke all active sessions for the authenticated user.
   * Use after a suspected account compromise or explicit "log out everywhere".
   */
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@CurrentUser() user: User): Promise<void> {
    await this.authService.logoutAll(user.id);
  }

  // ─── Profile ──────────────────────────────────────────────────────────────

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: User): Promise<UserResponseDto> {
    return UserMapper.toResponse(user);
  }

  // ─── Role management (SUPER_ADMIN only) ──────────────────────────────────

  @Post('roles/assign')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async assignRole(@Body() dto: AssignRoleDto): Promise<UserResponseDto> {
    const user = await this.authService.assignRole(dto.userId, dto.role);
    return UserMapper.toResponse(user);
  }

  @Delete('roles/:userId/:role')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async removeRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('role') role: Role,
  ): Promise<UserResponseDto> {
    const user = await this.authService.removeRole(userId, role);
    return UserMapper.toResponse(user);
  }
}
