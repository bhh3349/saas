import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../../common/business.exception';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { TableStatus } from '../../common/enums';
import { Table } from '../../entities/table.entity';
import { CreateTableDto } from './dto/create-table.dto';
import { ListTablesDto } from './dto/list-tables.dto';
import { UpdateTableDto } from './dto/update-table.dto';

export interface TableItem {
  id: number;
  name: string;
  area: string;
  capacity: number;
  status: string;
  created_at: Date;
}

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table)
    private readonly tableRepo: Repository<Table>,
  ) {}

  async create(user: AuthUser, dto: CreateTableDto): Promise<TableItem> {
    const table = await this.tableRepo.save(
      this.tableRepo.create({
        shop_id: user.shopId,
        name: dto.name,
        area: dto.area || '默认区',
        capacity: dto.capacity ?? 4,
        status: TableStatus.Idle,
      }),
    );
    return this.toItem(table);
  }

  /** 后台管理列表（本店，分页 + 区域/名称筛选） */
  async list(
    user: AuthUser,
    page: number,
    pageSize: number,
    status?: string,
    area?: string,
    name?: string,
  ): Promise<{ total: number; items: TableItem[] }> {
    const qb = this.tableRepo.createQueryBuilder('t');
    qb.where('t.shop_id = :shopId', { shopId: user.shopId });
    if (status) qb.andWhere('t.status = :status', { status });
    if (area) qb.andWhere('t.area = :area', { area });
    if (name) qb.andWhere('t.name LIKE :name', { name: `%${name}%` });
    qb.orderBy('t.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { total, items: items.map((i) => this.toItem(i)) };
  }

  /** 导出桌台：本店全部（可按区域过滤，不分页） */
  async exportList(user: AuthUser, area?: string): Promise<TableItem[]> {
    const qb = this.tableRepo.createQueryBuilder('t');
    qb.where('t.shop_id = :shopId', { shopId: user.shopId });
    if (area) qb.andWhere('t.area = :area', { area });
    qb.orderBy('t.id', 'ASC');
    const items = await qb.getMany();
    return items.map((i) => this.toItem(i));
  }

  /** 批量导入桌台：一次性创建多个桌台，返回导入条数 */
  async importTables(user: AuthUser, items: CreateTableDto[]): Promise<{ count: number }> {
    if (!items || items.length === 0) {
      throw new BusinessException('导入数据为空');
    }
    const rows = items.map((dto) =>
      this.tableRepo.create({
        shop_id: user.shopId,
        name: dto.name,
        area: dto.area || '默认区',
        capacity: dto.capacity ?? 4,
        status: TableStatus.Idle,
      }),
    );
    const saved = await this.tableRepo.save(rows);
    return { count: saved.length };
  }

  /** 收银工作台桌台列表（本店全部，含状态） */
  async all(user: AuthUser): Promise<TableItem[]> {
    const items = await this.tableRepo.find({
      where: { shop_id: user.shopId },
      order: { id: 'ASC' },
    });
    return items.map((i) => this.toItem(i));
  }

  async update(user: AuthUser, id: number, dto: UpdateTableDto): Promise<TableItem> {
    const table = await this.findInShop(user, id);
    if (dto.name !== undefined) table.name = dto.name;
    if (dto.area !== undefined) table.area = dto.area;
    if (dto.capacity !== undefined) table.capacity = dto.capacity;
    await this.tableRepo.save(table);
    return this.toItem(table);
  }

  /** 删除桌台：仅空闲桌台可删 */
  async remove(user: AuthUser, id: number): Promise<void> {
    const table = await this.findInShop(user, id);
    if (table.status !== TableStatus.Idle) {
      throw new BusinessException('桌台占用中，不可删除');
    }
    await this.tableRepo.remove(table);
  }

  private async findInShop(user: AuthUser, id: number): Promise<Table> {
    const table = await this.tableRepo.findOne({ where: { id } });
    if (!table || table.shop_id !== user.shopId) {
      throw new BusinessException('桌台不存在');
    }
    return table;
  }

  private toItem(t: Table): TableItem {
    return {
      id: t.id,
      name: t.name,
      area: t.area,
      capacity: t.capacity,
      status: t.status,
      created_at: t.created_at,
    };
  }
}
