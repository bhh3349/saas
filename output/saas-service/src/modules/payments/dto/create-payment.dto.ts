import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePaymentDto {
  /** 结账方式名称，如「现金 / 微信 / 支付宝 / 赊账 / 免单」 */
  @IsString()
  name: string;

  /** 排序（小的在前） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  sort?: number = 0;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;
}
