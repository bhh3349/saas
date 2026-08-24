import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { SettleOrderDto } from './dto/settle-order.dto';
import { OrdersService } from './orders.service';

/** 收银工作台（老板 / 收银员） */
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Boss, UserRole.Cashier)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** 下单（开台 + 点餐合并） */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user, dto);
  }

  /** 订单流（按状态筛选） */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListOrdersDto) {
    return this.ordersService.list(
      user,
      query.page || 1,
      query.page_size || 20,
      query.status,
    );
  }

  /** 接单 */
  @Post(':id/confirm')
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.confirm(user, id);
  }

  /** 拒单（释放桌台） */
  @Post(':id/reject')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.reject(user, id);
  }

  /** 结账记账（释放桌台） */
  @Post(':id/settle')
  settle(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SettleOrderDto,
  ) {
    return this.ordersService.settle(user, id, dto);
  }

  /** 免单（金额记 0，释放桌台） */
  @Post(':id/free')
  free(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.free(user, id);
  }

  /** 挂账（释放桌台，可补收） */
  @Post(':id/on-account')
  onAccount(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.onAccount(user, id);
  }
}
