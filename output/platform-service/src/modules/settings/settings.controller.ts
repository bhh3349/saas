import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { Role } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** 公开：登录页等未认证场景读取品牌信息 */
  @Get()
  getPublic() {
    return this.settingsService.getPublic();
  }

  /** 管理员更新系统设置 */
  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(dto);
  }
}
