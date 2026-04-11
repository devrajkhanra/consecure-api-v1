import { plainToInstance } from 'class-transformer';

import { ProjectResponseDto } from '../dto/project-response.dto';
import type { Project } from '../entities/project.entity';

/**
 * Application-layer mapper: Project entity → ProjectResponseDto.
 *
 * Design decisions:
 *  - Static methods only. No constructor, no DI token, no state.
 *    The mapper is a pure transformation function disguised as a class
 *    for namespacing purposes.
 *  - `excludeExtraneousValues: true` is the critical option. It means
 *    plainToInstance acts as an allowlist: only properties decorated
 *    with @Expose() on ProjectResponseDto are present in the output.
 *    If `deletedAt` or any future internal column accidentally lands on
 *    the entity it is silently dropped here — it never reaches the serialiser.
 *  - We do NOT use `@Exclude()` on the entity itself because the entity
 *    is a database concern, not an API concern. The mapper owns the
 *    projection responsibility entirely.
 */
export class ProjectMapper {
  private constructor() {
    // Non-instantiable utility class
  }

  /** Convert a single Project entity to its public DTO representation. */
  static toResponse(project: Project): ProjectResponseDto {
    return plainToInstance(ProjectResponseDto, project, {
      excludeExtraneousValues: true,
    });
  }

  /** Convert an array of Project entities. */
  static toResponseList(projects: Project[]): ProjectResponseDto[] {
    return projects.map((project) => ProjectMapper.toResponse(project));
  }

  /**
   * Convert the paginated envelope returned by the service.
   * The cursor is infrastructure-opaque and passes through unchanged.
   */
  static toResponsePaginated(result: {
    data: Project[];
    nextCursor: string | null;
  }): {
    data: ProjectResponseDto[];
    nextCursor: string | null;
  } {
    return {
      data: ProjectMapper.toResponseList(result.data),
      nextCursor: result.nextCursor,
    };
  }
}
