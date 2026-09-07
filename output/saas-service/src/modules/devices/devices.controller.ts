import {
  Body,
  Controller,
  Get,
  Post,
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
import { DevicesService } from './devices.service';
import { HeartbeatDeviceDto } from './dto/heartbeat-device.dto';

/**
 * 收银端设备监控
 * - POST /devices/heartbeat：收银端心跳上报（老板 / 收银员，未来收银 app 用员工账号登录后调用）
 * - GET  /admin/devices    ：商家后台只读列表（仅老板）
 */
@Controller()
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  /** 收银端心跳上报（自动登记 / 更新设备） */
  @Post('devices/heartbeat')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Boss, UserRole.Cashier)
  heartbeat(@CurrentUser() user: AuthUser, @Body() dto: HeartbeatDeviceDto) {
    return this.devicesService.heartbeat(user, dto);
  }

  /** 商家后台设备列表（只读监控） */
  @Get('admin/devices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Boss)
  list(@CurrentUser() user: AuthUser) {
    return this.devicesService.list(user);
  }
}
