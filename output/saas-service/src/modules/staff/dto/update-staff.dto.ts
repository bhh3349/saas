import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { UserRole } from '../../../common/enums';

const ALLOWED_ROLES = [UserRole.Boss, UserRole.Cashier, UserRole.Finance];

export class UpdateStaffDto {
  /** 姓名 */
  @IsOptional()
  @IsString()
  @Length(1, 32)
  name?: string;

  /** 角色（老板 / 收银员 / 财务） */
  @IsOptional()
  @IsIn(ALLOWED_ROLES, { message: '员工角色仅支持老板 / 收银员 / 财务' })
  role?: string;
}

export class ResetPasswordDto {
  /** 新密码（可选，不传则重置为系统默认值） */
  @IsOptional()
  @IsString()
  @Length(6, 64)
  new_password?: string;
}
