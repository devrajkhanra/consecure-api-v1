import { IsEnum, IsUUID } from 'class-validator';

import { Role } from '../enums/role.enum';

export class AssignRoleDto {
  @IsUUID('4')
  userId!: string;

  @IsEnum(Role, { message: `role must be one of: ${Object.values(Role).join(', ')}` })
  role!: Role;
}
