import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** 订单支付行：一次结账可叠加多笔支付方式；金额单位为元。 */
@Entity('order_payments')
@Index('idx_order_payments_order_id', ['order_id'])
@Index('idx_order_payments_method_created', ['payment_method_id', 'created_at'])
export class OrderPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  order_id: number;

  @Column({ type: 'integer' })
  payment_method_id: number;

  @Column({ type: 'varchar', length: 32 })
  payment_method_name: string;

  /** 该支付方式实际入账金额（元），找零不单独拆行 */
  @Column({ type: 'real' })
  amount: number;

  @CreateDateColumn()
  created_at: Date;
}
