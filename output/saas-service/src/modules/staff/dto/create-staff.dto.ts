import { IsIn, IsString, Length, Matches } from 'class-validator';
import { UserRole } from '../../../common/enums';

/** 允许创建的角色：老板 / 收银员 / 财务 */
const ALLOWED_ROLES = [UserRole.Boss, UserRole.Cashier, UserRole.Finance];

export class CreateStaffDto {
  /** 员工手机号（全局唯一） */
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  phone: string;

  /** 登录密码 */
  @IsString()
  @Length(6, 64)
  password: string;

  /** 姓名 */
  @IsString()
  @Length(1, 32)
  name: string;

  /** 角色：老板 / 收银员 / 财务 */
  @IsIn(ALLOWED_ROLES, {
    message: '员工角色仅支持老板 / 收银员 / 财务',
  })
  role: string;
}
