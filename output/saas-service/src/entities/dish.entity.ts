import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DishStatus } from '../common/enums';

/**
 * 菜品
 * 单价与规格加价均以「分」存储（整数），避免浮点金额误差；
 * API 层出入参统一用「元」。
 */
@Entity('dishes')
export class Dish {
  @PrimaryGeneratedColumn()
  id: number;

  /** 所属店铺（多租户隔离键） */
  @Column({ type: 'integer' })
  shop_id: number;

  /** 菜品名称 */
  @Column({ type: 'varchar', length: 64 })
  name: string;

  /** 分类 */
  @Column({ type: 'varchar', length: 32, default: '默认分类' })
  category: string;

  /** 单价（分） */
  @Column({ type: 'integer' })
  price: number;

  /** 规格 JSON：[{ name: '大份', price_delta: 200 }]，price_delta 单位分 */
  @Column({ type: 'text', default: '[]' })
  specs: string;

  /** 菜品编码 */
  @Column({ type: 'varchar', length: 32, default: '' })
  code: string;

  /** 规格编码 */
  @Column({ type: 'varchar', length: 32, default: '' })
  spec_code: string;

  /** 菜品类型：普通菜 / 称重菜 */
  @Column({ type: 'varchar', length: 16, default: '普通菜' })
  type: string;

  /** 排序值（越小越靠前） */
  @Column({ type: 'integer', default: 0 })
  sort_order: number;

  /** 上下架状态 */
  @Column({ type: 'varchar', length: 16, default: DishStatus.OnSale })
  status: string;

  /** 沽清（售罄置灰），可快速恢复 */
  @Column({ type: 'boolean', default: false })
  sold_out: boolean;

  @CreateDateColumn()
  created_at: Date;
}
