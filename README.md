# Consecure API v1

A NestJS REST API with PostgreSQL, JWT authentication, RBAC, and CASL authorization.

## Overview

This API provides:

- Email/password registration and login
- JWT access + refresh tokens
- Refresh token rotation
- Reuse-attack detection for stolen refresh tokens
- Role-based access control
- Attribute-level authorization with CASL
- Soft-deleted users
- Global throttling and structured logging

## Tech Stack

- NestJS 11
- TypeORM
- PostgreSQL
- Passport JWT
- CASL
- Pino
- class-validator / class-transformer

## Getting Started

```bash
npm install
npm run start:dev
```

The app runs on port `5000`.

## Environment Variables

### Required

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

### Example

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_DATABASE=consecure
DB_SSL=false
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRES_IN=900
JWT_REFRESH_EXPIRES_IN=604800
```

## Authentication Model

### Access token

- Short-lived JWT
- Sent as `Authorization: Bearer <token>`
- Used for protected API calls

### Refresh token

- Long-lived JWT
- Rotated on every refresh
- Stored in the database by hashed value
- Carries `tokenId` and `family`
- Reuse detection revokes the whole token family

### Token behavior

1. Login/register issues access + refresh tokens
2. Refresh token is exchanged for a new pair
3. Old refresh token becomes revoked
4. If a revoked refresh token is reused, all tokens in that family are revoked

## Roles

- `USER` — default role
- `ADMIN` — can manage users
- `SUPER_ADMIN` — can assign/remove roles and revoke any user's sessions globally

## API Endpoints

### Public

- `GET /` — health check
- `POST /auth/register` — create account
- `POST /auth/login` — login and receive token pair
- `POST /auth/refresh` — rotate refresh token

### Authenticated

- `POST /auth/logout` — revoke current refresh token
- `POST /auth/logout-all` — revoke all refresh tokens for the current user
- `GET /auth/me` — get current profile

### Role management

- `POST /auth/roles/assign` — assign a role (`SUPER_ADMIN`)
- `DELETE /auth/roles/:userId/:role` — remove a role (`SUPER_ADMIN`)

### Session management

- `POST /auth/logout-all/:userId` — revoke all sessions for any user (`SUPER_ADMIN`)

### Users

- `POST /users` — create user (`ADMIN`, `SUPER_ADMIN`)
- `GET /users` — list users (`ADMIN`, `SUPER_ADMIN`)
- `GET /users/:id` — get user by id (`ADMIN`, `SUPER_ADMIN`)
- `PATCH /users/:id` — update user (`ADMIN`, `SUPER_ADMIN`)
- `DELETE /users/:id` — soft delete user (`ADMIN`, `SUPER_ADMIN`)

## Request / Response Examples

### Register

```bash
curl -X POST http://localhost:5000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "password": "Password123"
  }'
```

### Login

```bash
curl -X POST http://localhost:5000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "jane@example.com",
    "password": "Password123"
  }'
```

### Refresh

```bash
curl -X POST http://localhost:5000/auth/refresh \
  -H 'Authorization: Bearer <refresh_token>'
```

### Current user

```bash
curl http://localhost:5000/auth/me \
  -H 'Authorization: Bearer <access_token>'
```

### Logout all sessions for a user (SUPER_ADMIN)

```bash
curl -X POST http://localhost:5000/auth/logout-all/<userId> \
  -H 'Authorization: Bearer <super_admin_access_token>'
```

## Authorization

### Global authentication

`JwtAuthGuard` is registered globally. Public routes must use `@Public()`.

### RBAC

Use `@Roles(...)` to protect controller routes by role.

### CASL

Use `@CheckPolicies(...)` for attribute-level checks on resources.

## Database Schema

### users

- `id`
- `firstName`
- `lastName`
- `email`
- `password`
- `roles`
- `isActive`
- `createdAt`
- `updatedAt`
- `deletedAt`

### refresh_tokens

- `id`
- `tokenHash`
- `userId`
- `family`
- `isRevoked`
- `replacedBy`
- `expiresAt`
- `createdAt`

## Notes

- Passwords are hashed with bcrypt.
- Refresh token hashes are stored for audit purposes.
- JWT signatures are used to verify token authenticity.
- Reusing a revoked refresh token triggers family-wide revocation.
- `POST /auth/logout-all/:userId` is restricted to `SUPER_ADMIN` for incident response (account takeover, policy violation, etc.).

## Running in Production

```bash
npm run build
node dist/main
```