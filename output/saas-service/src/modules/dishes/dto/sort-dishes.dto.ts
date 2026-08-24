import { IsArray, IsNumber } from 'class-validator';

/** 批量保存排序：ids 顺序即排序顺序（sort_order = index + 1） */
export class SortDishesDto {
  @IsArray()
  @IsNumber({}, { each: true })
  ids: number[];
}
