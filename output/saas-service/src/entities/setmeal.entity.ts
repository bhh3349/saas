import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 套餐（含多个分组，groups 存 JSON） */
@Entity('setmeals')
@Index('idx_setmeals_shop', ['shop_id'])
export class Setmeal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  shop_id: number;

  /** 套餐编码 */
  @Column({ type: 'varchar', length: 32, default: '' })
  code: string;

  /** 套餐名称 */
  @Column({ type: 'varchar', length: 64 })
  name: string;

  /** 所属分类 */
  @Column({ type: 'varchar', length: 64, default: '' })
  category: string;

  /** 价格（元） */
  @Column({ type: 'real', default: 0 })
  price: number;

  /** 分组数据（JSON：groups: [{ name, type, min_choose, dishes: [{ id, name, category, price, type, weight }] }]，price 单位元） */
  @Column({ type: 'text' })
  groups: string;

  /** 是否可打印 */
  @Column({ type: 'boolean', default: true })
  print_enable: boolean;

  /** 打印档口 */
  @Column({ type: 'varchar', length: 64, default: '' })
  print_dept: string;

  /** 状态：on / off */
  @Column({ type: 'varchar', length: 8, default: 'on' })
  status: string;

  /** 起售份数（整数，非金额） */
  @Column({ type: 'integer', default: 0 })
  min_amount: number;

  @CreateDateColumn()
  created_at: Date;
}
