import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shop } from '../../entities/shop.entity';
import { AuthModule } from '../auth/auth.module';
import { OpLogModule } from '../op-log/op-log.module';
import { SaasClientModule } from '../saas-client/saas-client.module';
import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';

@Module({
  imports: [TypeOrmModule.forFeature([Shop]), AuthModule, OpLogModule, SaasClientModule],
  controllers: [ShopsController],
  providers: [ShopsService],
  exports: [ShopsService],
})
export class ShopsModule {}
