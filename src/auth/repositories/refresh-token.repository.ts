import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';

import { RefreshToken } from '../entities/refresh-token.entity';
import type { IRefreshTokenRepository } from './refresh-token-repository.interface';

/**
 * TypeORM implementation of IRefreshTokenRepository.
 *
 * This is the only file in the auth module allowed to import from 'typeorm'.
 */
@Injectable()
export class TypeOrmRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly repo: Repository<RefreshToken>,
  ) {}

  async create(data: {
    id: string;
    tokenHash: string;
    userId: string;
    family: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async findById(id: string): Promise<RefreshToken | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findActiveByFamily(family: string): Promise<RefreshToken[]> {
    return this.repo.find({
      where: {
        family,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  async rotateToken(oldId: string, replacedById: string): Promise<RefreshToken> {
    await this.repo.update(oldId, {
      isRevoked: true,
      replacedBy: replacedById,
    });
    return this.repo.findOne({ where: { id: oldId } }) as Promise<RefreshToken>;
  }

  async revokeById(id: string): Promise<void> {
    await this.repo.update(id, { isRevoked: true });
  }

  async revokeFamilyById(family: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ isRevoked: true })
      .where('"family" = :family', { family })
      .execute();
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ isRevoked: true })
      .where('"userId" = :userId', { userId })
      .execute();
  }
}
