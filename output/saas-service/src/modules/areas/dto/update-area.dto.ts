import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateAreaDto {
  /** 新的区域名称 */
  @IsString()
  @IsNotEmpty({ message: '区域名称不能为空' })
  @MaxLength(20, { message: '区域名称不能超过 20 个字符' })
  name: string;
}
