import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }

  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await this.hashPassword(createUserDto.password);
    const newUser = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });
    return this.userRepository.save(newUser);
  }

  private encodeCursor(record: User): string {
    return Buffer.from(`${record.createdAt.toISOString()}::${record.id}`).toString('base64');
  }

  private decodeCursor(cursor: string): { createdAt: Date; id: string } {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const [createdAt, id] = decoded.split('::');
      return { createdAt: new Date(createdAt), id };
    } catch {
      throw new Error('Invalid cursor');
    }
  }

  async findAll(options?: { limit?: number; cursor?: string }) {
    const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100);
    const cursor = options?.cursor;

    const qb = this.userRepository.createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .addOrderBy('user.id', 'DESC')
      .take(limit + 1);

    if (cursor) {
      const { createdAt, id } = this.decodeCursor(cursor);
      qb.where(
        '(user.createdAt < :createdAt OR (user.createdAt = :createdAt AND user.id < :id))',
        { createdAt, id },
      );
    }

    const rows = await qb.getMany();
    const hasNext = rows.length > limit;
    const payload = rows.slice(0, limit);

    return {
      data: payload,
      nextCursor: hasNext ? this.encodeCursor(payload[payload.length - 1]) : null,
    };
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);

    if (updateUserDto.password) {
      updateUserDto.password = await this.hashPassword(updateUserDto.password);
    }

    const updatedUser = Object.assign(user, updateUserDto);
    return this.userRepository.save(updatedUser);
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    return this.userRepository.softRemove(user);
  }
}