import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setmeal } from '../../entities/setmeal.entity';
import { SetmealsController } from './setmeals.controller';
import { SetmealsService } from './setmeals.service';

@Module({
  imports: [TypeOrmModule.forFeature([Setmeal])],
  controllers: [SetmealsController],
  providers: [SetmealsService],
})
export class SetmealsModule {}
