import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OperatorPayload } from '../guards/jwt-auth.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OperatorPayload | undefined => {
    return ctx.switchToHttp().getRequest().user;
  },
);
