import { IsString, Length } from 'class-validator';

export class ForgotPasswordDto {
  /** 手机号 */
  @IsString()
  @Length(1, 32)
  phone: string;
}
