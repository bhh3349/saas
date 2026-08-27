import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

/** 日期范围查询（YYYY-MM-DD，可缺省；缺省 = 今日） */
export class DateRangeDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from 格式须为 YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to 格式须为 YYYY-MM-DD' })
  to?: string;
}

export class ListReportPageDto extends DateRangeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number = 20;

  /** 按菜品名称模糊过滤 */
  @IsOptional()
  @IsString()
  dish_name?: string;

  /** 按桌台区域过滤 */
  @IsOptional()
  @IsString()
  area?: string;

  /** 通用关键字（操作类型 / 优惠类型筛选等） */
  @IsOptional()
  @IsString()
  keyword?: string;
}

export class ListReportOrdersDto extends DateRangeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number = 20;

  /** 订单状态：completed 已结账 / on_account 挂账 */
  @IsOptional()
  @IsString()
  status?: string;

  /** 结账方式名称过滤 */
  @IsOptional()
  @IsString()
  method?: string;

  /** 桌台名称模糊过滤 */
  @IsOptional()
  @IsString()
  table_name?: string;

  /** 订单号 / 备注关键字 */
  @IsOptional()
  @IsString()
  keyword?: string;
}
