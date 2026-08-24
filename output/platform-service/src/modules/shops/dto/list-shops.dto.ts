import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ShopStatus } from '../../../common/enums';

export class ListShopsDto {
  /** 店铺名 / 地址 / 手机号模糊搜索 */
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(Object.values(ShopStatus))
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
