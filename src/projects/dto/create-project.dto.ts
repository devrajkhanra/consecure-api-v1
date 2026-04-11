import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ProjectStatus } from '../enums/project-status.enum';

/**
 * Hardening rationale per field:
 *
 *  workOrderNumber
 *    @Transform trim — prevents whitespace-only strings passing @IsNotEmpty.
 *    @MaxLength 50   — work order numbers are short identifiers; a ceiling
 *                      prevents oversized strings reaching the unique index.
 *
 *  projectName / clientName
 *    @Transform trim — same whitespace guard.
 *    @MaxLength 255  — practical upper bound for a name column.
 *
 *  workOrderDate
 *    @IsDateString() — validates ISO 8601 date format (YYYY-MM-DD).
 *                      The entity maps this to a DATE column, which means
 *                      no time component is persisted.
 *
 *  status
 *    @IsEnum(ProjectStatus) — only the defined lifecycle values are accepted.
 *                             Defaults to PENDING at the entity level, but
 *                             callers may supply a different initial state.
 *
 *  metadata
 *    @IsOptional @IsObject — free-form extra fields.  We validate it is a
 *                            plain object (not an array or primitive) but do
 *                            not constrain its keys or values.  Individual
 *                            features that rely on specific metadata keys must
 *                            validate those keys themselves.
 */
export class CreateProjectDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Work order number cannot be empty' })
  @MinLength(1)
  @MaxLength(50, { message: 'Work order number must not exceed 50 characters' })
  workOrderNumber!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Project name cannot be empty' })
  @MaxLength(255, { message: 'Project name must not exceed 255 characters' })
  projectName!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Client name cannot be empty' })
  @MaxLength(255, { message: 'Client name must not exceed 255 characters' })
  clientName!: string;

  @IsDateString({}, { message: 'Work order date must be a valid ISO 8601 date (YYYY-MM-DD)' })
  workOrderDate!: string;

  @IsEnum(ProjectStatus, {
    message: `Status must be one of: ${Object.values(ProjectStatus).join(', ')}`,
  })
  status!: ProjectStatus;

  /**
   * Arbitrary extra fields for this project.
   * Absent or null means no additional metadata.
   * Callers should keep the structure flat; nested objects are stored
   * as-is in jsonb but are harder to query from the database layer.
   */
  @IsOptional()
  @IsObject({ message: 'Metadata must be a plain object' })
  metadata?: Record<string, unknown>;
}
