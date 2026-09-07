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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreatePrinterDto, UpdatePrinterDto } from './dto/printer.dto';
import { PrintersService } from './printers.service';

/**
 * 打印机管理（所有已登录角色可用，按 shop_id 隔离）
 * 收银端通过此接口：列出打印机、设默认、新增、删除
 */
@Controller('printers')
@UseGuards(JwtAuthGuard)
export class PrintersController {
  constructor(private readonly printersService: PrintersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.printersService.list(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.printersService.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePrinterDto) {
    return this.printersService.create(user, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePrinterDto,
  ) {
    return this.printersService.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.printersService.remove(user, id);
  }

  /** 设为默认打印机（单选） */
  @Post(':id/default')
  setDefault(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.printersService.setDefault(user, id);
  }
}
