import { IsOptional } from 'class-validator';

export class PutBucketDto {
  /** 任意 JSON 配置内容 */
  @IsOptional()
  data: unknown;
}
