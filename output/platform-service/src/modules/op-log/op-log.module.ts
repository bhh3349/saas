import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OpLog } from '../../entities/op-log.entity';
import { OpLogService } from './op-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([OpLog])],
  providers: [OpLogService],
  exports: [OpLogService],
})
export class OpLogModule {}
