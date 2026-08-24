import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 店铺通用配置桶：按 key 存整包 JSON（如 print/stall/voucher/discount/
 * mustdish/role/store_profile/business_settings/staff 等前端配置类数据）。
 * 数据落在 saas.db，所有端共享。
 */
@Entity('shop_buckets')
@Index('idx_shop_buckets_shop_key', ['shop_id', 'key'], { unique: true })
export class ShopBucket {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  shop_id: number;

  /** 配置键名 */
  @Column({ type: 'varchar', length: 64 })
  key: string;

  /** 配置内容（JSON 字符串） */
  @Column({ type: 'text' })
  data: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
