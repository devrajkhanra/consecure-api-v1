# Consecure API v1

A NestJS REST API with PostgreSQL, TypeORM, rate limiting, and structured Pino logging.

## Architecture

- **Framework:** NestJS 11 (TypeScript)
- **Database:** PostgreSQL via TypeORM (Replit built-in DB)
- **ORM:** TypeORM with migrations (synchronize: false)
- **Logging:** Pino (pino-pretty in dev, NDJSON in prod)
- **Rate Limiting:** @nestjs/throttler (100 req/min global)
- **Validation:** class-validator + Joi env validation

## Project Structure

```
src/
  main.ts           # Entry point, listens on 0.0.0.0:5000
  app.module.ts     # Root module (config, DB, throttler, logger)
  app.controller.ts # Root health endpoint GET /
  config/
    database.config.ts  # Named database config namespace
  users/
    dto/            # Request DTOs with class-validator
    entities/       # TypeORM entities (User)
    repositories/   # Repository pattern (interface + impl)
    mappers/        # Entity <-> DTO conversions
    users.controller.ts
    users.service.ts
    users.module.ts
```

## Environment Variables

Set via Replit secrets/env vars:
- `NODE_ENV` — development | production | test
- `DB_HOST` — Database host (maps to PGHOST)
- `DB_PORT` — Database port (default: 5432)
- `DB_USER` — Database user (maps to PGUSER)
- `DB_PASSWORD` — Database password (falls back to PGPASSWORD secret)
- `DB_DATABASE` — Database name (maps to PGDATABASE)
- `DB_SSL` — Enable SSL (default: false)
- `PORT` — Server port (default: 5000)

## API Endpoints

- `GET /` — Health check
- `POST /users` — Create user
- `GET /users` — List users
- `GET /users/:id` — Get user by ID
- `PATCH /users/:id` — Update user
- `DELETE /users/:id` — Soft-delete user

## Database Schema

The `users` table is created manually (no migration files included):
```sql
CREATE TABLE "users" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "firstName" varchar NOT NULL,
  "lastName" varchar NOT NULL,
  email varchar UNIQUE NOT NULL,
  password varchar NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now(),
  "deletedAt" timestamptz
)
```

## Running

- **Dev:** `npm run start:dev` (watch mode, port 5000)
- **Prod:** `npm run build && node dist/main`

## Deployment

- Target: autoscale
- Build: `npm run build`
- Run: `node dist/main`
