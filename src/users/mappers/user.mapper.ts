import { plainToInstance } from 'class-transformer';
import { User } from '../entities/user.entity';
import { UserResponseDto } from '../dto/user-response.dto';

export class UserMapper {
  static toResponse(user: User): UserResponseDto {
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  static toResponseList(users: User[]): UserResponseDto[] {
    return users.map(user => this.toResponse(user));
  }

  static toResponsePaginated(result: {
    data: User[];
    nextCursor: string | null;
  }): {
    data: UserResponseDto[];
    nextCursor: string | null;
  } {
    return {
      data: this.toResponseList(result.data),
      nextCursor: result.nextCursor,
    };
  }
}