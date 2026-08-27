import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class RefundOrderItemDto {
  /** 菜品 id */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dish_id: number;

  /** 规格名（区分同菜品不同规格） */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  spec_name?: string;

  /** 退菜数量 */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty: number;

  /** 该行退菜原因 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  reason?: string;
}

export class RefundOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RefundOrderItemDto)
  items: RefundOrderItemDto[];

  /** 整单退菜原因（兜底） */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  reason?: string;
}
