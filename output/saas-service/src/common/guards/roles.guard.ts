import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums';

export const ROLES_KEY = 'roles';

/** 角色守卫：配合 @Roles(...) 使用，未标注 @Roles 视为仅需登录 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];
    if (required.length === 0) {
      return true;
    }
    const user = context.switchToHttp().getRequest().user;
    if (!user || !required.includes(user.role as UserRole)) {
      throw new ForbiddenException('无权访问');
    }
    return true;
  }
}
