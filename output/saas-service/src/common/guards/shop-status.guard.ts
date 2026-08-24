import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShopStatus } from '../enums';
import { Shop } from '../../entities/shop.entity';

/**
 * 店铺状态守卫（全局）：
 * 解析 JWT → 查本地店铺快照 → 店铺已停用则 403。
 * 无 token / token 无效放行（由各接口 JwtAuthGuard 处理 401）。
 */
@Injectable()
export class ShopStatusGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Shop)
    private readonly shopRepo: Repository<Shop>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth: string = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
      return true;
    }
    const token = auth.slice(7);
    try {
      const payload = await this.jwtService.verifyAsync<{ shopId?: number }>(token);
      if (payload.shopId) {
        const shop = await this.shopRepo.findOne({
          where: { shop_id: payload.shopId },
        });
        if (shop && shop.status === ShopStatus.Disabled) {
          throw new ForbiddenException('店铺已停用，请联系平台');
        }
      }
    } catch (err) {
      if (err instanceof ForbiddenException) {
        throw err;
      }
      // token 无效 / 店铺快照缺失：交给 JwtAuthGuard / 业务守卫处理
    }
    return true;
  }
}
