import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';
import { OperatorPayload } from '../../common/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { CodesService } from './codes.service';
import { BatchCreateDto } from './dto/batch-create.dto';
import { CodeParamDto } from './dto/code-param.dto';
import { ListCodesDto } from './dto/list-codes.dto';

@Controller('admin/codes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class CodesController {
  constructor(private readonly codesService: CodesService) {}

  /** 批量生成激活码 */
  @Post('batch')
  batchCreate(@Body() dto: BatchCreateDto) {
    return this.codesService.batchCreate(dto);
  }

  /** 列表查询 */
  @Get()
  list(@Query() query: ListCodesDto) {
    return this.codesService.list(query);
  }

  /** 导出 CSV（注意：定义在 :code 动态路由之前） */
  @Get('export')
  async export(@Query() query: ListCodesDto, @Res() res: Response): Promise<void> {
    const csv = await this.codesService.exportCsv(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="activation_codes.csv"');
    res.send('\ufeff' + csv);
  }

  /** 作废激活码 */
  @Post(':code/void')
  void(
    @Param() params: CodeParamDto,
    @CurrentUser() operator?: OperatorPayload,
    @Req() req?: Request,
  ) {
    return this.codesService.void(params.code, operator?.userId ?? 0, {
      ip: req?.ip,
      userAgent: req?.headers['user-agent'],
    });
  }
}
