import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DishSpecDto } from './create-dish.dto';

export class UpdateDishDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  /** 单价（元） */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DishSpecDto)
  specs?: DishSpecDto[];

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  spec_code?: string;

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

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sort_order?: number;
}
