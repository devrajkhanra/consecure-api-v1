import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import type { Project } from './entities/project.entity';
import type { IProjectRepository } from './repositories/project-repository.interface';
import { PROJECT_REPOSITORY } from './repositories/project-repository.interface';

/**
 * Application service: orchestrates business rules for the Projects domain.
 *
 * Dependency hygiene enforced here:
 *  - No import from 'typeorm'. Not even `Repository<T>`.
 *  - No import from '@nestjs/typeorm'. Not even `@InjectRepository`.
 *  - The only persistence surface is IProjectRepository, injected via the
 *    PROJECT_REPOSITORY token. Swapping persistence backends requires
 *    zero changes to this file.
 */
@Injectable()
export class ProjectsService {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(dto: CreateProjectDto): Promise<Project> {
    const existing = await this.projectRepository.findByWorkOrderNumber(
      dto.workOrderNumber,
    );
    if (existing) {
      // 409 Conflict — not 400. The request is well-formed; the state
      // of the system prevents it from being fulfilled.
      throw new ConflictException(
        `A project with work order number "${dto.workOrderNumber}" already exists`,
      );
    }

    return this.projectRepository.createProject({
      workOrderNumber: dto.workOrderNumber,
      projectName: dto.projectName,
      clientName: dto.clientName,
      // workOrderDate arrives as an ISO string from the DTO; TypeORM
      // accepts strings for DATE columns and handles the conversion.
      workOrderDate: new Date(dto.workOrderDate),
      status: dto.status,
      metadata: dto.metadata ?? null,
    });
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  async findAll(options?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ data: Project[]; nextCursor: string | null }> {
    return this.projectRepository.findAll(options);
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectRepository.findById(id);
    if (!project) {
      throw new NotFoundException(`Project with id "${id}" not found`);
    }
    return project;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    // Confirm the record exists before building the patch.
    // findOne throws NotFoundException when absent, so if we reach the
    // lines below we know the project is present.
    await this.findOne(id);

    const patch: Partial<Project> = {};

    if (dto.workOrderNumber !== undefined) {
      const occupant = await this.projectRepository.findByWorkOrderNumber(
        dto.workOrderNumber,
      );
      if (occupant && occupant.id !== id) {
        throw new ConflictException(
          `Work order number "${dto.workOrderNumber}" is already taken by another project`,
        );
      }
      patch.workOrderNumber = dto.workOrderNumber;
    }

    if (dto.projectName !== undefined) patch.projectName = dto.projectName;
    if (dto.clientName !== undefined) patch.clientName = dto.clientName;
    if (dto.workOrderDate !== undefined)
      patch.workOrderDate = new Date(dto.workOrderDate);
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.metadata !== undefined) patch.metadata = dto.metadata;

    return this.projectRepository.updateProject(id, patch);
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    // Confirm existence first so we return 404 rather than silently
    // succeeding on a non-existent resource.
    await this.findOne(id);
    await this.projectRepository.removeProject(id);
  }
}
