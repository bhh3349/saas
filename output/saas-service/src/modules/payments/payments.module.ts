import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentMethod } from '../../entities/payment-method.entity';
import { AdminPaymentsController, PaymentsPublicController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentMethod])],
  controllers: [AdminPaymentsController, PaymentsPublicController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
