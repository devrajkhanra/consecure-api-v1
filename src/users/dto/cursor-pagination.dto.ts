import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Query-string DTO for cursor-paginated list endpoints.
 *
 * The `@Type(() => Number)` decorator is REQUIRED on `limit`.
 * HTTP query parameters arrive as strings; without it, @IsInt() fails
 * because '25' !== 25 at the class-validator level even though they
 * look the same. `transform: true` on the global ValidationPipe makes
 * @Type work automatically.
 */
export class CursorPaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;

  @IsOptional()
  @IsString()
  cursor?: string;
}
