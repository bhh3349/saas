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

  /** 角色：boss / cashier / finance；boss 在员工档案显示为「老板」。is_primary=true 表示店主，is_primary=false 的 boss 表示店主创建的合伙人账号。 */
  @Column({ type: 'varchar', length: 16, default: UserRole.Cashier })
  role: string;

  /**
   * 是否主管理员（激活码激活的店主账号）：
   * 唯一、默认最高权限，仅由激活码注册时置为 true；
   * 员工档案展示该账号，并渲染店主徽标。
   */
  @Column({ type: 'boolean', default: false })
  is_primary: boolean;

  /** 状态：active / disabled */
  @Column({ type: 'varchar', length: 16, default: UserStatus.Active })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
