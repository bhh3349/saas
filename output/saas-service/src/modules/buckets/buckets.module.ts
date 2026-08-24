import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopBucket } from '../../entities/shop-bucket.entity';
import { BucketsController } from './buckets.controller';
import { BucketsService } from './buckets.service';

@Module({
  imports: [TypeOrmModule.forFeature([ShopBucket])],
  controllers: [BucketsController],
  providers: [BucketsService],
})
export class BucketsModule {}
