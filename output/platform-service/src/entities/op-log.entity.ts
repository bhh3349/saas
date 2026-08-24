import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** 敏感操作日志（作废激活码 / 店铺停用启用等） */
@Entity('op_log')
export class OpLog {
  @PrimaryGeneratedColumn()
  id: number;

  /** 操作者（运营账号） */
  @Column({ type: 'integer' })
  operator_id: number;

  /** 操作类型：code_void / shop_status_update */
  @Column({ type: 'varchar', length: 32 })
  action: string;

  /** 操作对象标识：如激活码、店铺 id */
  @Column({ type: 'varchar', length: 64 })
  target: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  detail: string;

  /** 操作者 IP */
  @Column({ type: 'varchar', length: 64, default: '' })
  ip: string;

  /** 操作者 User-Agent */
  @Column({ type: 'varchar', length: 255, default: '' })
  user_agent: string;

  @CreateDateColumn()
  created_at: Date;
}
