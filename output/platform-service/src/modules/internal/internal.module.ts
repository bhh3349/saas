import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivationCode } from '../../entities/activation-code.entity';
import { Shop } from '../../entities/shop.entity';
import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';

@Module({
  imports: [TypeOrmModule.forFeature([ActivationCode, Shop])],
  controllers: [InternalController],
  providers: [InternalService],
})
export class InternalModule {}
