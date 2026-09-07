import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
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
import { CreateStaffDto } from './dto/create-staff.dto';
import { ListStaffDto } from './dto/list-staff.dto';
import { ResetPasswordDto, UpdateStaffDto } from './dto/update-staff.dto';
import { UpdateStaffStatusDto } from './dto/update-staff-status.dto';
import { StaffService } from './staff.service';

@Controller('admin/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Boss)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  /** 创建账号：老板 / 收银员 / 财务 */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStaffDto) {
    return this.staffService.create(user, dto);
  }

  /** 账号列表（含店主，店主排第一） */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListStaffDto) {
    return this.staffService.list(user, query.page || 1, query.page_size || 20);
  }

  /** 编辑账号基本信息（目前仅姓名） */
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staffService.update(user, id, dto);
  }

  /** 重置密码（默认 123456） */
  @Post(':id/reset-password')
  resetPassword(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.staffService.resetPassword(user, id, dto);
  }

  /** 删除账号（店主不可删） */
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.staffService.remove(user, id);
  }

  /** 停用 / 启用（店主不可停） */
  @Post(':id/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStaffStatusDto,
  ) {
    return this.staffService.updateStatus(user, id, dto.status);
  }
}
