import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BucketsService } from './buckets.service';
import { PutBucketDto } from './dto/put-bucket.dto';

/**
 * 店铺通用配置桶：GET /admin/buckets/:key 读取，PUT 覆盖保存。
 * 老板和管理员可读写（收银/财务只读场景暂不开放）。
 */
@Controller('admin/buckets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Boss)
export class BucketsController {
  constructor(private readonly bucketsService: BucketsService) {}

  /** 读取某个配置桶，不存在返回 null */
  @Get(':key')
  get(@CurrentUser() user: AuthUser, @Param('key') key: string) {
    return this.bucketsService.get(user, key);
  }

  /** 覆盖保存某个配置桶 */
  @Put(':key')
  put(@CurrentUser() user: AuthUser, @Param('key') key: string, @Body() dto: PutBucketDto) {
    return this.bucketsService.put(user, key, dto.data);
  }
}
