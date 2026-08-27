import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationLog } from '../../entities/operation-log.entity';
import { Order } from '../../entities/order.entity';
import { OrderRefund } from '../../entities/order-refund.entity';
import { Table } from '../../entities/table.entity';
import { OrdersModule } from '../orders/orders.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Table, OrderRefund, OperationLog]),
    OrdersModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
