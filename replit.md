# Consecure API v1

A production-grade NestJS REST API with PostgreSQL, TypeORM, JWT auth, RBAC, and CASL authorization.

## Architecture

- **Framework:** NestJS 11 (TypeScript)
- **Database:** PostgreSQL via TypeORM (Replit built-in DB)
- **ORM:** TypeORM with `synchronize: false` (schema managed via raw SQL)
- **Auth:** JWT access + refresh tokens with rotation and reuse-attack detection
- **Authorization:** RBAC (Roles guard) + CASL attribute-level policies
- **Logging:** Pino (pino-pretty in dev, NDJSON in prod)
- **Rate Limiting:** @nestjs/throttler (100 req/min global)
- **Validation:** class-validator + Joi env validation

## Project Structure

```
src/
  main.ts              # Entry point, listens on 0.0.0.0:5000
  app.module.ts        # Root module (config, DB, throttler, logger, global guards)
  app.controller.ts    # Root health endpoint GET /
  config/
    database.config.ts # Named database config namespace
    jwt.config.ts      # JWT config namespace (secrets, expiry)
  auth/
    decorators/        # @Public, @Roles, @CurrentUser, @CheckPolicies
    casl/              # CaslAbilityFactory (attribute-level authorization)
    dto/               # LoginDto, RegisterDto
    entities/          # RefreshToken entity
    guards/            # JwtAuthGuard (global), RolesGuard, PoliciesGuard, LocalAuthGuard, JwtRefreshGuard
    repositories/      # IRefreshTokenRepository interface + TypeORM impl
    strategies/        # LocalStrategy, JwtStrategy, JwtRefreshStrategy
    auth.controller.ts # /auth/* routes
    auth.service.ts    # Token issuance, rotation, reuse detection, role management
    auth.module.ts
  users/
    dto/               # Request DTOs with class-validator
    entities/          # User entity (roles: simple-array column)
    repositories/      # Repository pattern (interface + impl)
    mappers/           # Entity <-> DTO conversions
    users.controller.ts
    users.service.ts
    users.module.ts
```

## Auth Design

### Token Flow
1. **Register / Login** → issues `{ accessToken, refreshToken, tokenId }`
2. **Access token** (15 min) — short-lived JWT signed with `JWT_ACCESS_SECRET`
3. **Refresh token** (7 days) — long-lived JWT signed with `JWT_REFRESH_SECRET`, carries `tokenId`

### Token Storage
- Refresh tokens stored in `refresh_tokens` table with SHA-256 hash of the JWT (for audit), `family` UUID, `isRevoked`, `expiresAt`
- `tokenId` (pre-generated UUID) is embedded in the refresh JWT payload and used as the DB record PK

### Rotation + Reuse Detection
- On `/auth/refresh`: old token is marked `isRevoked=true`, new pair issued in the same `family`
- If a revoked token is replayed → entire family is revoked (reuse-attack detected → 403)

### Authorization layers
| Layer | Mechanism | Decorator |
|-------|-----------|-----------|
| Authentication | `JwtAuthGuard` (global) | `@Public()` to opt out |
| Role-based | `RolesGuard` | `@Roles(Role.ADMIN)` |
| Attribute-level | `PoliciesGuard` + CASL | `@CheckPolicies(...)` |

### Roles
- `USER` — default, read own profile
- `ADMIN` — list/read all users
- `SUPER_ADMIN` — manage roles

## Environment Variables

Set via Replit secrets/env vars:
- `NODE_ENV` — development | production | test
- `PORT` — Server port (default: 5000)
- `DB_HOST` — Database host (maps to PGHOST)
- `DB_PORT` — Database port (default: 5432)
- `DB_USER` — Database user (maps to PGUSER)
- `DB_PASSWORD` — Database password (falls back to PGPASSWORD secret)
- `DB_DATABASE` — Database name (maps to PGDATABASE)
- `DB_SSL` — Enable SSL (default: false)
- `JWT_ACCESS_SECRET` — Secret for access token signing
- `JWT_REFRESH_SECRET` — Secret for refresh token signing
- `JWT_ACCESS_EXPIRES_IN` — Access token TTL in seconds (default: 900)
- `JWT_REFRESH_EXPIRES_IN` — Refresh token TTL in seconds (default: 604800)

## API Endpoints

### Public
- `GET /` — Health check
- `POST /auth/register` — Register new user
- `POST /auth/login` — Login (returns token pair)
- `POST /auth/refresh` — Rotate refresh token

### Authenticated
- `GET /auth/me` — Get own profile
- `POST /auth/logout` — Revoke refresh token

### ADMIN only
- `GET /users` — List all users
- `GET /users/:id` — Get user by ID
- `PATCH /users/:id` — Update user
- `DELETE /users/:id` — Soft-delete user

### SUPER_ADMIN only
- `POST /auth/roles/:userId/add` — Assign role
- `DELETE /auth/roles/:userId/remove` — Remove role

## Database Schema

```sql
CREATE TABLE "users" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "firstName" varchar NOT NULL,
  "lastName" varchar NOT NULL,
  email varchar UNIQUE NOT NULL,
  password varchar NOT NULL,
  roles text NOT NULL DEFAULT 'user',
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now(),
  "deletedAt" timestamptz
);

CREATE TABLE "refresh_tokens" (
  id uuid PRIMARY KEY,
  "tokenHash" varchar NOT NULL,
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family uuid NOT NULL,
  "isRevoked" boolean NOT NULL DEFAULT false,
  "replacedBy" uuid,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens("userId");
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family);
```

## Running

- **Dev:** `npm run start:dev` (watch mode, port 5000)
- **Prod:** `npm run build && node dist/main`

## Deployment

- Target: autoscale
- Build: `npm run build`
- Run: `node dist/main`
