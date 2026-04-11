import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ProjectStatus } from '../enums/project-status.enum';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Client-facing identifier for this work order.
   * Unique across the entire projects table — used as an external reference
   * in communications, invoices, and reports.
   */
  @Column({ unique: true })
  workOrderNumber!: string;

  @Column()
  projectName!: string;

  @Column()
  clientName!: string;

  /**
   * Date the work order was formally issued.
   * Stored as a plain DATE column (no time component) to avoid timezone
   * ambiguity — work orders are always referenced by calendar date.
   */
  @Column({ type: 'date' })
  workOrderDate!: Date;

  /**
   * Current lifecycle state.
   * Stored as a PostgreSQL native enum for referential integrity and
   * efficient filtering.  Adding new variants requires a migration.
   */
  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.PENDING })
  status!: ProjectStatus;

  /**
   * Open-ended key-value store for project-specific attributes that do not
   * belong in the fixed schema.  Stored as `jsonb` so individual keys are
   * indexable and filterable inside PostgreSQL without a schema migration.
   *
   * Convention: callers treat this as a flat `Record<string, unknown>`.
   * Nested structures are allowed but discouraged — keep it shallow so
   * querying remains simple.
   *
   * Null means no extra metadata was provided; an empty object {} means
   * the caller explicitly set it to nothing.
   */
  @Column({ type: 'jsonb', nullable: true, default: null })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
