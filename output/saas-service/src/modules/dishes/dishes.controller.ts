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
import { DishesService } from './dishes.service';
import { CreateDishDto, ImportDishesDto } from './dto/create-dish.dto';
import { ListDishesDto } from './dto/list-dishes.dto';
import { SortDishesDto } from './dto/sort-dishes.dto';
import { UpdateDishDto } from './dto/update-dish.dto';
import { UpdateDishStatusDto } from './dto/update-dish-status.dto';

/** 菜品管理（仅老板） */
@Controller('admin/dishes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Boss)
export class AdminDishesController {
  constructor(private readonly dishesService: DishesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDishDto) {
    return this.dishesService.create(user, dto);
  }

  /** 批量导入菜品 */
  @Post('import')
  import(@CurrentUser() user: AuthUser, @Body() dto: ImportDishesDto) {
    return this.dishesService.importDishes(user, dto);
  }

  /** 批量保存排序（ids 顺序即排序） */
  @Post('sort')
  sort(@CurrentUser() user: AuthUser, @Body() dto: SortDishesDto) {
    return this.dishesService.sortDishes(user, dto.ids);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListDishesDto) {
    return this.dishesService.list(
      user,
      query.page || 1,
      query.page_size || 20,
      query.category,
      query.status,
    );
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDishDto,
  ) {
    return this.dishesService.update(user, id, dto);
  }

  @Post(':id/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDishStatusDto,
  ) {
    return this.dishesService.updateStatus(user, id, dto.status, dto.sold_out);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.dishesService.remove(user, id);
  }
}

/** 点餐菜单（老板 / 收银员） */
@Controller('dishes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Boss, UserRole.Cashier)
export class DishesMenuController {
  constructor(private readonly dishesService: DishesService) {}

  @Get('menu')
  menu(@CurrentUser() user: AuthUser) {
    return this.dishesService.menu(user);
  }
}
