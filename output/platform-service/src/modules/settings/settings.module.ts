import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSetting } from '../../entities/system-setting.entity';
import { AuthModule } from '../auth/auth.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSetting]), AuthModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
