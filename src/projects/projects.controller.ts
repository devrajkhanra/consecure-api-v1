import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Role } from '../auth/enums/role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { CursorPaginationDto } from './dto/cursor-pagination.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { ProjectMapper } from './mappers/project.mapper';
import { ProjectsService } from './projects.service';

/**
 * Entry/exit point for the Projects HTTP surface.
 *
 * Authorization model (applied on top of the global JwtAuthGuard):
 *  - ALL routes require SUPER_ADMIN role.
 *  - Projects are administrative work orders; no other role may read,
 *    create, update, or delete them.
 *
 * The @UseGuards(RolesGuard) + @Roles(Role.SUPER_ADMIN) decorators are
 * applied at the controller level so every route inherits the guard
 * automatically. Individual routes need no additional authorization logic.
 */
@Controller('projects')
@UseGuards(RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * POST /projects
   * Create a new work-order project.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createProjectDto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectsService.create(createProjectDto);
    return ProjectMapper.toResponse(project);
  }

  /**
   * GET /projects?limit=25&cursor=<token>
   * Paginated project list.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: CursorPaginationDto,
  ): Promise<{ data: ProjectResponseDto[]; nextCursor: string | null }> {
    const result = await this.projectsService.findAll({
      limit: query.limit,
      cursor: query.cursor,
    });
    return ProjectMapper.toResponsePaginated(result);
  }

  /**
   * GET /projects/:id
   * Retrieve a single project by its UUID.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectsService.findOne(id);
    return ProjectMapper.toResponse(project);
  }

  /**
   * PATCH /projects/:id
   * Partially update a project. All fields are optional; only supplied
   * fields are applied.  Work order number uniqueness is re-validated if
   * changed.
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectsService.update(id, updateProjectDto);
    return ProjectMapper.toResponse(project);
  }

  /**
   * DELETE /projects/:id
   * Soft-delete a project (sets deletedAt; row is retained for audit).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.projectsService.remove(id);
  }
}
