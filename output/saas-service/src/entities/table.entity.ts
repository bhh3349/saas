import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TableStatus } from '../common/enums';

/** 桌台：注册时自动创建默认桌台 */
@Entity('tables')
export class Table {
  @PrimaryGeneratedColumn()
  id: number;

  /** 所属店铺（多租户隔离键） */
  @Column({ type: 'integer' })
  shop_id: number;

  /** 桌台名称，如「1号桌」 */
  @Column({ type: 'varchar', length: 32 })
  name: string;

  /** 区域 / 分区 */
  @Column({ type: 'varchar', length: 32, default: '默认区' })
  area: string;

  /** 座位数 */
  @Column({ type: 'integer', default: 4 })
  capacity: number;

  /** 状态：idle / occupied */
  @Column({ type: 'varchar', length: 16, default: TableStatus.Idle })
  status: string;

  @CreateDateColumn()
  created_at: Date;
}
