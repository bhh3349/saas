import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../../common/business.exception';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Printer } from '../../entities/printer.entity';
import { CreatePrinterDto, UpdatePrinterDto } from './dto/printer.dto';

export interface PrinterItem {
  id: number;
  name: string;
  type: string;
  address: string;
  port: number;
  brand: string;
  width_mm: number;
  is_default: boolean;
  remark: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class PrintersService {
  constructor(
    @InjectRepository(Printer) private readonly repo: Repository<Printer>,
  ) {}

  /** 列出本店全部打印机（收银端用） */
  async list(user: AuthUser): Promise<PrinterItem[]> {
    const items = await this.repo.find({
      where: { shop_id: user.shopId },
      order: { is_default: 'DESC', id: 'DESC' },
    });
    return items.map((i) => this.toItem(i));
  }

  /** 详情 */
  async findOne(user: AuthUser, id: number): Promise<PrinterItem> {
    const p = await this.repo.findOne({ where: { id, shop_id: user.shopId } });
    if (!p) throw new BusinessException('打印机不存在');
    return this.toItem(p);
  }

  /** 新增 */
  async create(user: AuthUser, dto: CreatePrinterDto): Promise<PrinterItem> {
    if (!['bluetooth', 'wifi'].includes(dto.type)) {
      throw new BusinessException('连接方式无效');
    }
    if (!dto.address) throw new BusinessException('连接地址不能为空');

    // 同一店铺同一 address + type 不能重复
    const dup = await this.repo.findOne({
      where: { shop_id: user.shopId, type: dto.type, address: dto.address },
    });
    if (dup) throw new BusinessException('已存在相同连接的打印机');

    // 如果标记为默认，先取消其他默认
    if (dto.is_default) await this.clearDefault(user);

    const p = this.repo.create({
      shop_id: user.shopId,
      name: dto.name,
      type: dto.type,
      address: dto.address,
      port: dto.port ?? 9100,
      brand: dto.brand ?? '',
      width_mm: dto.width_mm ?? 80,
      is_default: dto.is_default ?? false,
      remark: dto.remark ?? '',
      enabled: dto.enabled ?? true,
    });
    const saved = await this.repo.save(p);
    return this.toItem(saved);
  }

  /** 修改 */
  async update(
    user: AuthUser,
    id: number,
    dto: UpdatePrinterDto,
  ): Promise<PrinterItem> {
    const p = await this.repo.findOne({ where: { id, shop_id: user.shopId } });
    if (!p) throw new BusinessException('打印机不存在');

    // 切换默认
    if (dto.is_default && !p.is_default) {
      await this.clearDefault(user);
    }

    Object.assign(p, dto);
    const saved = await this.repo.save(p);
    return this.toItem(saved);
  }

  /** 删除 */
  async remove(user: AuthUser, id: number): Promise<void> {
    const p = await this.repo.findOne({ where: { id, shop_id: user.shopId } });
    if (!p) throw new BusinessException('打印机不存在');
    await this.repo.delete(p.id);
  }

  /** 切换默认打印机（单选） */
  async setDefault(user: AuthUser, id: number): Promise<void> {
    const p = await this.repo.findOne({ where: { id, shop_id: user.shopId } });
    if (!p) throw new BusinessException('打印机不存在');
    await this.clearDefault(user);
    p.is_default = true;
    await this.repo.save(p);
  }

  /** 取消本店所有默认打印机 */
  private async clearDefault(user: AuthUser): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(Printer)
      .set({ is_default: false })
      .where('shop_id = :shopId AND is_default = true', { shopId: user.shopId })
      .execute();
  }

  private toItem(p: Printer): PrinterItem {
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      address: p.address,
      port: p.port,
      brand: p.brand,
      width_mm: p.width_mm,
      is_default: p.is_default,
      remark: p.remark,
      enabled: p.enabled,
      created_at: p.created_at.toISOString(),
      updated_at: p.updated_at.toISOString(),
    };
  }
}
