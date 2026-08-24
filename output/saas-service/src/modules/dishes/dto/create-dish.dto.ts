import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/** 规格：如「大份 / 加 2 元」 */
export class DishSpecDto {
  @IsString()
  name: string;

  /** 加价（元），可为负（如小份减价），默认 0；下限 -100 元 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  price_delta?: number = 0;
}

export class CreateDishDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  /** 单价（元），内部以分存储 */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DishSpecDto)
  specs?: DishSpecDto[];

  /** 菜品编码 */
  @IsOptional()
  @IsString()
  code?: string;

  /** 规格编码 */
  @IsOptional()
  @IsString()
  spec_code?: string;

  /** 菜品类型：普通菜 / 称重菜 */
  @IsOptional()
  @IsString()
  type?: string;

  /** 排序值 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sort_order?: number;
}

/** 批量导入（items 最多 2000 条，避免一次请求过大） */
export class ImportDishesDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => CreateDishDto)
  items: CreateDishDto[];
}
