import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OrderStatus } from '../../../common/enums';

export class ListOrdersDto {
  /** 按状态筛选 */
  @IsOptional()
  @IsIn(Object.values(OrderStatus))
  status?: string;

  /** 起始日期（含，YYYY-MM-DD），用于今日/日期范围筛选 */
  @IsOptional()
  @IsDateString()
  start_date?: string;

  /** 结束日期（含，YYYY-MM-DD） */
  @IsOptional()
  @IsDateString()
  end_date?: string;

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
