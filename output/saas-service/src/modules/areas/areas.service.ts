import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../../common/business.exception';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Area } from '../../entities/area.entity';
import { Table } from '../../entities/table.entity';

export interface AreaItem {
  id: number;
  name: string;
  sort: number;
  /** 该区域下的桌台数量 */
  tableCount: number;
}

@Injectable()
export class AreasService {
  constructor(
    @InjectRepository(Area)
    private readonly areaRepo: Repository<Area>,
    @InjectRepository(Table)
    private readonly tableRepo: Repository<Table>,
  ) {}

  /** 区域列表（含桌台数量，按 sort 升序）；自动同步桌台中出现的区域 */
  async list(user: AuthUser): Promise<AreaItem[]> {
    const tables = await this.tableRepo.find({
      where: { shop_id: user.shopId },
      select: ['area'],
    });
    // 桌台中出现的区域若未建区域记录，自动补建（兼容旧数据 / 直接建桌台带新区域名）
    await this.syncMissingAreas(user, tables.map((t) => t.area));

    const areas = await this.areaRepo.find({
      where: { shop_id: user.shopId },
      order: { sort: 'ASC', id: 'ASC' },
    });
    const countMap = new Map<string, number>();
    for (const t of tables) {
      countMap.set(t.area, (countMap.get(t.area) || 0) + 1);
    }
    return areas.map((a) => ({
      id: a.id,
      name: a.name,
      sort: a.sort,
      tableCount: countMap.get(a.name) || 0,
    }));
  }

  /** 把桌台中出现的区域名补建为区域记录（去重，sort 追加到末尾） */
  private async syncMissingAreas(user: AuthUser, areaNames: string[]): Promise<void> {
    const names = [...new Set(areaNames.map((n) => (n || '').trim()).filter(Boolean))];
    if (names.length === 0) return;
    const existing = await this.areaRepo.find({
      where: { shop_id: user.shopId },
      select: ['name'],
    });
    const existingNames = new Set(existing.map((a) => a.name));
    const missing = names.filter((n) => !existingNames.has(n));
    if (missing.length === 0) return;
    const maxSort =
      (await this.areaRepo.maximum('sort', { shop_id: user.shopId })) || 0;
    let sort = maxSort;
    for (const name of missing) {
      sort += 1;
      await this.areaRepo.save(
        this.areaRepo.create({ shop_id: user.shopId, name, sort }),
      );
    }
  }

  /** 批量新增区域（自动去重，重名忽略） */
  async create(user: AuthUser, names: string[]): Promise<AreaItem[]> {
    const cleaned = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    if (cleaned.length === 0) {
      throw new BusinessException('区域名称不能为空');
    }
    const existing = await this.areaRepo.find({
      where: { shop_id: user.shopId },
      select: ['name'],
    });
    const existingNames = new Set(existing.map((a) => a.name));
    const nextSort =
      (
        await this.areaRepo.maximum('sort', {
          shop_id: user.shopId,
        })
      ) || 0;
    let sort = nextSort;
    for (const name of cleaned) {
      if (existingNames.has(name)) continue;
      sort += 1;
      await this.areaRepo.save(
        this.areaRepo.create({ shop_id: user.shopId, name, sort }),
      );
    }
    return this.list(user);
  }

  /** 排序：按传入顺序更新 sort */
  async sort(user: AuthUser, items: { id: number; sort: number }[]): Promise<AreaItem[]> {
    for (const it of items) {
      const area = await this.findInShop(user, it.id);
      area.sort = it.sort;
      await this.areaRepo.save(area);
    }
    return this.list(user);
  }

  /** 编辑区域名称（同步更新该区域下所有桌台的 area 字段） */
  async update(user: AuthUser, id: number, name: string): Promise<AreaItem[]> {
    const area = await this.findInShop(user, id);
    const newName = name.trim();
    if (!newName) {
      throw new BusinessException('区域名称不能为空');
    }
    if (newName === area.name) return this.list(user);
    const dup = await this.areaRepo.findOne({
      where: { shop_id: user.shopId, name: newName },
    });
    if (dup && dup.id !== id) {
      throw new BusinessException(`区域「${newName}」已存在`);
    }
    const oldName = area.name;
    area.name = newName;
    await this.areaRepo.save(area);
    // 同步该区域下所有桌台
    await this.tableRepo
      .createQueryBuilder()
      .update(Table)
      .set({ area: newName })
      .where('shop_id = :shopId', { shopId: user.shopId })
      .andWhere('area = :oldName', { oldName })
      .execute();
    return this.list(user);
  }

  /** 删除区域（该区域下存在桌台时禁止删除） */
  async remove(user: AuthUser, id: number): Promise<void> {
    const area = await this.findInShop(user, id);
    const count = await this.tableRepo.count({
      where: { shop_id: user.shopId, area: area.name },
    });
    if (count > 0) {
      throw new BusinessException(`「${area.name}」下还有 ${count} 个桌台，请先移走或删除桌台`);
    }
    await this.areaRepo.remove(area);
  }

  private async findInShop(user: AuthUser, id: number): Promise<Area> {
    const area = await this.areaRepo.findOne({ where: { id } });
    if (!area || area.shop_id !== user.shopId) {
      throw new BusinessException('区域不存在');
    }
    return area;
  }
}
