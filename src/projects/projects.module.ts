import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Project } from './entities/project.entity';
import { PROJECT_REPOSITORY } from './repositories/project-repository.interface';
import { TypeOrmProjectRepository } from './repositories/project.repository';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

/**
 * ProjectsModule wiring.
 *
 * Dependency note:
 *  - Authorization is handled purely by RolesGuard (SUPER_ADMIN only).
 *    CaslAbilityFactory is NOT imported here — it is not needed when
 *    the authorization decision is a single role check rather than an
 *    attribute-level policy.
 *  - RolesGuard is applied at the controller level via decorators, so
 *    no guard registration is needed in this module.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Project])],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    {
      provide: PROJECT_REPOSITORY,
      useClass: TypeOrmProjectRepository,
    },
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
