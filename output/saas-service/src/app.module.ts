import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { getConfig } from './config/env';
import { User } from './entities/user.entity';
import { Table } from './entities/table.entity';
import { Area } from './entities/area.entity';
import { PaymentMethod } from './entities/payment-method.entity';
import { Dish } from './entities/dish.entity';
import { Order } from './entities/order.entity';
import { Shop } from './entities/shop.entity';
import { Category } from './entities/category.entity';
import { Attribute } from './entities/attribute.entity';
import { Setmeal } from './entities/setmeal.entity';
import { ShopBucket } from './entities/shop-bucket.entity';
import { ShopStatusGuard } from './common/guards/shop-status.guard';
import { AttributesModule } from './modules/attributes/attributes.module';
import { BucketsModule } from './modules/buckets/buckets.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { DishesModule } from './modules/dishes/dishes.module';
import { InternalModule } from './modules/internal/internal.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SetmealsModule } from './modules/setmeals/setmeals.module';
import { StaffModule } from './modules/staff/staff.module';
import { TablesModule } from './modules/tables/tables.module';
import { AreasModule } from './modules/areas/areas.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: getConfig().dbPath,
      entities: [User, Table, Area, PaymentMethod, Dish, Order, Shop, Category, Attribute, Setmeal, ShopBucket],
      // 开发期自动建表；生产可改为 migration 或预执行建表脚本
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Shop]),
    JwtModule.register({
      global: true,
      secret: getConfig().jwtSecret,
      signOptions: { expiresIn: getConfig().jwtExpiresIn },
    }),
    AuthModule,
    StaffModule,
    DishesModule,
    CategoriesModule,
    AttributesModule,
    SetmealsModule,
    BucketsModule,
    TablesModule,
    AreasModule,
    PaymentsModule,
    OrdersModule,
    ReportsModule,
    InternalModule,
  ],
  providers: [
    // 店铺停用全局拦截（解析 JWT → 本地快照 → disabled 403）
    { provide: APP_GUARD, useClass: ShopStatusGuard },
  ],
})
export class AppModule {}
