import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { DishStatus } from '../../../common/enums';

/** 上 / 下架 + 沽清 / 恢复 */
export class UpdateDishStatusDto {
  @IsOptional()
  @IsIn(Object.values(DishStatus))
  status?: string;

  @IsOptional()
  @IsBoolean()
  sold_out?: boolean;
}
