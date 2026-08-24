import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 结账方式：注册时自动创建默认方式（现金 / 微信 / 支付宝） */
@Entity('payment_methods')
export class PaymentMethod {
  @PrimaryGeneratedColumn()
  id: number;

  /** 所属店铺（多租户隔离键） */
  @Column({ type: 'integer' })
  shop_id: number;

  /** 名称，如「现金」 */
  @Column({ type: 'varchar', length: 32 })
  name: string;

  /** 排序（小的在前） */
  @Column({ type: 'integer', default: 0 })
  sort: number;

  /** 是否启用 */
  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn()
  created_at: Date;
}
