import { Body, Controller, Get, NotImplementedException, NotFoundException, Param, Post } from '@nestjs/common';
import { CreatePublicOrderDto, PublicTableDto, PublicService } from './public.service';

/**
 * 顾客扫码点餐预留端点：本期仅实现匿名只读菜单。
 * 二期下单和桌台能力按 docs/scan-ordering-api.md 扩展。
 */
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get(':shopCode/menu')
  menu(@Param('shopCode') shopCode: string) {
    return this.publicService.menu(shopCode);
  }

  @Get(':shopCode/tables/:tableCode')
  async table(@Param('shopCode') shopCode: string, @Param('tableCode') _tableCode: string, _query?: PublicTableDto): Promise<never> {
    await this.publicService.getActiveShopId(shopCode);
    throw new NotImplementedException('桌台接口尚未开放');
  }

  @Post(':shopCode/orders')
  async createOrder(@Param('shopCode') shopCode: string, @Body() _dto: CreatePublicOrderDto): Promise<never> {
    await this.publicService.getActiveShopId(shopCode);
    throw new NotImplementedException('下单接口尚未开放');
  }

  @Get(':shopCode/orders/:ticketNo')
  async order(@Param('shopCode') shopCode: string, @Param('ticketNo') _ticketNo: string): Promise<never> {
    await this.publicService.getActiveShopId(shopCode);
    throw new NotImplementedException('点单查询接口尚未开放');
  }
}
