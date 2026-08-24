import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Area } from '../../entities/area.entity';
import { Table } from '../../entities/table.entity';
import { AdminAreasController } from './areas.controller';
import { AreasService } from './areas.service';

@Module({
  imports: [TypeOrmModule.forFeature([Area, Table])],
  controllers: [AdminAreasController],
  providers: [AreasService],
})
export class AreasModule {}
