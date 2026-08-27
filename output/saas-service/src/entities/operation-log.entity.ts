import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 敏感操作类型 */
export enum SensitiveAction {
  /** 改价（结账少收） */
  PriceChange = 'price_change',
  /** 退菜 */
  Refund = 'refund',
  /** 作废订单（拒单） */
  VoidOrder = 'void_order',
  /** 免单 */
  FreeOrder = 'free_order',
  /** 优惠券核销 */
  Voucher = 'voucher',
}

/**
 * 敏感操作日志
 * 记录：改价 / 退菜 / 作废订单 / 免单 / 优惠券核销。
 */
@Entity('operation_logs')
export class OperationLog {
  @PrimaryGeneratedColumn()
  id: number;

  /** 所属店铺（多租户隔离键） */
  @Column({ type: 'integer' })
  shop_id: number;

  @Column({ type: 'integer' })
  user_id: number;

  /** 操作人（手机号快照） */
  @Column({ type: 'varchar', length: 32 })
  user_name: string;

  /** 操作类型：price_change / refund / void_order / free_order / voucher */
  @Column({ type: 'varchar', length: 24 })
  action: string;

  /** 目标类型：order / table / dish */
  @Column({ type: 'varchar', length: 16, default: 'order' })
  target_type: string;

  /** 目标 id（如订单 id） */
  @Column({ type: 'integer', nullable: true })
  target_id: number | null;

  /** 涉及金额（分，如优惠 / 退款 / 免单金额） */
  @Column({ type: 'integer', default: 0 })
  amount: number;

  /** 详情描述（如「优惠券核销-满100减10」） */
  @Column({ type: 'varchar', length: 255, default: '' })
  detail: string;

  @CreateDateColumn()
  created_at: Date;
}
