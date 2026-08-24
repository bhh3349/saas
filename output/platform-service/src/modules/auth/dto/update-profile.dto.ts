import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

/** 修改个人资料：用户名 / 头像 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 64)
  username?: string;

  /** 头像，传 data URL 或图片地址；传空字符串表示清除 */
  @IsOptional()
  @IsString()
  @MaxLength(512 * 1024)
  avatar?: string;
}
