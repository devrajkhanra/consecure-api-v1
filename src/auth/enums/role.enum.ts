/**
 * Application roles — ordered from least to most privileged.
 *
 * Stored as a comma-separated string in the users.roles column via
 * TypeORM's `simple-array` column type.  The string representation is
 * intentionally human-readable so ops can inspect the DB without a legend.
 */
export enum Role {
  USER = 'user',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}
