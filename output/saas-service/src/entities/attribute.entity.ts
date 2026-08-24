import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * 菜品属性（规格 / 做法 / 单位）
 * kind: spec=规格, method=做法, unit=单位
 */
@Entity('attributes')
@Index('idx_attributes_shop_kind', ['shop_id', 'kind'])
export class Attribute {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  shop_id: number;

  /** 属性类型：spec / method / unit */
  @Column({ type: 'varchar', length: 16 })
  kind: string;

  /** 属性名称 */
  @Column({ type: 'varchar', length: 64 })
  name: string;

  /** 是否为系统预置项（如「默认」规格） */
  @Column({ type: 'boolean', default: false })
  preset: boolean;

  /** 排序值（越小越靠前） */
  @Column({ type: 'integer', default: 0 })
  sort_order: number;

  @CreateDateColumn()
  created_at: Date;
}
