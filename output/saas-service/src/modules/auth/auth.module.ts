import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Shop } from '../../entities/shop.entity';
import { Table } from '../../entities/table.entity';
import { PaymentMethod } from '../../entities/payment-method.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PlatformClientService } from './platform-client.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Shop, Table, PaymentMethod])],
  controllers: [AuthController],
  providers: [AuthService, PlatformClientService],
  exports: [PlatformClientService],
})
export class AuthModule {}
