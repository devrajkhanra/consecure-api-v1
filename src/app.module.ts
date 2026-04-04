import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';

import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import * as Joi from 'joi';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { UsersModule } from './users/users.module';
import { LoggingMiddleware } from './middleware/logging.middleware';
import databaseConfig from './config/database.config';

@Module({
  imports: [
    // ── Configuration ──────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
      envFilePath: ['.env', '.env.local'],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        // ── Database ──────────────────────────────────────────────────
        DB_HOST: Joi.string().default('localhost'),
        DB_PORT: Joi.number().default(5432),
        DB_USER: Joi.string().default('postgres'),
        DB_PASSWORD: Joi.string().default(process.env.PGPASSWORD ?? ''),
        DB_DATABASE: Joi.string().default('consecure_dev'),
        DB_SSL: Joi.boolean().default(false),
        // ── JWT ───────────────────────────────────────────────────────
        // Both secrets are REQUIRED — the application will refuse to boot
        // without them, preventing accidental deployment with empty secrets.
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_ACCESS_EXPIRES_IN: Joi.number().positive().default(900),
        JWT_REFRESH_EXPIRES_IN: Joi.number().positive().default(604_800),
        // TYPEORM_SYNC is intentionally absent.
        // Schema changes must go through migrations.
      }),
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),

    // ── Database ───────────────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: false,
        ssl: config.get<boolean>('DB_SSL')
          ? { rejectUnauthorized: false }
          : false,
      }),
    }),

    // ── Rate limiting ──────────────────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60_000,
        limit: 100,
      },
    ]),

    // ── Structured logging ────────────────────────────────────────────
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('NODE_ENV') === 'production';

        return {
          pinoHttp: {
            level:
              config.get<string>('LOG_LEVEL') ??
              (isProduction ? 'info' : 'debug'),

            genReqId: (req: IncomingMessage): string => {
              const header = req.headers['x-request-id'];
              if (typeof header === 'string' && header.length > 0) {
                return header;
              }
              return randomUUID();
            },

            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-api-key"]',
              ],
              remove: false,
            },

            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                },

            autoLogging: {
              ignore: (req: IncomingMessage) =>
                req.url === '/health' || req.url === '/ready',
            },
          },
        };
      },
    }),

    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // ── Global rate-limit guard ────────────────────────────────────────
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // ── Global JWT authentication guard ───────────────────────────────
    //
    // Every route requires a valid JWT access token by default.
    // Routes opt OUT with the @Public() decorator (e.g. /auth/login,
    // /auth/register).  This "secure by default" posture prevents
    // accidentally exposing a new route without authentication.
    //
    // Guard execution order matches registration order in `providers`.
    // ThrottlerGuard runs first (rate-limiting happens before auth so
    // bots are slowed down even if they never get a token), then
    // JwtAuthGuard validates the token.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
