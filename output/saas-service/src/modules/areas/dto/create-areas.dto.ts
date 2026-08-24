import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class CreateAreasDto {
  /** 区域名称数组（支持一次新增多个） */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  names: string[];
}
