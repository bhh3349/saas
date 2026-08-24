import { IsIn, IsString, Length, Matches } from 'class-validator';
import { UserRole } from '../../../common/enums';

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

  /** 角色：仅允许收银员 / 财务 */
  @IsIn([UserRole.Cashier, UserRole.Finance], {
    message: '员工角色仅支持收银员 / 财务',
  })
  role: string;
}
