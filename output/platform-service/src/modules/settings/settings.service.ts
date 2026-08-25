import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from '../../entities/system-setting.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

export interface PublicSettings {
  system_name: string;
  logo: string | null;
  favicon: string | null;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly repo: Repository<SystemSetting>,
  ) {}

  /** 取单行设置，不存在则创建默认值 */
  private async getRow(): Promise<SystemSetting> {
    let row = await this.repo.findOne({ where: { id: 1 } });
    if (!row) {
      row = this.repo.create({ id: 1, system_name: '收银云', logo: null, favicon: null });
      await this.repo.save(row);
    }
    return row;
  }

  /** 公开读取品牌信息（登录页等未认证场景） */
  async getPublic(): Promise<PublicSettings> {
    const row = await this.getRow();
    return {
      system_name: row.system_name,
      logo: row.logo,
      favicon: row.favicon,
    };
  }

  /** 管理员更新设置（只更新传入的字段） */
  async update(dto: UpdateSettingsDto): Promise<PublicSettings> {
    const row = await this.getRow();
    if (dto.system_name !== undefined) {
      row.system_name = dto.system_name.trim() || '收银云';
    }
    if (dto.logo !== undefined) {
      row.logo = dto.logo || null;
    }
    if (dto.favicon !== undefined) {
      row.favicon = dto.favicon || null;
    }
    await this.repo.save(row);
    return this.getPublic();
  }
}
