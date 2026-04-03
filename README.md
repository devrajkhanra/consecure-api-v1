# Consecure API v1

NestJS REST API with PostgreSQL, JWT auth, RBAC, and CASL authorization.

## Stack

- NestJS 11
- TypeORM + PostgreSQL
- JWT access/refresh tokens
- RBAC roles: `USER`, `ADMIN`, `SUPER_ADMIN`
- CASL attribute-level policies
- Pino logging
- Throttling

## Getting Started

```bash
npm install
npm run start:dev
```

The app runs on port `5000`.

## Environment

Required variables:

- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_DATABASE`
- `DB_SSL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`

## Authentication

### Public routes

- `GET /`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`

### Authenticated routes

- `POST /auth/logout`
- `POST /auth/logout-all`
- `GET /auth/me`

### Role management

- `POST /auth/roles/assign` — `SUPER_ADMIN`
- `DELETE /auth/roles/:userId/:role` — `SUPER_ADMIN`

## Users

- `POST /users` — `ADMIN`, `SUPER_ADMIN`
- `GET /users` — `ADMIN`, `SUPER_ADMIN`
- `GET /users/:id` — `ADMIN`, `SUPER_ADMIN`
- `PATCH /users/:id` — `ADMIN`, `SUPER_ADMIN`
- `DELETE /users/:id` — `ADMIN`, `SUPER_ADMIN`

## Notes

- Refresh tokens are rotated on use.
- Reuse detection revokes the entire token family.
- `JwtAuthGuard` is global; use `@Public()` to bypass it.
