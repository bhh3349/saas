import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateTableDto {
  /** 桌台名称，如「1号桌」 */
  @IsString()
  name: string;

  /** 区域 / 分区 */
  @IsOptional()
  @IsString()
  area?: string;

  /** 座位数 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  capacity?: number = 4;
}
