import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../../common/business.exception';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { DishStatus } from '../../common/enums';
import { Dish } from '../../entities/dish.entity';
import { OrderRefund } from '../../entities/order-refund.entity';
import { Setmeal } from '../../entities/setmeal.entity';
import {
  CreateDishDto,
  DishSpecDto,
  ImportDishesDto,
  ImportSpecRowDto,
} from './dto/create-dish.dto';
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

/** 导入失败明细 */
export interface ImportRowError {
  name: string;
  category: string;
  type: string;
  spec: string;
  reason: string;
}

/** 导入结果 */
export interface ImportResult {
  /** 提交规格行总数 */
  total: number;
  /** 成功导入规格行数 */
  imported: number;
  /** 重复跳过行数 */
  skipped: number;
  /** 失败明细 */
  errors: ImportRowError[];
}

@Injectable()
export class DishesService {
  constructor(
    @InjectRepository(Dish)
    private readonly dishRepo: Repository<Dish>,
    @InjectRepository(Setmeal)
    private readonly setmealRepo: Repository<Setmeal>,
    @InjectRepository(OrderRefund)
    private readonly refundRepo: Repository<OrderRefund>,
  ) {}

  async create(user: AuthUser, dto: CreateDishDto): Promise<DishItem> {
    const category = dto.category || '默认分类';
    const type = dto.type || '普通菜';
    // 唯一性：名称 + 分类 + 类型 已存在则拒绝（多规格需在菜品库编辑中补充）
    const exists = await this.dishRepo.findOne({
      where: { shop_id: user.shopId, name: dto.name, category, type },
    });
    if (exists) {
      throw new BusinessException(`菜品「${dto.name}」（分类：${category}）已存在，如需新增规格请在菜品库编辑该菜品`);
    }
    const max = await this.dishRepo.findOne({
      where: { shop_id: user.shopId },
      order: { sort_order: 'DESC' },
    });
    const dish = await this.dishRepo.save(
      this.dishRepo.create({
        shop_id: user.shopId,
        name: dto.name,
        category,
        price: yuanToCents(dto.price),
        specs: JSON.stringify(this.toSpecsCents(dto.specs)),
        code: dto.code || '',
        spec_code: dto.spec_code || '',
        type,
        sort_order: dto.sort_order ?? (max ? max.sort_order + 1 : 1),
        status: DishStatus.OnSale,
        sold_out: false,
      }),
    );
    return this.toItem(dish);
  }

  /**
   * 批量导入菜品：以「名称 + 分类 + 类型 + 规格」组合唯一判重。
   * 同名同分类同类型且规格不同 → 多规格，合并进同一菜品；完全相同 → 跳过并计入重复明细。
   */
  async importDishes(user: AuthUser, dto: ImportDishesDto): Promise<ImportResult> {
    if (!dto.items || dto.items.length === 0) {
      throw new BusinessException('导入数据为空');
    }
    const existing = await this.dishRepo.find({ where: { shop_id: user.shopId } });

    // 已有菜品规格名集合（单规格菜隐含「标准」规格）
    const specNamesOf = (d: Dish): string[] => {
      let names: string[] = [];
      try {
        const parsed = JSON.parse(d.specs || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) {
          names = parsed.map((s) => String(s?.name ?? '').trim()).filter(Boolean);
        }
      } catch {
        // 规格数据异常按单规格处理
      }
      return names.length > 0 ? names : ['标准'];
    };

    // 已有唯一键集合 + 按 name|category|type 分组（用于多规格合并）
    const keySet = new Set<string>();
    const groupMap = new Map<string, Dish>();
    for (const d of existing) {
      const category = d.category || '默认分类';
      const type = d.type || '普通菜';
      for (const spec of specNamesOf(d)) {
        keySet.add(`${d.name}|${category}|${type}|${spec}`);
      }
      const gk = `${d.name}|${category}|${type}`;
      if (!groupMap.has(gk)) groupMap.set(gk, d);
    }

    interface PendingRow {
      name: string;
      category: string;
      type: string;
      priceCents: number;
      spec: string;
      status: string;
    }

    const errors: ImportRowError[] = [];
    const pending: PendingRow[] = [];
    const seen = new Set<string>();

    for (const item of dto.items) {
      const name = (item.name || '').trim();
      const category = (item.category || '默认分类').trim() || '默认分类';
      const type = item.type === '称重菜' ? '称重菜' : '普通菜';
      const spec = (item.spec || '标准').trim() || '标准';
      const priceCents = yuanToCents(item.price);
      const status = item.status === '停售' ? DishStatus.OffSale : DishStatus.OnSale;
      const key = `${name}|${category}|${type}|${spec}`;

      if (!name) {
        errors.push({ name, category, type, spec, reason: '菜品名称不能为空' });
        continue;
      }
      if (seen.has(key)) {
        errors.push({ name, category, type, spec, reason: '文件内重复（名称/分类/类型/规格 完全相同）' });
        continue;
      }
      seen.add(key);
      if (keySet.has(key)) {
        errors.push({ name, category, type, spec, reason: '与现有菜品重复（名称/分类/类型/规格 完全相同）' });
        continue;
      }
      pending.push({ name, category, type, priceCents, spec, status });
    }

    if (pending.length === 0) {
      return { total: dto.items.length, imported: 0, skipped: errors.length, errors };
    }

    // 按 name|category|type 分组：库内已有则合并规格，否则新建
    const groups = new Map<string, PendingRow[]>();
    for (const p of pending) {
      const gk = `${p.name}|${p.category}|${p.type}`;
      const arr = groups.get(gk);
      if (arr) arr.push(p);
      else groups.set(gk, [p]);
    }

    const max = await this.dishRepo.findOne({
      where: { shop_id: user.shopId },
      order: { sort_order: 'DESC' },
    });
    let base = max ? max.sort_order : 0;
    let counter = 0;
    const stamp = Date.now();
    const gen = () => {
      const suffix = counter++;
      return { code: `D${stamp}_${suffix}`, spec_code: `S${stamp}_${suffix}` };
    };

    const toCreate: Dish[] = [];
    const toUpdate: Dish[] = [];

    for (const [, rows] of groups) {
      const existingDish = groupMap.get(rows[0].name + '|' + rows[0].category + '|' + rows[0].type);
      if (existingDish) {
        // 合并新规格到已有菜品（基准价保持该菜品原价不变）
        const current = new Set(specNamesOf(existingDish));
        let specs: Array<{ name: string; price_delta: number }> = [];
        try {
          const parsed = JSON.parse(existingDish.specs || '[]');
          if (Array.isArray(parsed)) specs = parsed;
        } catch {
          specs = [];
        }
        if (current.size === 1 && current.has('标准') && specs.length === 0) {
          specs.push({ name: '标准', price_delta: 0 });
        }
        for (const row of rows) {
          if (current.has(row.spec)) continue;
          specs.push({ name: row.spec, price_delta: row.priceCents - existingDish.price });
          current.add(row.spec);
        }
        existingDish.specs = JSON.stringify(specs);
        toUpdate.push(existingDish);
        continue;
      }

      // 新建菜品：多规格以最小价格行为基准，其余规格记为加价
      const basePriceCents = Math.min(...rows.map((r) => r.priceCents));
      const specSet = new Set(rows.map((r) => r.spec));
      const specs =
        specSet.size > 1
          ? rows.map((r) => ({ name: r.spec, price_delta: r.priceCents - basePriceCents }))
          : [];
      const { code, spec_code } = gen();
      toCreate.push(
        this.dishRepo.create({
          shop_id: user.shopId,
          name: rows[0].name,
          category: rows[0].category,
          price: basePriceCents,
          specs: JSON.stringify(specs),
          code,
          spec_code,
          type: rows[0].type,
          sort_order: ++base,
          status: rows[0].status,
          sold_out: false,
        }),
      );
    }

    if (toCreate.length > 0) await this.dishRepo.save(toCreate);
    if (toUpdate.length > 0) await this.dishRepo.save(toUpdate);

    return {
      total: dto.items.length,
      imported: pending.length,
      skipped: errors.length,
      errors,
    };
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

  /**
   * 去重清理：按「名称 + 分类 + 类型 + 规格」合并重复菜品。
   * 同名同分类同类型：不同规格合并进 id 最小的一条（多规格），完全重复的规格行删除；
   * 被删除记录在套餐分组 / 退菜记录中的引用自动改写为保留记录。
   */
  async dedupe(
    user: AuthUser,
  ): Promise<{
    mergedGroups: number;
    deleted: number;
    conflictPrices: number;
    details: Array<{
      name: string;
      category: string | null;
      type: string;
      keepId: number;
      mergedSpecs: number;
      duplicateRows: number;
      priceConflict: boolean;
    }>;
  }> {
    const dishes = await this.dishRepo.find({ where: { shop_id: user.shopId }, order: { id: 'ASC' } });
    const groups = new Map<string, Dish[]>();
    for (const d of dishes) {
      const key = `${d.name}|${d.category}|${d.type}`;
      const arr = groups.get(key);
      if (arr) arr.push(d);
      else groups.set(key, [d]);
    }

    const parseSpecs = (d: Dish): Array<{ name?: string; price_delta?: number }> => {
      try {
        const arr = JSON.parse(d.specs || '[]');
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    };

    // 规格名 → 绝对价（价格 + 加价），id 最小者优先
    const specAbs = new Map<string, { abs: number; fromId: number }>();
    const mainUpdates = new Map<number, { price: number; specs: string }>();
    const deletedMap = new Map<number, number>(); // 被删 id → 保留 id
    const details: Array<{
      name: string;
      category: string | null;
      type: string;
      keepId: number;
      mergedSpecs: number;
      duplicateRows: number;
      priceConflict: boolean;
    }> = [];
    let groupCount = 0;
    let conflictPrices = 0;

    for (const list of groups.values()) {
      if (list.length < 2) continue;
      specAbs.clear();
      let groupConflict = 0;
      for (const r of list) {
        const specs = parseSpecs(r);
        if (specs.length === 0) {
          const name = '标准';
          if (!specAbs.has(name)) specAbs.set(name, { abs: r.price, fromId: r.id });
          else if (specAbs.get(name)!.abs !== r.price) groupConflict++;
          continue;
        }
        for (const s of specs) {
          const name = String(s.name ?? '').trim() || '标准';
          const abs = r.price + (Number(s.price_delta) || 0);
          if (!specAbs.has(name)) specAbs.set(name, { abs, fromId: r.id });
          else if (specAbs.get(name)!.abs !== abs) groupConflict++;
        }
      }
      conflictPrices += groupConflict;

      const main = list[0];
      const base = Math.min(...[...specAbs.values()].map((v) => v.abs));
      if (specAbs.size <= 1) {
        mainUpdates.set(main.id, { price: specAbs.get('标准')?.abs ?? base, specs: '[]' });
      } else {
        mainUpdates.set(main.id, {
          price: base,
          specs: JSON.stringify(
            [...specAbs.entries()].map(([name, v]) => ({ name, price_delta: v.abs - base })),
          ),
        });
      }
      for (const r of list.slice(1)) deletedMap.set(r.id, main.id);
      details.push({
        name: main.name,
        category: main.category,
        type: main.type,
        keepId: main.id,
        mergedSpecs: specAbs.size,
        duplicateRows: list.length - 1,
        priceConflict: groupConflict > 0,
      });
      groupCount++;
    }

    if (deletedMap.size > 0) {
      // 改写套餐分组中引用（dishes[].id）
      const setmeals = await this.setmealRepo.find({ where: { shop_id: user.shopId } });
      for (const sm of setmeals) {
        let changed = false;
        let parsed: { groups?: Array<{ dishes?: Array<{ id?: number }> }> } | undefined;
        try {
          parsed = JSON.parse(sm.groups || '{}');
        } catch {
          continue;
        }
        const arr = Array.isArray(parsed?.groups) ? parsed.groups : [];
        for (const grp of arr) {
          for (const d of Array.isArray(grp.dishes) ? grp.dishes : []) {
            if (typeof d.id === 'number' && deletedMap.has(d.id)) {
              d.id = deletedMap.get(d.id)!;
              changed = true;
            }
          }
        }
        if (changed) {
          sm.groups = JSON.stringify(parsed);
          await this.setmealRepo.save(sm);
        }
      }

      // 改写退菜记录 dish_id
      const refunds = await this.refundRepo.find({ where: { shop_id: user.shopId } });
      for (const r of refunds) {
        if (deletedMap.has(r.dish_id)) {
          r.dish_id = deletedMap.get(r.dish_id)!;
          await this.refundRepo.save(r);
        }
      }

      // 更新保留记录（合并规格）并删除重复记录
      for (const [id, u] of mainUpdates) {
        const dish = dishes.find((d) => d.id === id);
        if (dish) {
          dish.price = u.price;
          dish.specs = u.specs;
          await this.dishRepo.save(dish);
        }
      }
      for (const id of deletedMap.keys()) {
        await this.dishRepo.delete(id);
      }
    }

    return { mergedGroups: groupCount, deleted: deletedMap.size, conflictPrices, details };
  }
}
