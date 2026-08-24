import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole, UserStatus } from '../common/enums';

/** 商家端账号：老板 / 收银员 / 财务 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  /** 所属店铺（多租户隔离键） */
  @Column({ type: 'integer' })
  shop_id: number;

  /** 登录手机号（全局唯一） */
  @Column({ type: 'varchar', length: 32, unique: true })
  phone: string;

  /** 密码哈希（bcrypt） */
  @Column({ type: 'varchar', length: 128 })
  password_hash: string;

  /** 姓名 / 昵称 */
  @Column({ type: 'varchar', length: 32 })
  name: string;

  /** 角色：boss / cashier / finance */
  @Column({ type: 'varchar', length: 16, default: UserRole.Cashier })
  role: string;

  /** 状态：active / disabled */
  @Column({ type: 'varchar', length: 16, default: UserStatus.Active })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
