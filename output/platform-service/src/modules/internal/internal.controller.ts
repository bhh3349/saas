import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { InternalSignatureGuard } from '../../common/guards/internal-signature.guard';
import { ClaimDto } from './dto/claim.dto';
import { InternalService } from './internal.service';

@Controller('internal')
@UseGuards(InternalSignatureGuard)
export class InternalController {
  constructor(private readonly internalService: InternalService) {}

  /** 商家注册：校验激活码 + 建店绑定 */
  @Post('activation/claim')
  claim(@Body() dto: ClaimDto) {
    return this.internalService.claim(dto);
  }

  /** 店铺状态查询：saas-service 登录时校验（pull，确保停用立即生效） */
  @Get('shops/:id/status')
  getShopStatus(@Param('id', ParseIntPipe) id: number) {
    return this.internalService.getShopStatus(id);
  }
}
