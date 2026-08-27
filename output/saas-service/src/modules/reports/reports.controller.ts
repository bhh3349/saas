import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  DateRangeDto,
  ListReportOrdersDto,
  ListReportPageDto,
} from './dto/date-range.dto';
import { ReportsService } from './reports.service';

/** 看账（老板 / 财务；财务天然只读——均为 GET） */
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Boss, UserRole.Finance)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /** 今日概览 */
  @Get('today')
  today(@CurrentUser() user: AuthUser) {
    return this.reportsService.today(user);
  }

  /** 日期范围营业汇总 */
  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query() query: DateRangeDto) {
    return this.reportsService.summary(user, query.from, query.to);
  }

  /** 按日营业统计（区间内每天一条） */
  @Get('daily')
  daily(@CurrentUser() user: AuthUser, @Query() query: DateRangeDto) {
    return this.reportsService.daily(user, query.from, query.to);
  }

  /** 菜品销售统计（按菜品聚合） */
  @Get('dish-sales')
  dishSales(@CurrentUser() user: AuthUser, @Query() query: ListReportPageDto) {
    return this.reportsService.dishSales(
      user,
      query.from,
      query.to,
      query.page || 1,
      query.page_size || 20,
      query.dish_name,
    );
  }

  /** 菜品销售明细（订单 × 品项展开） */
  @Get('dish-detail')
  dishDetail(@CurrentUser() user: AuthUser, @Query() query: ListReportPageDto) {
    return this.reportsService.dishDetail(
      user,
      query.from,
      query.to,
      query.page || 1,
      query.page_size || 20,
    );
  }

  /** 餐区 / 桌台营业统计 */
  @Get('table-stats')
  tableStats(@CurrentUser() user: AuthUser, @Query() query: ListReportPageDto) {
    return this.reportsService.tableStats(
      user,
      query.from,
      query.to,
      query.page || 1,
      query.page_size || 20,
      query.area,
    );
  }

  /** 营业指标同环比 */
  @Get('compare')
  compare(@CurrentUser() user: AuthUser, @Query() query: DateRangeDto) {
    return this.reportsService.compare(user, query.from, query.to);
  }

  /** 促销活动统计（按活动名聚合优惠券/折扣） */
  @Get('promo-stats')
  promoStats(@CurrentUser() user: AuthUser, @Query() query: DateRangeDto) {
    return this.reportsService.promoStats(user, query.from, query.to);
  }

  /** 日期范围订单明细（已结账 + 挂账） */
  @Get('orders')
  orderList(@CurrentUser() user: AuthUser, @Query() query: ListReportOrdersDto) {
    return this.reportsService.orderList(
      user,
      query.from,
      query.to,
      query.page || 1,
      query.page_size || 20,
      query.status,
      query.method,
      query.table_name,
      query.keyword,
    );
  }

  /** 菜品优惠统计（按优惠类型聚合） */
  @Get('dish-discount')
  dishDiscountStats(@CurrentUser() user: AuthUser, @Query() query: DateRangeDto) {
    return this.reportsService.dishDiscountStats(user, query.from, query.to);
  }

  /** 菜品退菜统计（按菜品聚合） */
  @Get('dish-refund')
  dishRefundStats(@CurrentUser() user: AuthUser, @Query() query: ListReportPageDto) {
    return this.reportsService.dishRefundStats(
      user,
      query.from,
      query.to,
      query.page || 1,
      query.page_size || 20,
    );
  }

  /** 敏感操作统计（按操作类型聚合） */
  @Get('sensitive-stats')
  sensitiveStats(@CurrentUser() user: AuthUser, @Query() query: DateRangeDto) {
    return this.reportsService.sensitiveStats(user, query.from, query.to);
  }

  /** 敏感操作明细（分页） */
  @Get('sensitive-detail')
  sensitiveDetail(@CurrentUser() user: AuthUser, @Query() query: ListReportPageDto) {
    return this.reportsService.sensitiveDetail(
      user,
      query.from,
      query.to,
      query.page || 1,
      query.page_size || 20,
      query.keyword, // 复用 keyword 字段作为操作类型筛选
    );
  }

  /** 收入优惠统计（按优惠类型聚合） */
  @Get('income-discount')
  incomeDiscountStats(@CurrentUser() user: AuthUser, @Query() query: DateRangeDto) {
    return this.reportsService.incomeDiscountStats(user, query.from, query.to);
  }

  /** 券收入统计（按券聚合核销） */
  @Get('income-coupon')
  incomeCouponStats(@CurrentUser() user: AuthUser, @Query() query: DateRangeDto) {
    return this.reportsService.incomeCouponStats(user, query.from, query.to);
  }

  /** 收入优惠明细（分页） */
  @Get('income-discount-detail')
  incomeDiscountDetail(@CurrentUser() user: AuthUser, @Query() query: ListReportPageDto) {
    return this.reportsService.incomeDiscountDetail(
      user,
      query.from,
      query.to,
      query.page || 1,
      query.page_size || 20,
      query.keyword, // 复用 keyword 字段作为优惠类型筛选
    );
  }
}
