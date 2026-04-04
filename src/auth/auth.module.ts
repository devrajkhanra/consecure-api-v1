import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import jwtConfig, { type JwtConfig } from '../config/jwt.config';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CaslAbilityFactory } from './casl/casl-ability.factory';
import { RefreshToken } from './entities/refresh-token.entity';
import { REFRESH_TOKEN_REPOSITORY } from './repositories/refresh-token-repository.interface';
import { TypeOrmRefreshTokenRepository } from './repositories/refresh-token.repository';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

/**
 * AuthModule wiring.
 *
 * Deliberate design decisions:
 *
 * 1. JwtModule.registerAsync — the secret is loaded from ConfigService
 *    (which reads validated env vars) rather than being hard-coded.
 *    Both strategies receive their secrets via ConfigService.get('jwt').
 *
 * 2. PassportModule.register({ defaultStrategy: 'jwt' }) — sets the
 *    fallback strategy so @UseGuards(AuthGuard()) (without a name) uses
 *    JWT.  Named guards (LocalAuthGuard, JwtRefreshGuard) bypass this.
 *
 * 3. TypeOrmModule.forFeature([RefreshToken, User]) — registers both
 *    entities in this module's DI scope.  User is needed by AuthService
 *    for the password-select query and role updates.
 *
 * 4. UsersModule is imported (not re-declared) so AuthService can inject
 *    UsersService, which is exported from UsersModule.
 *
 * 5. CaslAbilityFactory is exported so UsersModule guards can inject it
 *    without creating a circular dependency.
 */
@Module({
  imports: [
    ConfigModule.forFeature(jwtConfig),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtCfg = configService.get<JwtConfig>('jwt')!;
        return {
          // Default secret used when sign() is called without an explicit secret.
          // Each strategy overrides this with its own secret via sign() options.
          secret: jwtCfg.accessSecret,
          signOptions: { expiresIn: jwtCfg.accessExpiresIn },
        };
      },
    }),
    TypeOrmModule.forFeature([RefreshToken, User]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    CaslAbilityFactory,
    // Strategies
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
    // Repository DI token
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: TypeOrmRefreshTokenRepository,
    },
  ],
  exports: [AuthService, CaslAbilityFactory, JwtModule, PassportModule],
})
export class AuthModule {}
