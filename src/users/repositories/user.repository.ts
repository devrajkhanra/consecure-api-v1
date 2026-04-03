import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../entities/user.entity';
import type { IUserRepository } from './user-repository.interface';

/**
 * Infrastructure layer: TypeORM implementation of IUserRepository.
 *
 * This is the ONE file in the entire codebase that is allowed to:
 *   - import from 'typeorm'
 *   - use @InjectRepository()
 *   - reference QueryBuilder APIs
 *
 * The service layer depends only on IUserRepository, so swapping this
 * class out for a different persistence backend (e.g. Prisma, raw pg,
 * an in-memory fake for tests) requires zero changes outside this file
 * and users.module.ts.
 */
@Injectable()
export class TypeOrmUserRepository implements IUserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  // ─── Reads ────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  /**
   * Cursor-based pagination.
   *
   * Cursor encoding:  base64( JSON({ createdAt: ISO-string, id: uuid }) )
   *
   * We order by (createdAt ASC, id ASC) and use a compound WHERE clause
   * so the result set is stable even when two rows share the same timestamp.
   *
   * We fetch `limit + 1` rows and use the presence of the extra row as the
   * signal that another page exists, then slice it off before returning.
   */
  async findAll(options?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ data: User[]; nextCursor: string | null }> {
    const limit = Math.min(options?.limit ?? 25, 100);

    const qb = this.repo
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'ASC')
      .addOrderBy('user.id', 'ASC')
      .take(limit + 1); // +1 to detect next page

    if (options?.cursor) {
      const { createdAt, id } = this.decodeCursor(options.cursor);
      qb.andWhere(
        '(user.createdAt > :createdAt OR (user.createdAt = :createdAt AND user.id > :id))',
        { createdAt, id },
      );
    }

    const rows = await qb.getMany();

    const hasNextPage = rows.length > limit;
    const data = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor = hasNextPage
      ? this.encodeCursor(data[data.length - 1])
      : null;

    return { data, nextCursor };
  }

  // ─── Writes ───────────────────────────────────────────────────────────────

  async saveUser(user: User): Promise<User> {
    return this.repo.save(user);
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const entity = this.repo.create(userData);
    return this.repo.save(entity);
  }

  async updateUser(id: string, updateData: Partial<User>): Promise<User> {
    // Re-fetch inside the repo so TypeORM tracks the entity correctly
    // and updatedAt is bumped by the ORM rather than the caller.
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }
    const merged = this.repo.merge(user, updateData);
    return this.repo.save(merged);
  }

  async removeUser(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }
    // softRemove sets deletedAt; the entity has @DeleteDateColumn.
    return this.repo.softRemove(user);
  }

  // ─── Cursor helpers (private, infrastructure concern) ─────────────────────

  private encodeCursor(user: User): string {
    const payload = JSON.stringify({
      createdAt: user.createdAt.toISOString(),
      id: user.id,
    });
    return Buffer.from(payload, 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): { createdAt: string; id: string } {
    const payload = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(payload) as { createdAt: string; id: string };
  }
}