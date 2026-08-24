import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Table } from '../../entities/table.entity';
import { AdminTablesController, TablesPublicController } from './tables.controller';
import { TablesService } from './tables.service';

@Module({
  imports: [TypeOrmModule.forFeature([Table])],
  controllers: [AdminTablesController, TablesPublicController],
  providers: [TablesService],
})
export class TablesModule {}
