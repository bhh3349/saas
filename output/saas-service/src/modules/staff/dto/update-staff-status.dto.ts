import { IsIn } from 'class-validator';
import { UserStatus } from '../../../common/enums';

export class UpdateStaffStatusDto {
  /** 目标状态 */
  @IsIn([UserStatus.Active, UserStatus.Disabled])
  status: string;
}
