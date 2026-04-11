import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Project } from '../entities/project.entity';
import type { IProjectRepository } from './project-repository.interface';

/**
 * Infrastructure layer: TypeORM implementation of IProjectRepository.
 *
 * This is the ONE file in the entire projects module that is allowed to:
 *   - import from 'typeorm'
 *   - use @InjectRepository()
 *   - reference QueryBuilder APIs
 *
 * The service layer depends only on IProjectRepository, so swapping this
 * class out for a different persistence backend (e.g. Prisma, raw pg,
 * an in-memory fake for tests) requires zero changes outside this file
 * and projects.module.ts.
 */
@Injectable()
export class TypeOrmProjectRepository implements IProjectRepository {
  constructor(
    @InjectRepository(Project)
    private readonly repo: Repository<Project>,
  ) {}

  // ─── Reads ────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<Project | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByWorkOrderNumber(
    workOrderNumber: string,
  ): Promise<Project | null> {
    return this.repo.findOne({ where: { workOrderNumber } });
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
  }): Promise<{ data: Project[]; nextCursor: string | null }> {
    const limit = Math.min(options?.limit ?? 25, 100);

    const qb = this.repo
      .createQueryBuilder('project')
      .orderBy('project.createdAt', 'ASC')
      .addOrderBy('project.id', 'ASC')
      .take(limit + 1); // +1 to detect next page

    if (options?.cursor) {
      const { createdAt, id } = this.decodeCursor(options.cursor);
      qb.andWhere(
        '(project.createdAt > :createdAt OR (project.createdAt = :createdAt AND project.id > :id))',
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

  async createProject(projectData: Partial<Project>): Promise<Project> {
    const entity = this.repo.create(projectData);
    return this.repo.save(entity);
  }

  async updateProject(
    id: string,
    updateData: Partial<Project>,
  ): Promise<Project> {
    // Re-fetch inside the repo so TypeORM tracks the entity correctly
    // and updatedAt is bumped by the ORM rather than the caller.
    const project = await this.findById(id);
    if (!project) {
      throw new NotFoundException(`Project with id "${id}" not found`);
    }
    const merged = this.repo.merge(project, updateData);
    return this.repo.save(merged);
  }

  async removeProject(id: string): Promise<Project> {
    const project = await this.findById(id);
    if (!project) {
      throw new NotFoundException(`Project with id "${id}" not found`);
    }
    // softRemove sets deletedAt; the entity has @DeleteDateColumn.
    return this.repo.softRemove(project);
  }

  // ─── Cursor helpers (private, infrastructure concern) ─────────────────────

  private encodeCursor(project: Project): string {
    const payload = JSON.stringify({
      createdAt: project.createdAt.toISOString(),
      id: project.id,
    });
    return Buffer.from(payload, 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): { createdAt: string; id: string } {
    const payload = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(payload) as { createdAt: string; id: string };
  }
}
