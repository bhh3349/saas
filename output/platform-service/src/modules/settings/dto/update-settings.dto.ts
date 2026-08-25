import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  system_name?: string;

  /** logo data URL；传空字符串 / null 表示清除，恢复默认图标 */
  @IsOptional()
  @IsString()
  @MaxLength(2 * 1024 * 1024)
  logo?: string | null;

  /** favicon data URL；传空字符串 / null 表示清除，恢复默认 favicon.svg */
  @IsOptional()
  @IsString()
  @MaxLength(2 * 1024 * 1024)
  favicon?: string | null;
}
