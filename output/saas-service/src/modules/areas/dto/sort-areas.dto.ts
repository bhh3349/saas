import { ArrayNotEmpty, IsArray, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SortAreaItem {
  @Type(() => Number)
  @IsInt()
  id: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort: number;
}

export class SortAreasDto {
  @IsArray()
  @ArrayNotEmpty()
  items: SortAreaItem[];
}
