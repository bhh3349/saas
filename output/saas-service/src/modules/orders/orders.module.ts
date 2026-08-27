import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dish } from '../../entities/dish.entity';
import { OperationLog } from '../../entities/operation-log.entity';
import { Order } from '../../entities/order.entity';
import { OrderRefund } from '../../entities/order-refund.entity';
import { PaymentMethod } from '../../entities/payment-method.entity';
import { Table } from '../../entities/table.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Dish, Table, PaymentMethod, OrderRefund, OperationLog]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
