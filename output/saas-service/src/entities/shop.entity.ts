import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { ShopStatus } from '../common/enums';

/**
 * 店铺状态本地快照。
 * 权威数据在 platform-service（platform.db）；此处仅为「停用后业务接口立即不可用」的本地拦截。
 * 由平台端 push / saas 登录时 pull 同步。
 */
@Entity('shop')
export class Shop {
  /** 平台端 shopId（与平台端店铺主数据一致） */
  @PrimaryColumn({ type: 'integer' })
  shop_id: number;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 16, default: ShopStatus.Active })
  status: string;

  @CreateDateColumn()
  created_at: Date;
}
