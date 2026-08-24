import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../../entities/category.entity';
import { Dish } from '../../entities/dish.entity';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Dish])],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
