import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import * as Joi from 'joi';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
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
        DB_HOST: Joi.string().default('localhost'),
        DB_PORT: Joi.number().default(5432),
        DB_USER: Joi.string().default('postgres'),
        DB_PASSWORD: Joi.string().required(),
        DB_DATABASE: Joi.string().default('consecure_dev'),
        DB_SSL: Joi.boolean().default(false),
        // TYPEORM_SYNC is intentionally absent — Step 5.
        // Schema changes must go through migrations; the env file can
        // never accidentally re-enable synchronise in production.
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

        // ── Step 5: synchronize is PERMANENTLY false ───────────────────
        //
        // TypeORM `synchronize: true` compares the in-process entity
        // metadata against the live schema and issues ALTER TABLE / DROP
        // COLUMN statements automatically. In production this is a
        // data-loss timebomb:
        //
        //  • A renamed column → TypeORM drops the old column (data gone).
        //  • Two pods starting simultaneously → concurrent ALTER TABLE
        //    deadlock or duplicate index errors.
        //  • A botched entity → production table silently destroyed.
        //
        // The value is hardcoded here. It cannot be overridden by an
        // environment variable. All schema changes must go through
        // reviewed, version-controlled TypeORM migrations:
        //
        //   npx typeorm migration:generate src/migrations/MyChange
        //   npx typeorm migration:run
        synchronize: false,

        ssl: config.get<boolean>('DB_SSL')
          ? { rejectUnauthorized: false }
          : false,
      }),
    }),

    // ── Step 3: Rate limiting ──────────────────────────────────────────
    //
    // A single named throttler called 'global' defines the baseline.
    // The name is referenced in @Throttle({ global: {...} }) on
    // individual routes that need a tighter budget.
    //
    // ttl is in milliseconds for @nestjs/throttler v5+.
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60_000,   // 60-second rolling window
        limit: 100,    // 100 requests per window per IP
      },
    ]),

    // ── Step 4: Structured logging with Pino ──────────────────────────
    //
    // nestjs-pino wraps pino-http so every HTTP request automatically
    // gets a structured log line containing:
    //   - req.id  (correlation ID — sourced from X-Request-Id header or
    //               generated as a UUID v4 if absent)
    //   - req.method, req.url, res.statusCode, responseTime
    //   - any context fields added via this.logger.log({...}, 'message')
    //
    // In development the 'pino-pretty' transport renders human-readable
    // output. In production raw NDJSON is emitted so log aggregators
    // (Datadog, Loki, CloudWatch) can parse it without transformation.
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('NODE_ENV') === 'production';

        return {
          pinoHttp: {
            // Honour LOG_LEVEL env override; default to info/debug by env.
            level: config.get<string>('LOG_LEVEL') ??
              (isProduction ? 'info' : 'debug'),

            // Correlation ID strategy:
            //   1. Honour an X-Request-Id header supplied by the caller
            //      (e.g. set by an API gateway or upstream service).
            //   2. Fall back to a freshly generated UUID v4.
            //
            // pino-http attaches the resolved ID to every log line in
            // the request scope AND sets it on the response as
            // X-Request-Id so callers can correlate client-side logs.
            genReqId: (req: IncomingMessage): string => {
              const header = req.headers['x-request-id'];
              if (typeof header === 'string' && header.length > 0) {
                return header;
              }
              return randomUUID();
            },

            // Redact sensitive headers before they reach the log sink.
            // The 'remove' flag replaces matched paths with [Redacted]
            // rather than omitting the key, which makes it obvious in
            // audit logs that a value existed but was intentionally hidden.
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-api-key"]',
              ],
              remove: false, // keep key, replace value with '[Redacted]'
            },

            // pino-pretty in development: colourised, single-line output.
            // Omit transport in production so log lines are raw NDJSON.
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

            // Suppress noisy health-check endpoints from the access log
            // so they do not inflate log volume or skew latency percentiles.
            autoLogging: {
              ignore: (req: IncomingMessage) =>
                req.url === '/health' || req.url === '/ready',
            },
          },
        };
      },
    }),

    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // ── Step 3: Apply ThrottlerGuard to every route globally ──────────
    //
    // Registering via APP_GUARD (the NestJS enhancer token) means the
    // guard runs for every controller in every module without decorating
    // each one individually.
    //
    // Routes can opt out with @SkipThrottle() or override the limit
    // with @Throttle({ global: { limit: N, ttl: M } }).
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}