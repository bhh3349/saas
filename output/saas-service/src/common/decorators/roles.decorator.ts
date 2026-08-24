import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums';
import { ROLES_KEY } from '../guards/roles.guard';

/** 角色守卫元数据：声明接口可用角色 */
export const Roles = (...roles: UserRole[]) =>
  SetMetadata(ROLES_KEY, roles);
