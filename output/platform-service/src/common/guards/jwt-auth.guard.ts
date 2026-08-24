import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getConfig } from '../../config/env';
import { Operator } from '../../entities/operator.entity';

export interface OperatorPayload {
  sub: number;
  userId: number;
  username: string;
  role: string;
  /** token 版本号：与 operator.token_version 比对，改密/改资料后旧 token 失效 */
  ver?: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Operator)
    private readonly operatorRepo: Repository<Operator>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = (req.headers.authorization as string) || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      throw new UnauthorizedException('未登录');
    }
    try {
      const payload = await this.jwtService.verifyAsync<OperatorPayload>(token, {
        secret: getConfig().jwtSecret,
      });
      // token 版本校验：改密 / 改资料后自增，旧 token 立即失效
      const operator = await this.operatorRepo.findOne({ where: { id: payload.userId } });
      if (!operator || (payload.ver ?? 0) !== operator.token_version) {
        throw new UnauthorizedException('登录已过期，请重新登录');
      }
      req.user = { ...payload, username: operator.username, role: operator.role, ver: operator.token_version };
      return true;
    } catch {
      throw new UnauthorizedException('登录已过期');
    }
  }
}
