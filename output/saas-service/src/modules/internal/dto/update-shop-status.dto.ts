import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ShopStatus } from '../../../common/enums';

/** 平台端同步店铺状态（push） */
export class UpdateShopStatusDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  shop_id: number;

  @IsIn(Object.values(ShopStatus))
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;
}
