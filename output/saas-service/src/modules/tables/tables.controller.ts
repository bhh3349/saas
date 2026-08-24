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
import { CreateTableDto } from './dto/create-table.dto';
import { ImportTablesDto } from './dto/import-tables.dto';
import { ListTablesDto } from './dto/list-tables.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { TablesService } from './tables.service';

/** 桌台管理（仅老板） */
@Controller('admin/tables')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Boss)
export class AdminTablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTableDto) {
    return this.tablesService.create(user, dto);
  }

  /** POST /admin/tables/import 批量导入桌台 */
  @Post('import')
  importTables(@CurrentUser() user: AuthUser, @Body() dto: ImportTablesDto) {
    return this.tablesService.importTables(user, dto.items);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListTablesDto) {
    return this.tablesService.list(
      user,
      query.page || 1,
      query.page_size || 20,
      query.status,
      query.area,
      query.name,
    );
  }

  /** GET /admin/tables/export 导出桌台（可按区域过滤，返回全量） */
  @Get('export')
  exportList(@CurrentUser() user: AuthUser, @Query('area') area?: string) {
    return this.tablesService.exportList(user, area);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTableDto,
  ) {
    return this.tablesService.update(user, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tablesService.remove(user, id);
  }
}

/** 收银工作台桌台列表（老板 / 收银员） */
@Controller('tables')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Boss, UserRole.Cashier)
export class TablesPublicController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  all(@CurrentUser() user: AuthUser) {
    return this.tablesService.all(user);
  }
}
