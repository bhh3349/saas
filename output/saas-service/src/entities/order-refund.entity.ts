import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * 退菜记录（订单内菜品退款）
 * 金额以「分」存储，API 层用「元」。
 * 一次退菜动作可写多行（每行 = 一个菜品 + 规格）。
 */
@Entity('order_refunds')
export class OrderRefund {
  @PrimaryGeneratedColumn()
  id: number;

  /** 所属店铺（多租户隔离键） */
  @Column({ type: 'integer' })
  shop_id: number;

  @Column({ type: 'integer' })
  order_id: number;

  /** 订单号快照（冗余便于查询） */
  @Column({ type: 'varchar', length: 32 })
  order_no: string;

  @Column({ type: 'integer' })
  dish_id: number;

  /** 菜品名快照 */
  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  spec_name: string | null;

  /** 退菜时单价（分） */
  @Column({ type: 'integer' })
  unit_price: number;

  /** 退菜数量 */
  @Column({ type: 'integer' })
  qty: number;

  /** 退菜金额（分） */
  @Column({ type: 'integer' })
  amount: number;

  /** 退菜原因 */
  @Column({ type: 'varchar', length: 128, default: '' })
  reason: string;

  /** 操作人 id */
  @Column({ type: 'integer' })
  operator_id: number;

  /** 操作人（手机号快照） */
  @Column({ type: 'varchar', length: 32 })
  operator_name: string;

  @CreateDateColumn()
  refunded_at: Date;
}
