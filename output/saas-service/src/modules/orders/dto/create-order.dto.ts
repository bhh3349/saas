import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderMode } from '../../../common/enums';

/** 点餐项：只传菜品 + 规格序号 + 数量（+ 单品备注），金额由服务端计算（防篡改） */
export class OrderItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dish_id: number;

  /** 规格序号（按菜品 specs 数组下标），缺省表示无规格 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  spec_index?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  qty: number;

  /** 单品备注（如「不要香菜」），可选；菜品 + 规格 + 备注 相同才合并数量 */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  remark?: string;
}

export class CreateOrderDto {
  /** 点餐模式：table（桌台）/ ticket（叫号） */
  @IsIn(Object.values(OrderMode))
  mode: string;

  /** 桌台模式必传 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  table_id?: number;

  /** 实际用餐人数（可选，桌台卡片展示） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  guests?: number;

  /** 菜品列表，开台时为空（可选） */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items?: OrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(128)
  remark?: string;
}

/** 追加菜品到已有订单（桌台循环加菜） */
export class AddOrderItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
