import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Hardening rationale per field:
 *
 *  firstName / lastName
 *    @Transform trim  — prevents whitespace-only strings that pass @IsNotEmpty
 *                       (e.g. "   " has length > 0 but is semantically empty).
 *    @MaxLength 100   — closes the OOM vector: without a ceiling an attacker can
 *                       POST a 10 MB string which lands in memory, gets hashed,
 *                       serialised, possibly logged, and echoed back.
 *
 *  email
 *    trim + toLowerCase normalises before uniqueness checks so
 *    "Alice@EXAMPLE.COM" and "alice@example.com" are treated as identical.
 *    @MaxLength 254    — RFC 5321 §4.5.3.1 hard limit.
 *
 *  password
 *    NO trim — whitespace is valid and intentional inside a password.
 *    @MaxLength 72     — bcrypt silently truncates input at 72 bytes;
 *                        accepting longer strings wastes CPU with zero
 *                        extra security benefit and enables a DoS vector.
 */
export class CreateUserDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'First name cannot be empty' })
  @MaxLength(100, { message: 'First name must not exceed 100 characters' })
  firstName!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Last name cannot be empty' })
  @MaxLength(100, { message: 'Last name must not exceed 100 characters' })
  lastName!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(254, { message: 'Email must not exceed 254 characters' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(72, {
    message:
      'Password must not exceed 72 characters (bcrypt effective maximum)',
  })
  password!: string;
}