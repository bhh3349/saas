import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { CodeStatus } from '../common/enums';

/** 激活码 */
@Entity('activation_code')
export class ActivationCode {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  code: string;

  @Column({ type: 'varchar', length: 64 })
  batch_no: string;

  @Column({ type: 'varchar', length: 16, default: CodeStatus.Unused })
  status: string;

  @Column({ type: 'int', nullable: true })
  bound_shop_id: number | null;

  @Column({ type: 'datetime', nullable: true })
  bound_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'datetime', nullable: true })
  expired_at: Date | null;
}
