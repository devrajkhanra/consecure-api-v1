import type { Project } from '../entities/project.entity';

/**
 * Domain-level repository contract.
 *
 * Nothing in this file imports from TypeORM. Any infrastructure
 * concern (ORM, raw SQL, HTTP, cache) lives exclusively in the
 * concrete implementation that satisfies this interface.
 *
 * Rules enforced here:
 *  - findAll returns a stable cursor-paginated envelope, never a raw array.
 *  - Every mutating method returns the full, post-mutation entity so
 *    callers never have to issue a follow-up read.
 *  - removeProject performs a soft-delete and returns the tombstoned entity
 *    so audit trails remain intact.
 */
export interface IProjectRepository {
  /**
   * Resolve a single project by primary key.
   * Returns `null` — never throws — when the record does not exist.
   * The caller (service layer) owns the decision to raise NotFoundException.
   */
  findById(id: string): Promise<Project | null>;

  /**
   * Resolve a single project by work order number.
   * Returns `null` when no match is found.
   * Used by the service layer for duplicate work-order-number guards.
   */
  findByWorkOrderNumber(workOrderNumber: string): Promise<Project | null>;

  /**
   * Return a cursor-paginated slice of projects ordered by (createdAt ASC, id ASC).
   *
   * @param options.limit  - Maximum records to return (default: 25, max: 100).
   * @param options.cursor - Opaque continuation token from a previous response.
   *
   * Callers must treat `cursor` as an opaque string — its internal encoding
   * is an implementation detail of the concrete repository.
   */
  findAll(options?: { limit?: number; cursor?: string }): Promise<{
    data: Project[];
    nextCursor: string | null;
  }>;

  /**
   * Instantiate and persist a new project from a partial payload.
   * The repository is responsible for `repo.create()` + `repo.save()`.
   */
  createProject(projectData: Partial<Project>): Promise<Project>;

  /**
   * Apply a partial update to an existing record.
   * The repository must re-fetch before patching so optimistic-locking
   * columns (updatedAt) are respected by the ORM.
   */
  updateProject(id: string, updateData: Partial<Project>): Promise<Project>;

  /**
   * Soft-delete a project (sets deletedAt).
   * Returns the tombstoned entity so the service can confirm the operation.
   */
  removeProject(id: string): Promise<Project>;
}

/** Injection token used with @Inject() in the service layer. */
export const PROJECT_REPOSITORY = 'IProjectRepository' as const;
