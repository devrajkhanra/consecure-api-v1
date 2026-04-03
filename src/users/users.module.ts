import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CaslAbilityFactory } from '../auth/casl/casl-ability.factory';
import { User } from './entities/user.entity';
import { USER_REPOSITORY } from './repositories/user-repository.interface';
import { TypeOrmUserRepository } from './repositories/user.repository';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * UsersModule wiring.
 *
 * Dependency note:
 *  - CaslAbilityFactory is provided here directly (it has no constructor
 *    dependencies — it is pure logic) to avoid a circular dependency between
 *    UsersModule and AuthModule.  AuthModule imports UsersModule; if
 *    UsersModule also imported AuthModule the DI graph would be circular.
 *
 *  - The file-level import of CaslAbilityFactory is fine (TypeScript
 *    compiles to a plain require); only the DI module graph is affected
 *    by forwardRef() or module imports.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    CaslAbilityFactory,
    {
      provide: USER_REPOSITORY,
      useClass: TypeOrmUserRepository,
    },
  ],
  exports: [
    UsersService,
    CaslAbilityFactory,
  ],
})
export class UsersModule {}
