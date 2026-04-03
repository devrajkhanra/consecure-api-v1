import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { User } from './entities/user.entity';
import type { IUserRepository } from './repositories/user-repository.interface';
import { USER_REPOSITORY } from './repositories/user-repository.interface';

/**
 * Application service: orchestrates business rules for the Users domain.
 *
 * Dependency hygiene enforced here:
 *  - No import from 'typeorm'. Not even `Repository<T>`.
 *  - No import from '@nestjs/typeorm'. Not even `@InjectRepository`.
 *  - The only persistence surface is IUserRepository, injected via the
 *    USER_REPOSITORY token. Swapping persistence backends requires
 *    zero changes to this file.
 *  - Password hashing lives here, not in the repository or controller.
 *    It is a business rule ("passwords must be stored hashed") and
 *    belongs in the application layer.
 */
@Injectable()
export class UsersService {
  /**
   * bcrypt work-factor of 12 gives ~250 ms on modern hardware.
   * High enough to resist brute force; low enough for a web request.
   */
  private static readonly SALT_ROUNDS = 12;

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      // 409 Conflict — not 400. The request is well-formed; the state
      // of the system prevents it from being fulfilled.
      throw new ConflictException(
        `A user with email "${dto.email}" already exists`,
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, UsersService.SALT_ROUNDS);

    return this.userRepository.createUser({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      password: hashedPassword,
    });
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  async findAll(options?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ data: User[]; nextCursor: string | null }> {
    return this.userRepository.findAll(options);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }
    return user;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    // Confirm the record exists before building the patch.
    // findOne throws NotFoundException when absent, so if we reach the
    // lines below we know the user is present.
    await this.findOne(id);

    const patch: Partial<User> = {};

    if (dto.firstName !== undefined) patch.firstName = dto.firstName;
    if (dto.lastName !== undefined) patch.lastName = dto.lastName;

    if (dto.email !== undefined) {
      const occupant = await this.userRepository.findByEmail(dto.email);
      if (occupant && occupant.id !== id) {
        throw new ConflictException(
          `Email "${dto.email}" is already taken by another account`,
        );
      }
      patch.email = dto.email;
    }

    if (dto.password !== undefined) {
      patch.password = await bcrypt.hash(dto.password, UsersService.SALT_ROUNDS);
    }

    return this.userRepository.updateUser(id, patch);
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    // Confirm existence first so we return 404 rather than silently
    // succeeding on a non-existent resource.
    await this.findOne(id);
    await this.userRepository.removeUser(id);
  }
}