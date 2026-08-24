import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivationCode } from '../../entities/activation-code.entity';
import { AuthModule } from '../auth/auth.module';
import { OpLogModule } from '../op-log/op-log.module';
import { CodesController } from './codes.controller';
import { CodesService } from './codes.service';

@Module({
  imports: [TypeOrmModule.forFeature([ActivationCode]), AuthModule, OpLogModule],
  controllers: [CodesController],
  providers: [CodesService],
  exports: [CodesService],
})
export class CodesModule {}
