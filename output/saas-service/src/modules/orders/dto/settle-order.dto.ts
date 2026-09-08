import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SettleOrderDto {
  /** 混合支付行；传入后覆盖单结账方式字段 */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettlePaymentDto)
  payments?: SettlePaymentDto[];

  /** 结账方式 id（本店启用中的方式） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  payment_method_id?: number;

  /** 实收金额（元），缺省 = 应付 - 优惠 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paid_amount?: number;

  /** 优惠金额（元）；缺省 = 应付 - 实收（视为改价） */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount_amount?: number;

  /** 优惠类型：discount 折扣 / voucher 优惠券 / price_change 改价 */
  @IsOptional()
  @IsIn(['discount', 'voucher', 'price_change'])
  discount_type?: 'discount' | 'voucher' | 'price_change';

  /** 优惠名称快照（如券名 / 活动名） */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  discount_name?: string;

  /** 关联优惠券 id */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  voucher_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  remark?: string;
}

export class SettlePaymentDto {
  /** 结账方式 id（本店启用中的方式）；未传 payments 时必填 */
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  payment_method_id?: number;

  /** 该行实际入账金额（元） */
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;
}
