import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from '../common/enums';

/** 平台运营账号 */
@Entity('operator')
export class Operator {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 64, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 128 })
  password_hash: string;

  @Column({ type: 'varchar', length: 16, default: Role.Admin })
  role: string;

  /** 头像（data URL / 图片地址），可为空 */
  @Column({ type: 'text', nullable: true })
  avatar: string | null;

  /** token 版本号：改密 / 改资料后自增，使旧 token 失效 */
  @Column({ type: 'integer', default: 0 })
  token_version: number;

  @CreateDateColumn()
  created_at: Date;
}
