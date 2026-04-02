import { IsString, IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class CreateUserDto {
    @IsString()
    @IsNotEmpty({ message: 'First name cannot be empty' })
    firstName!: string;

    @IsString()
    @IsNotEmpty()
    lastName!: string;

    @IsEmail({}, { message: 'Please provide a valid email address' })
    email!: string;

    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    password!: string;
}