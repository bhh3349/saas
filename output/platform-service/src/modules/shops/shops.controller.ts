import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';
import { OperatorPayload } from '../../common/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { ListShopsDto } from './dto/list-shops.dto';
import { UpdateShopStatusDto } from './dto/update-shop-status.dto';
import { ShopsService } from './shops.service';

@Controller('admin/shops')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  /** 店铺列表（跨租户） */
  @Get()
  list(@Query() query: ListShopsDto) {
    return this.shopsService.list(query);
  }

  /** 店铺停用 / 启用（敏感操作：记录日志 + 同步 saas-service） */
  @Post(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShopStatusDto,
    @CurrentUser() operator?: OperatorPayload,
    @Req() req?: Request,
  ) {
    return this.shopsService.updateStatus(id, dto.status, operator?.userId ?? 0, {
      ip: req?.ip,
      userAgent: req?.headers['user-agent'],
    });
  }
}
