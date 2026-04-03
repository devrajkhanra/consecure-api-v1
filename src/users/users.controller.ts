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
} from '@nestjs/common';

import { CreateUserDto } from './dto/create-user.dto';
import { CursorPaginationDto } from './dto/cursor-pagination.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserMapper } from './mappers/user.mapper';
import { UsersService } from './users.service';

/**
 * Entry/exit point for the Users HTTP surface.
 *
 * Responsibilities:
 *  - Parse and validate inbound HTTP data (delegated to DTOs + ValidationPipe).
 *  - Delegate business logic entirely to UsersService.
 *  - Map every outbound result through UserMapper before returning it.
 *
 * What this controller must NEVER do:
 *  - Contain business logic (duplicate checks, hashing, etc.)
 *  - Return a raw User entity — doing so risks leaking `password`,
 *    `deletedAt`, or future sensitive columns added to the entity.
 *  - Import anything from TypeORM.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * POST /users
   * Create a new user account.
   * Returns 201 Created with the sanitised user DTO.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createUserDto: CreateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.create(createUserDto);
    return UserMapper.toResponse(user);
  }

  /**
   * GET /users?limit=25&cursor=<token>
   * Retrieve a cursor-paginated list of users.
   *
   * Response shape:
   * {
   *   data: UserResponseDto[],
   *   nextCursor: string | null   // null means no further pages
   * }
   */
  @Get()
  @HttpCode(HttpStatus.OK)
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
   * Retrieve a single user by UUID.
   * Returns 404 when the user does not exist.
   *
   * ParseUUIDPipe rejects syntactically invalid UUIDs with 400 before
   * the service layer is ever reached — no wasted DB round-trips.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.findOne(id);
    return UserMapper.toResponse(user);
  }

  /**
   * PATCH /users/:id
   * Partially update a user.  All fields are optional.
   * Returns 404 when the user does not exist.
   * Returns 409 when the new email is already taken.
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.update(id, updateUserDto);
    return UserMapper.toResponse(user);
  }

  /**
   * DELETE /users/:id
   * Soft-delete a user (sets deletedAt; row remains in DB).
   * Returns 204 No Content on success — no body.
   * Returns 404 when the user does not exist.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.usersService.remove(id);
  }
}