import { IsString, Length } from 'class-validator';

export class LoginDto {
  /** 登录手机号 */
  @IsString()
  @Length(1, 32)
  phone: string;

  /** 登录密码 */
  @IsString()
  @Length(1, 64)
  password: string;
}
