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
import { CreateStaffDto } from './dto/create-staff.dto';
import { ListStaffDto } from './dto/list-staff.dto';
import { UpdateStaffStatusDto } from './dto/update-staff-status.dto';
import { StaffService } from './staff.service';

@Controller('admin/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Boss)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  /** 创建员工（收银员 / 财务） */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStaffDto) {
    return this.staffService.create(user, dto);
  }

  /** 员工列表（本店） */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListStaffDto) {
    return this.staffService.list(user, query.page || 1, query.page_size || 20);
  }

  /** 停用 / 启用员工 */
  @Post(':id/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStaffStatusDto,
  ) {
    return this.staffService.updateStatus(user, id, dto.status);
  }
}
