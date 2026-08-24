import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** 桌台区域：独立于桌台存在，桌台通过 area 名称关联 */
@Entity('areas')
export class Area {
  @PrimaryGeneratedColumn()
  id: number;

  /** 所属店铺（多租户隔离键） */
  @Column({ type: 'integer' })
  shop_id: number;

  /** 区域名称，如「大厅」「外摆」 */
  @Column({ type: 'varchar', length: 32 })
  name: string;

  /** 排序（区域排序用，越小越靠前） */
  @Column({ type: 'integer', default: 0 })
  sort: number;

  @CreateDateColumn()
  created_at: Date;
}
