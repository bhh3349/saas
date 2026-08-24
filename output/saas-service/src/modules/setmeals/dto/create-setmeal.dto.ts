import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SetmealGroupDishDto {
  @IsNumber()
  id: number;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  /** 价格（分） */
  @IsNumber()
  price: number;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsNumber()
  weight?: number;
}

export class SetmealGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  /** 组类型：固定 / 可选 / 2选1 等 */
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  @IsInt()
  min_choose?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SetmealGroupDishDto)
  dishes: SetmealGroupDishDto[];
}

export class CreateSetmealDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  /** 价格（分） */
  @IsInt()
  price: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SetmealGroupDto)
  groups: SetmealGroupDto[];

  @IsOptional()
  @IsBoolean()
  print_enable?: boolean;

  @IsOptional()
  @IsString()
  print_dept?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  min_amount?: number;
}
