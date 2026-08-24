import { IsString, Length, Matches } from 'class-validator';

/** 修改密码 */
export class ChangePasswordDto {
  @IsString()
  @Length(1, 64)
  old_password: string;

  /** 新密码：8-64 位，需同时包含字母与数字 */
  @IsString()
  @Length(8, 64)
  @Matches(/[A-Za-z]/, { message: '新密码需包含字母' })
  @Matches(/[0-9]/, { message: '新密码需包含数字' })
  new_password: string;
}
