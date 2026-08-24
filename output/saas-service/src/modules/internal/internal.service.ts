import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from '../../entities/shop.entity';
import { UpdateShopStatusDto } from './dto/update-shop-status.dto';

/** 内部接口（仅 platform-service 内网签名调用） */
@Injectable()
export class InternalService {
  constructor(
    @InjectRepository(Shop)
    private readonly shopRepo: Repository<Shop>,
  ) {}

  /** 平台端同步店铺状态（push），使停用立即生效 */
  async updateShopStatus(dto: UpdateShopStatusDto): Promise<{ shop_id: number; status: string }> {
    const existing = await this.shopRepo.findOne({
      where: { shop_id: dto.shop_id },
    });
    if (existing) {
      existing.status = dto.status;
      if (dto.name) existing.name = dto.name;
      await this.shopRepo.save(existing);
    } else {
      await this.shopRepo.save(
        this.shopRepo.create({
          shop_id: dto.shop_id,
          name: dto.name || '',
          status: dto.status,
        }),
      );
    }
    return { shop_id: dto.shop_id, status: dto.status };
  }
}
