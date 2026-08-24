import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** 登录用户信息（由 JwtAuthGuard 注入 req.user） */
export interface AuthUser {
  userId: number;
  shopId: number;
  role: string;
  phone: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser;
  },
);
