import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InternalSignatureGuard } from '../../common/guards/internal-signature.guard';
import { UpdateShopStatusDto } from './dto/update-shop-status.dto';
import { InternalService } from './internal.service';

@Controller('internal')
@UseGuards(InternalSignatureGuard)
export class InternalController {
  constructor(private readonly internalService: InternalService) {}

  /** 平台端同步店铺状态（停用 / 启用） */
  @Post('shop-status')
  updateShopStatus(@Body() dto: UpdateShopStatusDto) {
    return this.internalService.updateShopStatus(dto);
  }
}
