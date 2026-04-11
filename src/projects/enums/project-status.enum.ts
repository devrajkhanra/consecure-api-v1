/**
 * Lifecycle states a project can occupy.
 *
 * Design note: stored as an enum column in PostgreSQL via TypeORM's
 * `{ type: 'enum', enum: ProjectStatus }` column option.  Adding new
 * values requires a database migration; removing values is a breaking
 * change and must never be done without a coordinated migration + backfill.
 */
export enum ProjectStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
