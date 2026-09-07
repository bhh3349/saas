import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * 退菜记录（订单内菜品退款）
 * 金额以「元」存储，全链路统一用「元」。
 * 一次退菜动作可写多行（每行 = 一个菜品 + 规格）。
 */
@Entity('order_refunds')
@Index('idx_order_refunds_shop_refunded', ['shop_id', 'refunded_at'])
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

  /** 退菜时单价（元） */
  @Column({ type: 'real' })
  unit_price: number;

  /** 退菜数量 */
  @Column({ type: 'integer' })
  qty: number;

  /** 退菜金额（元） */
  @Column({ type: 'real' })
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
