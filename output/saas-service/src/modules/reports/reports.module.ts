import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../entities/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), OrdersModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
