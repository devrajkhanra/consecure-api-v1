import type { User } from '../entities/user.entity';

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
 *  - removeUser performs a soft-delete and returns the tombstoned entity
 *    so audit trails remain intact.
 */
export interface IUserRepository {
  /**
   * Resolve a single user by primary key.
   * Returns `null` — never throws — when the record does not exist.
   * The caller (service layer) owns the decision to raise NotFoundException.
   */
  findById(id: string): Promise<User | null>;

  /**
   * Resolve a single user by unique email address.
   * Returns `null` when no match is found.
   * Used by the service layer for duplicate-email guards.
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Return a cursor-paginated slice of users ordered by (createdAt ASC, id ASC).
   *
   * @param options.limit  - Maximum records to return (default: 25, max: 100).
   * @param options.cursor - Opaque continuation token from a previous response.
   *
   * Callers must treat `cursor` as an opaque string — its internal encoding
   * is an implementation detail of the concrete repository.
   */
  findAll(options?: {
    limit?: number;
    cursor?: string;
  }): Promise<{
    data: User[];
    nextCursor: string | null;
  }>;

  /**
   * Persist a pre-constructed entity instance.
   * Use this when the caller has already assembled the full entity
   * (e.g. after setting a hashed password on an existing record).
   */
  saveUser(user: User): Promise<User>;

  /**
   * Instantiate and persist a new user from a partial payload.
   * The repository is responsible for `repo.create()` + `repo.save()`.
   */
  createUser(userData: Partial<User>): Promise<User>;

  /**
   * Apply a partial update to an existing record.
   * The repository must re-fetch before patching so optimistic-locking
   * columns (updatedAt) are respected by the ORM.
   */
  updateUser(id: string, updateData: Partial<User>): Promise<User>;

  /**
   * Soft-delete a user (sets deletedAt).
   * Returns the tombstoned entity so the service can confirm the operation.
   */
  removeUser(id: string): Promise<User>;
}

/** Injection token used with @Inject() in the service layer. */
export const USER_REPOSITORY = 'IUserRepository' as const;