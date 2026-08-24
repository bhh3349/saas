import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AttributesService } from './attributes.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';

/** 菜品属性管理（规格/做法/单位） */
@Controller('admin/attributes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Boss)
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  /** kind: spec | method | unit */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('kind') kind?: string) {
    return this.attributesService.list(user, kind);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAttributeDto) {
    return this.attributesService.create(user, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAttributeDto,
  ) {
    return this.attributesService.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.attributesService.remove(user, id);
  }
}
