import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { MaxLength } from 'class-validator';

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

  @IsString()
  category?: string;

  /** 单价（元） */
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

  @IsOptional()
  @IsString()
  @MaxLength(16)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  serve_mode?: string;

  @IsOptional()
  @IsBoolean()
  print_enable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  print_dept?: string;

  @IsOptional()
  @IsBoolean()
  temp_price_change?: boolean;

  @IsOptional()
  @IsBoolean()
  manual_discount?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  delta_amount?: number;

  @IsOptional()
  @IsBoolean()
  fractional?: boolean;

  /** 排序值 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sort_order?: number;
}

/** 批量导入单行（一个规格一行；名称 + 分类 + 类型 + 规格 组合唯一） */
export class ImportSpecRowDto {
  /** 菜品名称 */
  @IsString()
  name: string;

  /** 菜品分类 */
  @IsOptional()
  @IsString()
  category?: string;

  /** 菜品类型：普通菜 / 称重菜 */
  @IsOptional()
  @IsString()
  type?: string;

  /** 单价（元） */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  /** 菜品规格（同一菜品多规格时填写多行，规格不同） */
  @IsOptional()
  @IsString()
  spec?: string;

  /** 状态：在售 / 停售 */
  @IsOptional()
  @IsString()
  status?: string;
}

/** 批量导入（items 最多 2000 条，避免一次请求过大） */
export class ImportDishesDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => ImportSpecRowDto)
  items: ImportSpecRowDto[];
}
