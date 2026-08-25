import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getConfig } from './config/env';
import { ActivationCode } from './entities/activation-code.entity';
import { OpLog } from './entities/op-log.entity';
import { Operator } from './entities/operator.entity';
import { Shop } from './entities/shop.entity';
import { SystemSetting } from './entities/system-setting.entity';
import { AuthModule } from './modules/auth/auth.module';
import { CodesModule } from './modules/codes/codes.module';
import { InternalModule } from './modules/internal/internal.module';
import { OpLogModule } from './modules/op-log/op-log.module';
import { SaasClientModule } from './modules/saas-client/saas-client.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ShopsModule } from './modules/shops/shops.module';

@Module({
  imports: [
    // 全局限流：默认 60 次/分钟；登录/改密在 controller 单独收紧（@Throttle）
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 60 }],
    }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: getConfig().dbPath,
      entities: [Operator, ActivationCode, Shop, OpLog, SystemSetting],
      // 生产环境默认关闭自动同步（DB_SYNC 控制），schema 变更走 migration
      synchronize: getConfig().dbSync,
      logging: false,
    }),
    AuthModule,
    CodesModule,
    ShopsModule,
    InternalModule,
    OpLogModule,
    SaasClientModule,
    SettingsModule,
  ],
  providers: [
    // 全局限流守卫：所有请求默认 60 次/分钟；登录/改密被 @Throttle 覆盖为更严限制
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
