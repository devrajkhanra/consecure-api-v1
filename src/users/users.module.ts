import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './entities/user.entity';
import { USER_REPOSITORY } from './repositories/user-repository.interface';
import { TypeOrmUserRepository } from './repositories/user.repository';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * UsersModule wiring.
 *
 * The custom provider block is the critical seam between layers:
 *
 *   provide:  USER_REPOSITORY   ← the token the service asks for
 *   useClass: TypeOrmUserRepository ← the concrete class NestJS builds
 *
 * Consequences:
 *  - UsersService never imports TypeOrmUserRepository or Repository<User>.
 *  - In tests, swap `useClass` for `useValue: mockUserRepository` and
 *    the service is fully isolated without any database connection.
 *  - Migrating to Prisma means writing PrismaUserRepository,
 *    changing `useClass` here, and touching nothing else.
 *
 * TypeOrmModule.forFeature([User]) must be imported here — not globally —
 * so that @InjectRepository(User) inside TypeOrmUserRepository resolves
 * within this module's DI scope.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: USER_REPOSITORY,
      useClass: TypeOrmUserRepository,
    },
  ],
  exports: [
    // Export the service so other modules (e.g. AuthModule) can inject
    // UsersService without re-declaring UsersModule's providers.
    UsersService,
  ],
})
export class UsersModule {}