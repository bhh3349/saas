import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../../common/business.exception';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { DishStatus } from '../../common/enums';
import { Dish } from '../../entities/dish.entity';
import { CreateDishDto, DishSpecDto, ImportDishesDto } from './dto/create-dish.dto';
import { UpdateDishDto } from './dto/update-dish.dto';

export interface DishSpecItem {
  name: string;
  /** 加价（元） */
  price_delta: number;
}

export interface DishItem {
  id: number;
  name: string;
  category: string;
  /** 单价（元） */
  price: number;
  specs: DishSpecItem[];
  code: string;
  spec_code: string;
  /** 普通菜 / 称重菜 */
  type: string;
  sort_order: number;
  status: string;
  sold_out: boolean;
  created_at: Date;
}

/** 元 → 分 */
function yuanToCents(v: number): number {
  return Math.round(v * 100);
}

/** 分 → 元 */
function centsToYuan(v: number): number {
  return v / 100;
}

@Injectable()
export class DishesService {
  constructor(
    @InjectRepository(Dish)
    private readonly dishRepo: Repository<Dish>,
  ) {}

  async create(user: AuthUser, dto: CreateDishDto): Promise<DishItem> {
    const max = await this.dishRepo.findOne({
      where: { shop_id: user.shopId },
      order: { sort_order: 'DESC' },
    });
    const dish = await this.dishRepo.save(
      this.dishRepo.create({
        shop_id: user.shopId,
        name: dto.name,
        category: dto.category || '默认分类',
        price: yuanToCents(dto.price),
        specs: JSON.stringify(this.toSpecsCents(dto.specs)),
        code: dto.code || '',
        spec_code: dto.spec_code || '',
        type: dto.type || '普通菜',
        sort_order: dto.sort_order ?? (max ? max.sort_order + 1 : 1),
        status: DishStatus.OnSale,
        sold_out: false,
      }),
    );
    return this.toItem(dish);
  }

  /** 批量导入菜品：一次性创建多条，返回导入条数 */
  async importDishes(user: AuthUser, dto: ImportDishesDto): Promise<{ count: number }> {
    if (!dto.items || dto.items.length === 0) {
      throw new BusinessException('导入数据为空');
    }
    const max = await this.dishRepo.findOne({
      where: { shop_id: user.shopId },
      order: { sort_order: 'DESC' },
    });
    let base = max ? max.sort_order : 0;
    const rows = dto.items.map((item) =>
      this.dishRepo.create({
        shop_id: user.shopId,
        name: item.name,
        category: item.category || '默认分类',
        price: yuanToCents(item.price),
        specs: JSON.stringify(this.toSpecsCents(item.specs)),
        code: item.code || '',
        spec_code: item.spec_code || '',
        type: item.type || '普通菜',
        sort_order: ++base,
        status: DishStatus.OnSale,
        sold_out: false,
      }),
    );
    const saved = await this.dishRepo.save(rows);
    return { count: saved.length };
  }

  /** 批量保存排序：ids 数组顺序即排序顺序 */
  async sortDishes(user: AuthUser, ids: number[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    const dishes = await this.dishRepo.find({ where: { shop_id: user.shopId } });
    const map = new Map<number, Dish>();
    for (const d of dishes) map.set(d.id, d);
    for (const foreignId of ids) {
      if (!map.has(foreignId)) throw new BusinessException('包含非本店菜品');
    }
    const updates = ids.map((id, index) => {
      const d = map.get(id)!;
      d.sort_order = index + 1;
      return d;
    });
    await this.dishRepo.save(updates);
  }

  /** 后台管理列表（本店，全量含下架 / 沽清，可筛选） */
  async list(
    user: AuthUser,
    page: number,
    pageSize: number,
    category?: string,
    status?: string,
  ): Promise<{ total: number; items: DishItem[] }> {
    const where: Record<string, unknown> = { shop_id: user.shopId };
    if (category) where.category = category;
    if (status) where.status = status;
    const [items, total] = await this.dishRepo.findAndCount({
      where,
      order: { sort_order: 'ASC', id: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { total, items: items.map((i) => this.toItem(i)) };
  }

  /** 收银点餐菜单：仅在售且未沽清 */
  async menu(user: AuthUser): Promise<DishItem[]> {
    const items = await this.dishRepo.find({
      where: { shop_id: user.shopId, status: DishStatus.OnSale, sold_out: false },
      order: { category: 'ASC', id: 'ASC' },
    });
    return items.map((i) => this.toItem(i));
  }

  async update(user: AuthUser, id: number, dto: UpdateDishDto): Promise<DishItem> {
    const dish = await this.findInShop(user, id);
    if (dto.name !== undefined) dish.name = dto.name;
    if (dto.category !== undefined) dish.category = dto.category;
    if (dto.price !== undefined) dish.price = yuanToCents(dto.price);
    if (dto.specs !== undefined) dish.specs = JSON.stringify(this.toSpecsCents(dto.specs));
    if (dto.code !== undefined) dish.code = dto.code;
    if (dto.spec_code !== undefined) dish.spec_code = dto.spec_code;
    if (dto.type !== undefined) dish.type = dto.type;
    if (dto.sort_order !== undefined) dish.sort_order = dto.sort_order;
    await this.dishRepo.save(dish);
    return this.toItem(dish);
  }

  /** 上 / 下架 + 沽清 / 恢复 */
  async updateStatus(
    user: AuthUser,
    id: number,
    status?: string,
    soldOut?: boolean,
  ): Promise<DishItem> {
    const dish = await this.findInShop(user, id);
    if (status !== undefined) dish.status = status;
    if (soldOut !== undefined) dish.sold_out = soldOut;
    await this.dishRepo.save(dish);
    return this.toItem(dish);
  }

  async remove(user: AuthUser, id: number): Promise<void> {
    const dish = await this.findInShop(user, id);
    await this.dishRepo.remove(dish);
  }

  private async findInShop(user: AuthUser, id: number): Promise<Dish> {
    const dish = await this.dishRepo.findOne({ where: { id } });
    if (!dish || dish.shop_id !== user.shopId) {
      throw new BusinessException('菜品不存在');
    }
    return dish;
  }

  private toSpecsCents(specs?: DishSpecDto[]): DishSpecItem[] {
    return (specs || []).map((s) => ({
      name: s.name,
      price_delta: yuanToCents(s.price_delta || 0),
    }));
  }

  private toItem(d: Dish): DishItem {
    let specs: DishSpecItem[] = [];
    try {
      const parsed = JSON.parse(d.specs || '[]');
      if (Array.isArray(parsed)) {
        specs = parsed.map((s) => ({
          name: s.name ?? '',
          price_delta: centsToYuan(Number(s.price_delta) || 0),
        }));
      }
    } catch {
      // 规格数据异常时按空处理
    }
    return {
      id: d.id,
      name: d.name,
      category: d.category,
      price: centsToYuan(d.price),
      specs,
      code: d.code,
      spec_code: d.spec_code,
      type: d.type,
      sort_order: d.sort_order,
      status: d.status,
      sold_out: d.sold_out,
      created_at: d.created_at,
    };
  }
}
