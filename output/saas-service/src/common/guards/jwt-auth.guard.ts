import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/** JWT 载荷：userId / shopId / role / phone */
export interface AuthPayload {
  sub: number;
  shopId: number;
  role: string;
  phone: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = (req.headers.authorization as string) || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      throw new UnauthorizedException('未登录');
    }
    try {
      const payload = await this.jwtService.verifyAsync<AuthPayload>(token);
      req.user = {
        userId: payload.sub,
        shopId: payload.shopId,
        role: payload.role,
        phone: payload.phone,
      };
      return true;
    } catch {
      throw new UnauthorizedException('登录已过期');
    }
  }
}
