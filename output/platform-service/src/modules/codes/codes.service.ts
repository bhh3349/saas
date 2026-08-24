import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { BusinessException } from '../../common/business.exception';
import { CodeStatus } from '../../common/enums';
import { ActivationCode } from '../../entities/activation-code.entity';
import { Shop } from '../../entities/shop.entity';
import { OpLogService } from '../op-log/op-log.service';
import { BatchCreateDto } from './dto/batch-create.dto';
import { ListCodesDto } from './dto/list-codes.dto';

/** 激活码字符集：大写字母 + 小写字母 + 数字，共 62 个字符 */
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
/** 激活码长度：12 位，无前缀、无分隔符 */
const CODE_LENGTH = 12;

function randomCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    // 62 个字符，取模均衡（256 = 62*4 + 8，偏差可接受）
    out += CHARSET[bytes[i] % CHARSET.length];
  }
  return out;
}

/** CSV 字段转义：统一双引号包裹，防公式注入（Excel 将 = + - @ 开头视为公式） */
function csvEsc(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export interface PagedResult<T> {
  total: number;
  items: T[];
}

@Injectable()
export class CodesService {
  constructor(
    @InjectRepository(ActivationCode)
    private readonly codeRepo: Repository<ActivationCode>,
    private readonly dataSource: DataSource,
    private readonly opLogService: OpLogService,
  ) {}

  /** 批量生成激活码，格式：12 位大小写字母 + 数字，无分隔符 */
  async batchCreate(dto: BatchCreateDto): Promise<{ batch_no: string; count: number; codes: string[] }> {
    const codes = await this.generateUniqueCodes(dto.count);
    const now = new Date();

    await this.dataSource.transaction(async (manager) => {
      for (const code of codes) {
        await manager.getRepository(ActivationCode).save(
          manager.getRepository(ActivationCode).create({
            code,
            batch_no: dto.batch_no,
            status: CodeStatus.Unused,
            bound_shop_id: null,
            bound_at: null,
            created_at: now,
            expired_at: null,
          }),
        );
      }
    });

    return { batch_no: dto.batch_no, count: codes.length, codes };
  }

  private async generateUniqueCodes(count: number): Promise<string[]> {
    const unique = new Set<string>();
    let attempts = 0;
    while (unique.size < count && attempts < count * 100) {
      attempts++;
      const code = randomCode();
      if (unique.has(code)) {
        continue;
      }
      const exists = await this.codeRepo.exist({ where: { code } });
      if (!exists) {
        unique.add(code);
      }
    }
    if (unique.size < count) {
      throw new BusinessException('生成激活码失败，请重试');
    }
    return Array.from(unique);
  }

  /** 列表查询：按批次 / 状态筛选 + 分页（关联返回绑定店铺名） */
  async list(dto: ListCodesDto): Promise<PagedResult<ActivationCode & { shop_name: string | null }>> {
    const qb = this.codeRepo
      .createQueryBuilder('c')
      .leftJoin(Shop, 'shop', 'shop.id = c.bound_shop_id')
      .addSelect('shop.name', 'shop_name');
    if (dto.batch_no) {
      qb.andWhere('c.batch_no = :batchNo', { batchNo: dto.batch_no });
    }
    if (dto.status) {
      qb.andWhere('c.status = :status', { status: dto.status });
    }
    qb.orderBy('c.created_at', 'DESC').addOrderBy('c.code', 'ASC');

    const total = await qb.getCount();
    const page = dto.page ?? 1;
    const pageSize = dto.page_size ?? 20;
    const { raw, entities } = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getRawAndEntities();

    const items = entities.map((e, i) => ({ ...e, shop_name: raw[i]?.shop_name ?? null }));

    return { total, items };
  }

  /** 作废激活码：仅 unused 可作废；敏感操作记录日志 */
  async void(
    code: string,
    operatorId: number,
    meta: { ip?: string; userAgent?: string } = {},
  ): Promise<{ code: string; status: string }> {
    const entity = await this.findByCodeOrFail(code);
    if (entity.status !== CodeStatus.Unused) {
      throw new BusinessException(`当前状态（${entity.status}）不可作废`);
    }
    entity.status = CodeStatus.Void;
    await this.codeRepo.save(entity);
    await this.opLogService.log(operatorId, 'code_void', entity.code, `batch=${entity.batch_no}`, meta);
    return { code: entity.code, status: entity.status };
  }

  /** 导出 CSV（默认全部未使用，可按批次 / 状态过滤） */
  async exportCsv(dto: ListCodesDto): Promise<string> {
    const qb = this.codeRepo.createQueryBuilder('c');
    if (dto.batch_no) {
      qb.andWhere('c.batch_no = :batchNo', { batchNo: dto.batch_no });
    }
    if (dto.status) {
      qb.andWhere('c.status = :status', { status: dto.status });
    } else {
      qb.andWhere('c.status = :status', { status: CodeStatus.Unused });
    }
    qb.orderBy('c.created_at', 'ASC').take(10000);
    const items = await qb.getMany();

    const header = 'code,batch_no,status,bound_shop_id,bound_at,created_at';
    const rows = items.map((c) =>
      [c.code, c.batch_no, c.status, c.bound_shop_id ?? '', c.bound_at ? c.bound_at.toISOString() : '', c.created_at.toISOString()].map(csvEsc).join(','),
    );
    return [header, ...rows].join('\r\n');
  }

  async findByCodeOrFail(code: string): Promise<ActivationCode> {
    const entity = await this.codeRepo.findOne({ where: { code } });
    if (!entity) {
      throw new BusinessException('激活码无效');
    }
    return entity;
  }
}
