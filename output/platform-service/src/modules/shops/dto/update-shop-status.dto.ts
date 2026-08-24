import { IsIn } from 'class-validator';
import { ShopStatus } from '../../../common/enums';

export class UpdateShopStatusDto {
  @IsIn(Object.values(ShopStatus))
  status: string;
}
