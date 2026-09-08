import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DishStatus, ShopStatus } from '../../common/enums';
import { Dish } from '../../entities/dish.entity';
import { Shop } from '../../entities/shop.entity';

export interface PublicMenuItem {
  code: string;
  name: string;
  category: string;
  price: number;
  specs: Array<{ code: string; name: string; price_delta: number }>;
}

/** 二维码路径中的 shopCode 采用 shop_id 的 base36 编码，避免新增数据库字段。 */
export function encodeShopCode(shopId: number): string {
  return shopId.toString(36);
}

/** 解码店铺码，并把非法输入统一映射为查询不到。 */
function decodeShopCode(shopCode: string): number | null {
  const normalized = shopCode.trim().toLowerCase();
  if (!/^[a-z0-9]{1,12}$/.test(normalized)) {
    return null;
  }
  const shopId = Number.parseInt(normalized, 36);
  return Number.isSafeInteger(shopId) && shopId > 0 ? shopId : null;
}

export class PublicTableDto {
  readonly tableCode = '';
}

export class CreatePublicOrderDto {
  readonly tableCode = '';
  readonly items: Array<{ dish_code?: string; spec_code?: string; qty?: number }> = [];
  readonly remark = '';
}

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(Shop)
    private readonly shopRepo: Repository<Shop>,
    @InjectRepository(Dish)
    private readonly dishRepo: Repository<Dish>,
  ) {}

  async getActiveShopId(shopCode: string): Promise<number> {
    const shopId = decodeShopCode(shopCode);
    const shop = shopId
      ? await this.shopRepo.findOne({ where: { shop_id: shopId } })
      : null;
    if (!shop || shop.status !== ShopStatus.Active) {
      throw new NotFoundException('店铺不存在或已停用');
    }
    return shop.shop_id;
  }

  async menu(shopCode: string): Promise<PublicMenuItem[]> {
    const shopId = await this.getActiveShopId(shopCode);
    const dishes = await this.dishRepo.find({
      select: ['id', 'code', 'name', 'category', 'price', 'specs'],
      where: {
        shop_id: shopId,
        status: DishStatus.OnSale,
        sold_out: false,
      },
      order: { category: 'ASC', sort_order: 'ASC', id: 'ASC' },
    });

    return dishes.map((dish) => ({
      code: dish.code || dish.id.toString(36),
      name: dish.name,
      category: dish.category,
      price: dish.price,
      specs: this.parseSpecs(dish.specs),
    }));
  }

  private parseSpecs(rawSpecs: string): PublicMenuItem['specs'] {
    try {
      const parsed: unknown = JSON.parse(rawSpecs || '[]');
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((item) => {
        const source = item as { code?: unknown; name?: unknown; price_delta?: unknown };
        return {
          code: typeof source.code === 'string' ? source.code : '',
          name: typeof source.name === 'string' ? source.name : '',
          price_delta: typeof source.price_delta === 'number' ? source.price_delta : 0,
        };
      });
    } catch {
      return [];
    }
  }
}
