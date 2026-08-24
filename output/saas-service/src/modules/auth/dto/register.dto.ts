import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  /** 激活码：12 位大小写字母 + 数字，无分隔符（与平台端生成格式一致） */
  @IsString()
  @Matches(/^[A-Za-z0-9]{12}$/, { message: '激活码格式不正确' })
  code: string;

  /** 登录手机号 */
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  phone: string;

  /** 登录密码 */
  @IsString()
  @Length(6, 64)
  password: string;

  /** 店铺名称 */
  @IsString()
  @Length(1, 128)
  shop_name: string;

  /** 店铺地址（可选） */
  @IsOptional()
  @IsString()
  @Length(0, 255)
  shop_address?: string;

  /** 老板姓名（可选） */
  @IsOptional()
  @IsString()
  @Length(0, 32)
  name?: string;
}
