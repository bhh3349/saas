import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BusinessException } from '../../common/business.exception';
import { CodeStatus, ShopStatus } from '../../common/enums';
import { ActivationCode } from '../../entities/activation-code.entity';
import { Shop } from '../../entities/shop.entity';
import { ClaimDto } from './dto/claim.dto';

export interface ClaimResult {
  success: boolean;
  shopId: number;
}

/**
 * 内部接口：供 saas-service 注册链路调用（内网签名鉴权）。
 * 校验激活码 → 建店铺主数据 → 激活码置 used + 绑定店铺 → 返回 shopId。
 * 并发安全：事务内以「条件更新」原子抢占激活码，确保一码一店。
 */
@Injectable()
export class InternalService {
  constructor(
    @InjectRepository(ActivationCode)
    private readonly codeRepo: Repository<ActivationCode>,
    @InjectRepository(Shop)
    private readonly shopRepo: Repository<Shop>,
    private readonly dataSource: DataSource,
  ) {}

  async claim(dto: ClaimDto): Promise<ClaimResult> {
    // 激活码为 12 位大小写字母 + 数字，大小写敏感，精确匹配
    const code = dto.code.trim();
    const activationCode = await this.codeRepo.findOne({ where: { code } });
    if (!activationCode) {
      throw new BusinessException('激活码无效');
    }
    if (activationCode.status === CodeStatus.Used) {
      throw new BusinessException('激活码已使用');
    }
    if (activationCode.status === CodeStatus.Void) {
      throw new BusinessException('激活码已作废');
    }
    if (activationCode.expired_at && activationCode.expired_at.getTime() < Date.now()) {
      throw new BusinessException('激活码已过期');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      // 1. 建店铺主数据（记录绑定激活码）
      const shop = await manager.getRepository(Shop).save(
        manager.getRepository(Shop).create({
          name: dto.shop_name,
          address: dto.shop_address || '',
          phone: dto.phone || '',
          activation_code: code,
          status: ShopStatus.Active,
        }),
      );

      // 2. 事务内条件更新原子抢占激活码：仅当仍为 unused 才可绑定，
      //    affected !== 1 说明已被并发请求占用 → 抛异常回滚（店铺也不落库）
      const updated = await manager
        .getRepository(ActivationCode)
        .createQueryBuilder()
        .update(ActivationCode)
        .set({ status: CodeStatus.Used, bound_shop_id: shop.id, bound_at: new Date() })
        .where('code = :code AND status = :status', { code, status: CodeStatus.Unused })
        .execute();
      if (updated.affected !== 1) {
        throw new BusinessException('激活码已被占用');
      }

      return { success: true as const, shopId: shop.id };
    });

    return result;
  }

  /** 店铺状态查询（供 saas-service 登录 pull 校验） */
  async getShopStatus(id: number): Promise<{ shop_id: number; status: string }> {
    const shop = await this.shopRepo.findOne({ where: { id } });
    if (!shop) {
      throw new BusinessException('店铺不存在');
    }
    return { shop_id: shop.id, status: shop.status };
  }
}
