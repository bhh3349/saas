import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderMode, OrderStatus } from '../common/enums';

/**
 * 订单（收银记账单）
 * 金额均以「分」存储（整数），API 层出入参统一用「元」。
 * items 为 JSON 快照：[{ dish_id, name, spec_name, unit_price, qty, amount }]
 */
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  /** 所属店铺（多租户隔离键） */
  @Column({ type: 'integer' })
  shop_id: number;

  /** 订单号：YYYYMMDD-序号（当日自增） */
  @Column({ type: 'varchar', length: 32 })
  order_no: string;

  /** 点餐模式：table / ticket */
  @Column({ type: 'varchar', length: 16, default: OrderMode.Table })
  mode: string;

  /** 桌台模式：关联桌台 */
  @Column({ type: 'integer', nullable: true })
  table_id: number | null;

  /** 叫号模式：当日取餐号 */
  @Column({ type: 'integer', nullable: true })
  ticket_no: number | null;

  /** 订单状态：pending / confirmed / completed / on_account / void */
  @Column({ type: 'varchar', length: 16, default: OrderStatus.Pending })
  status: string;

  /** 菜品快照 JSON */
  @Column({ type: 'text' })
  items: string;

  /** 应付金额（分） */
  @Column({ type: 'integer' })
  total_amount: number;

  /** 实收金额（分），结账时记录 */
  @Column({ type: 'integer', default: 0 })
  paid_amount: number;

  /** 找零（分） */
  @Column({ type: 'integer', default: 0 })
  change_amount: number;

  /** 优惠金额（分）：折扣 / 优惠券 / 改价 / 免单 */
  @Column({ type: 'integer', default: 0 })
  discount_amount: number;

  /** 优惠类型：discount 折扣 / voucher 优惠券 / price_change 改价 / free 免单 */
  @Column({ type: 'varchar', length: 16, nullable: true })
  discount_type: string | null;

  /** 优惠名称快照（如券名 / 满减活动名） */
  @Column({ type: 'varchar', length: 64, nullable: true })
  discount_name: string | null;

  /** 关联优惠券 id（shop_buckets.voucher 中的 id） */
  @Column({ type: 'integer', nullable: true })
  voucher_id: number | null;

  /** 结账方式 id */
  @Column({ type: 'integer', nullable: true })
  payment_method_id: number | null;

  /** 结账方式名快照（免单记为「免单」） */
  @Column({ type: 'varchar', length: 32, nullable: true })
  payment_method_name: string | null;

  /** 备注 */
  @Column({ type: 'varchar', length: 128, default: '' })
  remark: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  /** 结账 / 免单时间（看账统计口径） */
  @Column({ type: 'datetime', nullable: true })
  settled_at: Date | null;
}
