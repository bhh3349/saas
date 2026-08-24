import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DateRangeDto, ListReportOrdersDto } from './dto/date-range.dto';
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

  /** 日期范围订单明细（已结账 + 挂账） */
  @Get('orders')
  orderList(@CurrentUser() user: AuthUser, @Query() query: ListReportOrdersDto) {
    return this.reportsService.orderList(
      user,
      query.from,
      query.to,
      query.page || 1,
      query.page_size || 20,
    );
  }
}
