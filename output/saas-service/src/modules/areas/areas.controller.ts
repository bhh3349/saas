import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
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
import { AreasService } from './areas.service';
import { CreateAreasDto } from './dto/create-areas.dto';
import { SortAreasDto } from './dto/sort-areas.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

/** 桌台区域管理（仅老板） */
@Controller('admin/areas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Boss)
export class AdminAreasController {
  constructor(private readonly areasService: AreasService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.areasService.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAreasDto) {
    return this.areasService.create(user, dto.names);
  }

  @Put('sort')
  sort(@CurrentUser() user: AuthUser, @Body() dto: SortAreasDto) {
    return this.areasService.sort(user, dto.items);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAreaDto,
  ) {
    return this.areasService.update(user, id, dto.name);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.areasService.remove(user, id);
  }
}
