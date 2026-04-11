import { Expose } from 'class-transformer';

import { ProjectStatus } from '../enums/project-status.enum';

/**
 * The exact shape this API exposes to callers for a project resource.
 *
 * Rules:
 *  - Every field is decorated with @Expose() so that
 *    plainToInstance(..., { excludeExtraneousValues: true })
 *    in ProjectMapper acts as an allowlist — any field NOT listed here
 *    is silently dropped, including `deletedAt` and any future internal
 *    columns added to the entity.
 *  - `metadata` is included here because it is intentionally caller-visible.
 *    It carries no sensitive internal data — it is purely what the SUPER_ADMIN
 *    stored when creating or updating the project.
 *  - Dates are typed as Date so serialisation to ISO-8601 is handled
 *    by JSON.stringify automatically.
 */
export class ProjectResponseDto {
  @Expose()
  id!: string;

  @Expose()
  workOrderNumber!: string;

  @Expose()
  projectName!: string;

  @Expose()
  clientName!: string;

  @Expose()
  workOrderDate!: Date;

  @Expose()
  status!: ProjectStatus;

  @Expose()
  metadata!: Record<string, unknown> | null;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
