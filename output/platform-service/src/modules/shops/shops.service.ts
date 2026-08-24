import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../../common/business.exception';
import { Shop } from '../../entities/shop.entity';
import { OpLogService } from '../op-log/op-log.service';
import { SaasClientService } from '../saas-client/saas-client.service';
import { ListShopsDto } from './dto/list-shops.dto';

export interface PagedResult<T> {
  total: number;
  items: T[];
}

@Injectable()
export class ShopsService {
  constructor(
    @InjectRepository(Shop)
    private readonly shopRepo: Repository<Shop>,
    private readonly opLogService: OpLogService,
    private readonly saasClient: SaasClientService,
  ) {}

  /** 全量店铺列表（跨租户，运营视角） */
  async list(dto: ListShopsDto): Promise<PagedResult<Shop>> {
    const qb = this.shopRepo.createQueryBuilder('s');
    if (dto.keyword) {
      qb.andWhere('(s.name LIKE :kw OR s.address LIKE :kw OR s.phone LIKE :kw)', {
        kw: `%${dto.keyword}%`,
      });
    }
    if (dto.status) {
      qb.andWhere('s.status = :status', { status: dto.status });
    }
    qb.orderBy('s.created_at', 'DESC');

    const total = await qb.getCount();
    const page = dto.page ?? 1;
    const pageSize = dto.page_size ?? 20;
    const items = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { total, items };
  }

  /**
   * 店铺停用 / 启用（敏感操作）：
   * 记录操作日志 + 同步状态到 saas-service（push，使其立即生效）；
   * push 失败不阻断本操作，saas 端登录时另有 pull 兜底。
   */
  async updateStatus(
    id: number,
    status: string,
    operatorId: number,
    meta: { ip?: string; userAgent?: string } = {},
  ): Promise<Shop> {
    const shop = await this.shopRepo.findOne({ where: { id } });
    if (!shop) {
      throw new BusinessException('店铺不存在');
    }
    const oldStatus = shop.status;
    if (oldStatus === status) {
      return shop;
    }
    shop.status = status;
    const saved = await this.shopRepo.save(shop);
    await this.opLogService.log(
      operatorId,
      'shop_status_update',
      `shop:${saved.id}`,
      `${oldStatus} -> ${status}`,
      meta,
    );
    await this.saasClient.pushShopStatus(saved.id, saved.status, saved.name);
    return saved;
  }

  async findById(id: number): Promise<Shop | null> {
    return this.shopRepo.findOne({ where: { id } });
  }
}
