import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class BatchCreateDto {
  /** 生成数量 1 - 1000 */
  @IsInt()
  @Min(1)
  @Max(1000)
  count: number;

  /** 批次号，用于按批次筛选 */
  @IsString()
  @Length(1, 64)
  batch_no: string;
}
