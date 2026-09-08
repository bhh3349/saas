import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { getConfig } from '../src/config/env';
import { Area } from '../src/entities/area.entity';
import { Attribute } from '../src/entities/attribute.entity';
import { Category } from '../src/entities/category.entity';
import { Device } from '../src/entities/device.entity';
import { Dish } from '../src/entities/dish.entity';
import { OperationLog } from '../src/entities/operation-log.entity';
import { Order } from '../src/entities/order.entity';
import { OrderPayment } from '../src/entities/order-payment.entity';
import { OrderRefund } from '../src/entities/order-refund.entity';
import { PaymentMethod } from '../src/entities/payment-method.entity';
import { Printer } from '../src/entities/printer.entity';
import { Setmeal } from '../src/entities/setmeal.entity';
import { Shop } from '../src/entities/shop.entity';
import { ShopBucket } from '../src/entities/shop-bucket.entity';
import { Table } from '../src/entities/table.entity';
import { User } from '../src/entities/user.entity';

//** TypeORM CLI DataSource: only for generate/run; runtime is managed by AppModule. */
export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: getConfig().dbPath,
  entities: [User, Table, Area, PaymentMethod, Dish, Order, Shop, Category, Attribute, Setmeal, ShopBucket, OrderRefund, OrderPayment, OperationLog, Device, Printer],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
