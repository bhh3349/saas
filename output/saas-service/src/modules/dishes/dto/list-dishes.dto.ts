import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { DishStatus } from '../../../common/enums';

export class ListDishesDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(Object.values(DishStatus))
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number = 20;
}
