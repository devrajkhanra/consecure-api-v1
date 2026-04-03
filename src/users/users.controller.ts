import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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

import { Action } from '../auth/enums/action.enum';
import { Role } from '../auth/enums/role.enum';
import { CaslAbilityFactory } from '../auth/casl/casl-ability.factory';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { CursorPaginationDto } from './dto/cursor-pagination.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserMapper } from './mappers/user.mapper';
import { UsersService } from './users.service';
import type { User } from './entities/user.entity';

/**
 * Entry/exit point for the Users HTTP surface.
 *
 * Authorization model (applied on top of the global JwtAuthGuard):
 *  - POST /users          — ADMIN or SUPER_ADMIN only. Use /auth/register
 *                           for self-service registration.
 *  - GET /users           — ADMIN or SUPER_ADMIN only.
 *  - GET /users/:id       — Own profile OR admin.
 *  - PATCH /users/:id     — CASL-controlled: users may update only their
 *                           own non-sensitive fields; admins may update any.
 *  - DELETE /users/:id    — Own account OR admin.
 */
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  /**
   * POST /users
   * Admin-only user creation (bypasses the registration flow).
   * Self-service registration should use POST /auth/register.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async create(
    @Body() createUserDto: CreateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.create(createUserDto);
    return UserMapper.toResponse(user);
  }

  /**
   * GET /users?limit=25&cursor=<token>
   * Paginated user list — admin only.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async findAll(
    @Query() query: CursorPaginationDto,
  ): Promise<{ data: UserResponseDto[]; nextCursor: string | null }> {
    const result = await this.usersService.findAll({
      limit: query.limit,
      cursor: query.cursor,
    });
    return UserMapper.toResponsePaginated(result);
  }

  /**
   * GET /users/:id
   * Users may fetch their own profile; admins may fetch any profile.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ): Promise<UserResponseDto> {
    const target = await this.usersService.findOne(id);
    const ability = this.caslAbilityFactory.createForUser(currentUser);

    if (!ability.can(Action.Read, target)) {
      throw new ForbiddenException(
        'You do not have permission to view this user',
      );
    }

    return UserMapper.toResponse(target);
  }

  /**
   * PATCH /users/:id
   * CASL-enforced: users can update their own firstName/lastName;
   * admins can update any field except roles (SUPER_ADMIN only).
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: User,
  ): Promise<UserResponseDto> {
    const target = await this.usersService.findOne(id);
    const ability = this.caslAbilityFactory.createForUser(currentUser);

    if (!ability.can(Action.Update, target)) {
      throw new ForbiddenException(
        'You do not have permission to update this user',
      );
    }

    const user = await this.usersService.update(id, updateUserDto);
    return UserMapper.toResponse(user);
  }

  /**
   * DELETE /users/:id
   * Users may delete their own account; admins may delete any account.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ): Promise<void> {
    const target = await this.usersService.findOne(id);
    const ability = this.caslAbilityFactory.createForUser(currentUser);

    if (!ability.can(Action.Delete, target)) {
      throw new ForbiddenException(
        'You do not have permission to delete this user',
      );
    }

    await this.usersService.remove(id);
  }
}
