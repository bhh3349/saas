import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dish } from '../../entities/dish.entity';
import { OrderRefund } from '../../entities/order-refund.entity';
import { Setmeal } from '../../entities/setmeal.entity';
import { AdminDishesController, DishesMenuController } from './dishes.controller';
import { DishesService } from './dishes.service';

@Module({
  imports: [TypeOrmModule.forFeature([Dish, Setmeal, OrderRefund])],
  controllers: [AdminDishesController, DishesMenuController],
  providers: [DishesService],
})
export class DishesModule {}
