import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { CreateTableDto } from './create-table.dto';

/** 批量导入桌台：items 为桌台数据数组 */
export class ImportTablesDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => CreateTableDto)
  items: CreateTableDto[];
}
