import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TableStatus } from '../../../common/enums';

export class ListTablesDto {
  @IsOptional()
  @IsIn(Object.values(TableStatus))
  status?: string;

  /** 按区域名过滤 */
  @IsOptional()
  @IsString()
  area?: string;

  /** 按桌台名称模糊搜索 */
  @IsOptional()
  @IsString()
  name?: string;

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
