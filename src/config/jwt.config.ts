import { registerAs } from '@nestjs/config';

/**
 * Named configuration namespace 'jwt'.
 *
 * Consumed via ConfigService.get<JwtConfig>('jwt') inside JwtModule
 * and the two Passport JWT strategies.
 *
 * Values come exclusively from validated environment variables — the
 * Joi schema in AppModule enforces their presence at startup so the
 * application never boots with a missing or weak secret.
 */
export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: number; // seconds
  refreshExpiresIn: number; // seconds
}

export default registerAs(
  'jwt',
  (): JwtConfig => ({
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    accessExpiresIn: Number(process.env.JWT_ACCESS_EXPIRES_IN ?? 900),
    refreshExpiresIn: Number(process.env.JWT_REFRESH_EXPIRES_IN ?? 604_800),
  }),
);
