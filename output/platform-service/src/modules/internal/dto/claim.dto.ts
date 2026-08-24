import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class ClaimDto {
  /** 激活码：12 位大小写字母 + 数字，大小写敏感精确匹配 */
  @IsString()
  @Matches(/^[A-Za-z0-9]{12}$/, { message: '激活码格式不正确' })
  code: string;

  /** 店铺名称 */
  @IsString()
  @Length(1, 128)
  shop_name: string;

  /** 店铺地址（可选） */
  @IsOptional()
  @IsString()
  @Length(0, 255)
  shop_address?: string;

  /** 注册手机号（可选） */
  @IsOptional()
  @IsString()
  @Length(0, 32)
  phone?: string;
}
