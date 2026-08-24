import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SetmealsService } from './setmeals.service';
import { CreateSetmealDto } from './dto/create-setmeal.dto';
import { UpdateSetmealDto } from './dto/update-setmeal.dto';

/** 套餐管理（老板/管理员） */
@Controller('admin/setmeals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Boss)
export class SetmealsController {
  constructor(private readonly setmealsService: SetmealsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.setmealsService.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSetmealDto) {
    return this.setmealsService.create(user, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSetmealDto,
  ) {
    return this.setmealsService.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.setmealsService.remove(user, id);
  }
}
