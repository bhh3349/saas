import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 菜品分类（本店维度） */
@Entity('categories')
@Index('idx_categories_shop', ['shop_id'])
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  shop_id: number;

  /** 父分类 id（无则 NULL） */
  @Column({ type: 'integer', nullable: true })
  parent_id: number | null;

  /** 分类名称 */
  @Column({ type: 'varchar', length: 64 })
  name: string;

  /** 分类编码（可用于打印/聚合，可空） */
  @Column({ type: 'varchar', length: 32, default: '' })
  code: string;

  /** 是否在扫码点餐小程序展示 */
  @Column({ type: 'boolean', default: true })
  show_on_mobile: boolean;

  /** 归属：门店 / 品牌 */
  @Column({ type: 'varchar', length: 16, default: '门店' })
  belong: string;

  /** 排序值（越小越靠前） */
  @Column({ type: 'integer', default: 0 })
  sort_order: number;

  @CreateDateColumn()
  created_at: Date;
}
