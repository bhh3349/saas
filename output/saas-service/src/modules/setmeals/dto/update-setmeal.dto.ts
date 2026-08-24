import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SetmealGroupDto } from './create-setmeal.dto';

export class UpdateSetmealDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  /** 价格（分） */
  @IsOptional()
  @IsInt()
  price?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SetmealGroupDto)
  groups?: SetmealGroupDto[];

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
