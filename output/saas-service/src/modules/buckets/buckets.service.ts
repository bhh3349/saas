import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../../common/business.exception';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { ShopBucket } from '../../entities/shop-bucket.entity';

export interface BucketData {
  /** 配置内容（任意 JSON） */
  data: unknown;
  updated_at?: Date;
}

const ALLOWED_KEYS = new Set([
  'print',
  'stall',
  'voucher',
  'discount',
  'mustdish',
  'role',
  'store_profile',
  'business_settings',
  'staff',
  'payments',
]);

@Injectable()
export class BucketsService {
  constructor(
    @InjectRepository(ShopBucket)
    private readonly bucketRepo: Repository<ShopBucket>,
  ) {}

  /** 读取配置桶；未配置时返回 null */
  async get(user: AuthUser, key: string): Promise<BucketData | null> {
    this.assertKey(key);
    const row = await this.bucketRepo.findOne({
      where: { shop_id: user.shopId, key },
    });
    if (!row) return null;
    return { data: this.parse(row.data), updated_at: row.updated_at };
  }

  /** 覆盖保存配置桶（整包覆盖） */
  async put(user: AuthUser, key: string, data: unknown): Promise<BucketData> {
    this.assertKey(key);
    let row = await this.bucketRepo.findOne({
      where: { shop_id: user.shopId, key },
    });
    const serialized = JSON.stringify(data ?? null);
    if (row) {
      row.data = serialized;
      await this.bucketRepo.save(row);
    } else {
      row = await this.bucketRepo.save(
        this.bucketRepo.create({
          shop_id: user.shopId,
          key,
          data: serialized,
        }),
      );
    }
    return { data: this.parse(row.data), updated_at: row.updated_at };
  }

  private assertKey(key: string): void {
    if (!ALLOWED_KEYS.has(key)) {
      throw new BusinessException('无效的配置键');
    }
  }

  private parse(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
