import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dish } from '../../entities/dish.entity';
import { Shop } from '../../entities/shop.entity';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [TypeOrmModule.forFeature([Shop, Dish])],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
