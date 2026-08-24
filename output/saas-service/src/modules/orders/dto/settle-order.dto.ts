import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SettleOrderDto {
  /** 结账方式 id（本店启用中的方式） */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  payment_method_id: number;

  /** 实收金额（元），缺省 = 应付；大于应付自动算找零 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paid_amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  remark?: string;
}
